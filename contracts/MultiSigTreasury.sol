// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MultiSigTreasury is ReentrancyGuard {
    uint256 public constant OWNERS_COUNT = 3;
    uint256 public constant REQUIRED_ABOVE_LIMIT = 2;

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public immutable smallLimit; // en wei

    struct Transaction {
        address to;
        uint256 value;
        bool executed;
        uint256 confirmations;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    event Deposit(address indexed from, uint256 amount);
    event Submitted(uint256 indexed txId, address indexed owner, address to, uint256 value);
    event Confirmed(uint256 indexed txId, address indexed owner);
    event Revoked(uint256 indexed txId, address indexed owner);
    event Executed(uint256 indexed txId);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "MS: not owner");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < transactions.length, "MS: unknown tx");
        _;
    }

    constructor(address[] memory owners_, uint256 smallLimit_) {
        require(owners_.length == OWNERS_COUNT, "MS: need 3 owners");
        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            require(o != address(0), "MS: zero owner");
            require(!isOwner[o], "MS: duplicate owner");
            isOwner[o] = true;
            owners.push(o);
        }
        smallLimit = smallLimit_;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submit(address to, uint256 value) external onlyOwner returns (uint256 txId) {
        require(to != address(0), "MS: zero destination");
        txId = transactions.length;
        transactions.push(Transaction({to: to, value: value, executed: false, confirmations: 1}));
        confirmed[txId][msg.sender] = true; // le proposant confirme d'office
        emit Submitted(txId, msg.sender, to, value);
    }

    function confirm(uint256 txId) external onlyOwner txExists(txId) {
        Transaction storage t = transactions[txId];
        require(!t.executed, "MS: already executed");
        require(!confirmed[txId][msg.sender], "MS: already confirmed");
        confirmed[txId][msg.sender] = true;
        t.confirmations += 1;
        emit Confirmed(txId, msg.sender);
    }

    function revoke(uint256 txId) external onlyOwner txExists(txId) {
        Transaction storage t = transactions[txId];
        require(!t.executed, "MS: already executed");
        require(confirmed[txId][msg.sender], "MS: not confirmed");
        confirmed[txId][msg.sender] = false;
        t.confirmations -= 1;
        emit Revoked(txId, msg.sender);
    }

    function execute(uint256 txId) external onlyOwner nonReentrant txExists(txId) {
        Transaction storage t = transactions[txId];
        require(!t.executed, "MS: already executed");

        uint256 needed = t.value > smallLimit ? REQUIRED_ABOVE_LIMIT : 1;
        require(t.confirmations >= needed, "MS: not enough confirmations");

        t.executed = true; // Effects avant Interactions
        (bool ok, ) = payable(t.to).call{value: t.value}("");
        require(ok, "MS: transfer failed");

        emit Executed(txId);
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function transactionCount() external view returns (uint256) {
        return transactions.length;
    }
}