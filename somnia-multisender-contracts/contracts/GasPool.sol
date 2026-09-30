// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IMultisender {
    function isChunkExecuted(bytes32 batchId, uint256 chunkIndex) external view returns (bool);
    function getChunkExecution(bytes32 batchId, uint256 chunkIndex)
        external
        view
        returns (bool executed, bool sponsored, address executor);
}

/**
 * @title Somnia Community Gas Pool
 * @notice Transparent community treasury for funding gas sponsorship on Somnia.
 * @dev Enforces strict daily reimbursement caps, per-chunk caps, reserve floors,
 *      and cryptographic verification that chunks actually executed on Multisender.sol.
 *      Arbitrary owner withdrawals are prohibited by design to protect donor funds.
 */
contract GasPool is ReentrancyGuard, Pausable, Ownable2Step {
    /// @notice Address of the official Multisender contract verified on-chain.
    address public multisenderContract;

    /// @notice Authorized relayer or operator addresses eligible for gas reimbursement.
    mapping(address => bool) public isOperator;

    /// @notice Maximum reimbursement allowed for a single chunk execution.
    uint256 public maxPerChunkCap = 5 ether; // 5 SOMI / STT

    /// @notice Maximum total reimbursement allowed within a 24-hour window.
    uint256 public dailySpendingCap = 500 ether; // 500 SOMI / STT

    /// @notice Minimum reserve balance that cannot be spent for sponsorship.
    uint256 public minReserveThreshold = 10 ether;

    /// @notice Tracks daily spending by day index (timestamp / 1 days).
    mapping(uint256 => uint256) public dailySpent;

    /// @notice Tracks reimbursed chunk hashes to prevent duplicate payouts.
    mapping(bytes32 => bool) public reimbursedChunks;

    /// @notice Emitted when a donation is received.
    event DonationReceived(address indexed donor, uint256 amount, uint256 currentBalance);

    /// @notice Emitted when a relayer is reimbursed for gas expenditure.
    event RelayerReimbursed(
        address indexed relayer,
        uint256 amount,
        bytes32 indexed batchId,
        uint256 indexed chunkIndex
    );

    /// @notice Emitted when spending limits are adjusted.
    event SpendingLimitsUpdated(uint256 maxPerChunk, uint256 dailyCap, uint256 minReserve);

    /// @notice Emitted when operator status changes.
    event OperatorStatusUpdated(address indexed operator, bool isAuthorized);

    /// @notice Emitted when multisender contract address is updated.
    event MultisenderContractUpdated(address indexed previousContract, address indexed newContract);

    // Custom errors
    error UnauthorizedOperator(address caller);
    error ZeroDonation();
    error ExceedsPerChunkCap(uint256 requested, uint256 cap);
    error ExceedsDailySpendingCap(uint256 requested, uint256 available);
    error PoolReserveTooLow(uint256 currentBalance, uint256 minReserve);
    error ChunkAlreadyReimbursed(bytes32 batchId, uint256 chunkIndex);
    error ChunkNotExecutedOnChain(bytes32 batchId, uint256 chunkIndex);
    error ChunkNotSponsored(bytes32 batchId, uint256 chunkIndex);
    error ExecutorMismatch(address executor, address claimer);
    error UnauthorizedClaimer(address caller, address relayer);
    error ReimbursementTransferFailed(address relayer, uint256 amount);
    error InvalidOperatorAddress();
    error InvalidMultisenderAddress();
    error MultisenderContractNotSet();

    /**
     * @param initialOwner Address of the contract owner / admin multisig.
     * @param initialMultisender Address of the Multisender contract (can be updated by owner).
     */
    constructor(address initialOwner, address initialMultisender) Ownable(initialOwner) {
        if (initialMultisender != address(0)) {
            multisenderContract = initialMultisender;
            emit MultisenderContractUpdated(address(0), initialMultisender);
        }
    }

    /**
     * @notice Allows any user to donate native SOMI / STT to the community gas pool.
     */
    function donate() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroDonation();
        emit DonationReceived(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @notice Fallback receive function to accept plain native transfers.
     */
    receive() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroDonation();
        emit DonationReceived(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @notice Reimburses an authorized relayer with a bounded deterministic sponsorship credit for confirmed on-chain gas expenditure.
     * @dev Strictly verifies that:
     *      1. The chunk executed on Multisender.sol.
     *      2. The chunk was executed via the sponsored execution path (sponsored == true).
     *      3. The caller and claimer match the exact relayer address that executed the chunk (executor == relayer == msg.sender).
     *      4. The relayer is currently an authorized operator.
     *      5. The chunk has not been previously reimbursed.
     * @param relayer Address of the executing relayer to receive the native reimbursement credit.
     * @param amount Gas cost in wei/base units to reimburse.
     * @param batchId Deterministic UUID/hash of the batch.
     * @param chunkIndex Zero-indexed chunk number.
     */
    function reimburseRelayer(
        address payable relayer,
        uint256 amount,
        bytes32 batchId,
        uint256 chunkIndex
    ) external whenNotPaused nonReentrant {
        if (!isOperator[msg.sender]) revert UnauthorizedOperator(msg.sender);
        if (relayer == address(0)) revert InvalidOperatorAddress();
        if (amount > maxPerChunkCap) revert ExceedsPerChunkCap(amount, maxPerChunkCap);

        if (multisenderContract == address(0)) revert MultisenderContractNotSet();

        // STRICT ON-CHAIN VERIFICATION: Multisender chunk execution details
        (bool executed, bool sponsored, address executor) = IMultisender(multisenderContract).getChunkExecution(batchId, chunkIndex);

        if (!executed) revert ChunkNotExecutedOnChain(batchId, chunkIndex);
        if (!sponsored) revert ChunkNotSponsored(batchId, chunkIndex);
        if (executor != relayer) revert ExecutorMismatch(executor, relayer);
        if (msg.sender != relayer) revert UnauthorizedClaimer(msg.sender, relayer);

        bytes32 chunkHash = keccak256(abi.encodePacked(batchId, chunkIndex));
        if (reimbursedChunks[chunkHash]) revert ChunkAlreadyReimbursed(batchId, chunkIndex);
        reimbursedChunks[chunkHash] = true;

        uint256 currentBalance = address(this).balance;
        if (currentBalance < amount + minReserveThreshold) {
            revert PoolReserveTooLow(currentBalance, minReserveThreshold);
        }

        uint256 currentDay = block.timestamp / 1 days;
        uint256 todaySpent = dailySpent[currentDay];
        if (todaySpent + amount > dailySpendingCap) {
            revert ExceedsDailySpendingCap(amount, dailySpendingCap - todaySpent);
        }

        dailySpent[currentDay] = todaySpent + amount;

        (bool success, ) = relayer.call{value: amount}("");
        if (!success) revert ReimbursementTransferFailed(relayer, amount);

        emit RelayerReimbursed(relayer, amount, batchId, chunkIndex);
    }

    /**
     * @notice Helper to check if a specific chunk has already received reimbursement.
     */
    function isChunkReimbursed(bytes32 batchId, uint256 chunkIndex) external view returns (bool) {
        return reimbursedChunks[keccak256(abi.encodePacked(batchId, chunkIndex))];
    }

    /**
     * @notice Returns the available balance for sponsorship (balance minus reserve threshold).
     */
    function availableSponsorshipBalance() external view returns (uint256) {
        uint256 bal = address(this).balance;
        if (bal <= minReserveThreshold) return 0;
        return bal - minReserveThreshold;
    }

    /**
     * @notice Links or updates the Multisender contract address.
     */
    function setMultisenderContract(address newMultisender) external onlyOwner {
        if (newMultisender == address(0)) revert InvalidMultisenderAddress();
        address previous = multisenderContract;
        multisenderContract = newMultisender;
        emit MultisenderContractUpdated(previous, newMultisender);
    }

    /**
     * @notice Sets or revokes operator authorization.
     */
    function setOperator(address operator, bool isAuthorized) external onlyOwner {
        if (operator == address(0)) revert InvalidOperatorAddress();
        isOperator[operator] = isAuthorized;
        emit OperatorStatusUpdated(operator, isAuthorized);
    }

    /**
     * @notice Updates spending and reserve safety thresholds.
     */
    function setSpendingLimits(
        uint256 newMaxPerChunk,
        uint256 newDailyCap,
        uint256 newMinReserve
    ) external onlyOwner {
        maxPerChunkCap = newMaxPerChunk;
        dailySpendingCap = newDailyCap;
        minReserveThreshold = newMinReserve;
        emit SpendingLimitsUpdated(newMaxPerChunk, newDailyCap, newMinReserve);
    }

    /**
     * @notice Emergency pause for sponsorship operations.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes operations after incident resolution.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
