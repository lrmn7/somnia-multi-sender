// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title Somnia Multisender
 * @notice Production-grade non-custodial batch token and native SOMI distributor.
 * @dev Optimized for Somnia gas architecture (avoids excessive log overhead, restricts chunk size).
 */
contract Multisender is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    /// @notice Maximum recipients allowed in a single chunk to prevent block gas limits.
    uint256 public constant MAX_RECIPIENTS_PER_CHUNK = 500;

    /// @notice Address of the authorized sponsor/relayer for gas-sponsored ERC-20 transfers.
    mapping(address => bool) public isAuthorizedRelayer;

    /// @notice Execution record tracking status, sponsorship, and executing relayer/caller.
    struct ChunkExecutionRecord {
        bool executed;
        bool sponsored;
        address executor;
    }

    /// @notice Detailed execution records per chunk hash.
    mapping(bytes32 => ChunkExecutionRecord) public chunkRecords;

    /// @notice Emitted when a batch chunk is successfully executed.
    /// @dev Compact summary event to minimize expensive Somnia log costs.
    event BatchChunkExecuted(
        bytes32 indexed batchId,
        uint256 indexed chunkIndex,
        address indexed sender,
        address token,
        uint256 recipientCount,
        uint256 totalAmount
    );

    /// @notice Emitted when a relayer authorization status is updated.
    event RelayerStatusUpdated(address indexed relayer, bool isAuthorized);

    // Custom errors for gas efficiency
    error ArrayLengthMismatch();
    error EmptyRecipientList();
    error ExceedsMaxChunkLimit(uint256 count, uint256 max);
    error InvalidMsgValue(uint256 expected, uint256 actual);
    error ZeroAddressRecipient();
    error ZeroAmount();
    error DuplicateRecipient(address recipient);
    error ChunkAlreadyExecuted(bytes32 batchId, uint256 chunkIndex);
    error UnauthorizedRelayer(address caller);
    error NativeTransferFailed(address recipient, uint256 amount);
    error InvalidTotalAmount(uint256 expected, uint256 actual);

    /**
     * @notice Constructor initializes the owner and unpaused state.
     * @param initialOwner Initial admin address (support 2-step ownership transfer).
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Computes a deterministic identity hash for a chunk.
     */
    function getChunkHash(bytes32 batchId, uint256 chunkIndex) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(batchId, chunkIndex));
    }

    /**
     * @notice Returns comprehensive on-chain execution details for a chunk.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     * @return executed Whether the chunk executed successfully.
     * @return sponsored Whether the chunk was executed through the sponsored path.
     * @return executor Address of the relayer or caller who executed the chunk.
     */
    function getChunkExecution(bytes32 batchId, uint256 chunkIndex)
        external
        view
        returns (bool executed, bool sponsored, address executor)
    {
        ChunkExecutionRecord memory rec = chunkRecords[getChunkHash(batchId, chunkIndex)];
        return (rec.executed, rec.sponsored, rec.executor);
    }

    /**
     * @notice Verifies if a given batch chunk has already been executed on-chain.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     */
    function isChunkExecuted(bytes32 batchId, uint256 chunkIndex) external view returns (bool) {
        return chunkRecords[getChunkHash(batchId, chunkIndex)].executed;
    }

    /**
     * @notice Backward-compatible lookup for chunk execution status by hash.
     */
    function executedChunks(bytes32 chunkHash) external view returns (bool) {
        return chunkRecords[chunkHash].executed;
    }

    /**
     * @notice Authorizes or revokes a relayer for sponsored transfers.
     */
    function setRelayerStatus(address relayer, bool isAuthorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        isAuthorizedRelayer[relayer] = isAuthorized;
        emit RelayerStatusUpdated(relayer, isAuthorized);
    }

    /**
     * @notice Emergency pause.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Distributes native SOMI / STT to multiple recipients.
     * @param recipients Array of recipient addresses.
     * @param amounts Array of amounts per recipient in base units.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     */
    function sendNative(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 batchId,
        uint256 chunkIndex
    ) external payable whenNotPaused nonReentrant {
        uint256 count = recipients.length;
        if (count != amounts.length) revert ArrayLengthMismatch();
        if (count == 0) revert EmptyRecipientList();
        if (count > MAX_RECIPIENTS_PER_CHUNK) revert ExceedsMaxChunkLimit(count, MAX_RECIPIENTS_PER_CHUNK);

        bytes32 chunkHash = getChunkHash(batchId, chunkIndex);
        if (chunkRecords[chunkHash].executed) revert ChunkAlreadyExecuted(batchId, chunkIndex);
        chunkRecords[chunkHash] = ChunkExecutionRecord({
            executed: true,
            sponsored: false,
            executor: msg.sender
        });

        uint256 expectedTotal = 0;
        for (uint256 i = 0; i < count;) {
            address to = recipients[i];
            uint256 amount = amounts[i];

            if (to == address(0)) revert ZeroAddressRecipient();
            if (amount == 0) revert ZeroAmount();

            expectedTotal += amount;

            (bool success, ) = to.call{value: amount}("");
            if (!success) revert NativeTransferFailed(to, amount);

            unchecked { ++i; }
        }

        if (msg.value != expectedTotal) {
            revert InvalidMsgValue(expectedTotal, msg.value);
        }

        emit BatchChunkExecuted(
            batchId,
            chunkIndex,
            msg.sender,
            address(0),
            count,
            expectedTotal
        );
    }

    /**
     * @notice Distributes equal amounts of native SOMI / STT to multiple recipients.
     * @param recipients Array of recipient addresses.
     * @param amountPerRecipient Exact amount each recipient receives.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     */
    function sendNativeEqual(
        address[] calldata recipients,
        uint256 amountPerRecipient,
        bytes32 batchId,
        uint256 chunkIndex
    ) external payable whenNotPaused nonReentrant {
        uint256 count = recipients.length;
        if (count == 0) revert EmptyRecipientList();
        if (count > MAX_RECIPIENTS_PER_CHUNK) revert ExceedsMaxChunkLimit(count, MAX_RECIPIENTS_PER_CHUNK);
        if (amountPerRecipient == 0) revert ZeroAmount();

        bytes32 chunkHash = getChunkHash(batchId, chunkIndex);
        if (chunkRecords[chunkHash].executed) revert ChunkAlreadyExecuted(batchId, chunkIndex);
        chunkRecords[chunkHash] = ChunkExecutionRecord({
            executed: true,
            sponsored: false,
            executor: msg.sender
        });

        uint256 expectedTotal = amountPerRecipient * count;
        if (msg.value != expectedTotal) revert InvalidMsgValue(expectedTotal, msg.value);

        for (uint256 i = 0; i < count;) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddressRecipient();

            (bool success, ) = to.call{value: amountPerRecipient}("");
            if (!success) revert NativeTransferFailed(to, amountPerRecipient);

            unchecked { ++i; }
        }

        emit BatchChunkExecuted(
            batchId,
            chunkIndex,
            msg.sender,
            address(0),
            count,
            expectedTotal
        );
    }

    /**
     * @notice Distributes ERC-20 tokens from caller to multiple recipients.
     * @param token Address of the ERC-20 token contract.
     * @param recipients Array of recipient addresses.
     * @param amounts Array of amounts per recipient in token base units.
     * @param totalAmount Sum of amounts, verified on-chain.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     */
    function sendToken(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 totalAmount,
        bytes32 batchId,
        uint256 chunkIndex
    ) external whenNotPaused nonReentrant {
        uint256 count = recipients.length;
        if (count != amounts.length) revert ArrayLengthMismatch();
        if (count == 0) revert EmptyRecipientList();
        if (count > MAX_RECIPIENTS_PER_CHUNK) revert ExceedsMaxChunkLimit(count, MAX_RECIPIENTS_PER_CHUNK);

        bytes32 chunkHash = getChunkHash(batchId, chunkIndex);
        if (chunkRecords[chunkHash].executed) revert ChunkAlreadyExecuted(batchId, chunkIndex);
        chunkRecords[chunkHash] = ChunkExecutionRecord({
            executed: true,
            sponsored: false,
            executor: msg.sender
        });

        uint256 computedTotal = 0;
        for (uint256 i = 0; i < count;) {
            address to = recipients[i];
            uint256 amount = amounts[i];

            if (to == address(0)) revert ZeroAddressRecipient();
            if (amount == 0) revert ZeroAmount();

            computedTotal += amount;
            token.safeTransferFrom(msg.sender, to, amount);

            unchecked { ++i; }
        }

        if (computedTotal != totalAmount) {
            revert InvalidTotalAmount(totalAmount, computedTotal);
        }

        emit BatchChunkExecuted(
            batchId,
            chunkIndex,
            msg.sender,
            address(token),
            count,
            totalAmount
        );
    }

    /**
     * @notice Distributes ERC-20 tokens where gas is sponsored by an authorized relayer.
     * @dev Sender must have approved this Multisender contract for at least `totalAmount`.
     * @param sender The actual owner of the tokens who provided allowance.
     * @param token Address of the ERC-20 token contract.
     * @param recipients Array of recipient addresses.
     * @param amounts Array of amounts per recipient.
     * @param totalAmount Sum of amounts.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     */
    function sendTokenSponsored(
        address sender,
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 totalAmount,
        bytes32 batchId,
        uint256 chunkIndex
    ) external whenNotPaused nonReentrant {
        if (!isAuthorizedRelayer[msg.sender]) revert UnauthorizedRelayer(msg.sender);

        uint256 count = recipients.length;
        if (count != amounts.length) revert ArrayLengthMismatch();
        if (count == 0) revert EmptyRecipientList();
        if (count > MAX_RECIPIENTS_PER_CHUNK) revert ExceedsMaxChunkLimit(count, MAX_RECIPIENTS_PER_CHUNK);

        bytes32 chunkHash = getChunkHash(batchId, chunkIndex);
        if (chunkRecords[chunkHash].executed) revert ChunkAlreadyExecuted(batchId, chunkIndex);
        chunkRecords[chunkHash] = ChunkExecutionRecord({
            executed: true,
            sponsored: true,
            executor: msg.sender
        });

        uint256 computedTotal = 0;
        for (uint256 i = 0; i < count;) {
            address to = recipients[i];
            uint256 amount = amounts[i];

            if (to == address(0)) revert ZeroAddressRecipient();
            if (amount == 0) revert ZeroAmount();

            computedTotal += amount;
            token.safeTransferFrom(sender, to, amount);

            unchecked { ++i; }
        }

        if (computedTotal != totalAmount) {
            revert InvalidTotalAmount(totalAmount, computedTotal);
        }

        emit BatchChunkExecuted(
            batchId,
            chunkIndex,
            sender,
            address(token),
            count,
            totalAmount
        );
    }
}
