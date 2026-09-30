// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title MockNoReturnToken
 * @notice Simulates USDT / non-standard ERC-20 where transfer/transferFrom returns void instead of bool.
 */
contract MockNoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor() {
        balanceOf[msg.sender] = 1_000_000 ether;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/**
 * @title MockRevertingToken
 * @notice Reverts on every transfer to test clean error handling and no loss of funds.
 */
contract MockRevertingToken is ERC20 {
    constructor() ERC20("Reverting Token", "REVERT") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        revert("Simulated token transfer failure");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("Simulated token transferFrom failure");
    }
}

/**
 * @title MockFeeOnTransferToken
 * @notice Simulates deflationary / fee-on-transfer tokens (deducts 5% on transfer).
 */
contract MockFeeOnTransferToken is ERC20 {
    uint256 public feeBasisPoints = 500; // 5%

    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feeBasisPoints) / 10000;
        uint256 transferAmount = amount - fee;
        _transfer(msg.sender, address(0xdead), fee);
        _transfer(msg.sender, to, transferAmount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feeBasisPoints) / 10000;
        uint256 transferAmount = amount - fee;
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, address(0xdead), fee);
        _transfer(from, to, transferAmount);
        return true;
    }
}

interface IMultisenderTarget {
    function sendToken(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 totalAmount,
        bytes32 batchId,
        uint256 chunkIndex
    ) external;
}

/**
 * @title MockReentrantToken
 * @notice Attempts to re-enter Multisender.sol during transfer to test ReentrancyGuard.
 */
contract MockReentrantToken is ERC20 {
    address public multisenderTarget;
    bool public attackAttempted;

    constructor() ERC20("Reentrant Token", "REENT") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setTarget(address _target) external {
        multisenderTarget = _target;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (!attackAttempted && multisenderTarget != address(0)) {
            attackAttempted = true;
            address[] memory rec = new address[](1);
            rec[0] = address(0x123);
            uint256[] memory amt = new uint256[](1);
            amt[0] = 1 ether;
            // Attempt reentrancy
            IMultisenderTarget(multisenderTarget).sendToken(
                IERC20(address(this)),
                rec,
                amt,
                1 ether,
                bytes32(uint256(9999)),
                0
            );
        }
        return super.transferFrom(from, to, amount);
    }

}

/**
 * @title MockBlacklistToken
 * @notice Reverts if recipient address is blacklisted (simulates USDC/USDT freeze).
 */
contract MockBlacklistToken is ERC20 {
    mapping(address => bool) public isBlacklisted;

    constructor() ERC20("Blacklist Token", "BLIST") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setBlacklist(address account, bool blacklisted) external {
        isBlacklisted[account] = blacklisted;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!isBlacklisted[to], "Recipient is blacklisted");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!isBlacklisted[to], "Recipient is blacklisted");
        return super.transferFrom(from, to, amount);
    }
}
