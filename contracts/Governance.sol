// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICrowdfunding} from "./interfaces/ICrowdfunding.sol";

contract Governance is ReentrancyGuard {
    enum ProposalType { EarlyRelease, Freeze }

    struct Proposal {
        uint256 campaignId;
        ProposalType pType;
        string description;
        uint256 snapshotBlock;   // solde figé ici (anti-manipulation)
        uint256 deadline;
        uint256 quorumVotes;     // calculé à la création
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
    }

    IVotes public immutable token;
    ICrowdfunding public immutable core;

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant QUORUM_BPS = 1000; // 10 %

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed id, uint256 indexed campaignId, ProposalType pType, uint256 snapshotBlock, uint256 deadline);
    event Voted(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event Executed(uint256 indexed id);

    constructor(address _token, address _core) {
        token = IVotes(_token);
        core = ICrowdfunding(_core);
    }

    function propose(uint256 campaignId, ProposalType pType, string calldata description)
        external returns (uint256 id)
    {
        uint256 snap = block.number - 1;
        require(token.getPastVotes(msg.sender, snap) > 0, "No voting power");

        id = ++proposalCount;
        Proposal storage p = proposals[id];
        p.campaignId = campaignId;
        p.pType = pType;
        p.description = description;
        p.snapshotBlock = snap;
        p.deadline = block.timestamp + VOTING_PERIOD;
        p.quorumVotes = (token.getPastTotalSupply(snap) * QUORUM_BPS) / 10_000;

        emit ProposalCreated(id, campaignId, pType, snap, p.deadline);
    }

    function vote(uint256 id, bool support) external {
        Proposal storage p = proposals[id];
        require(p.snapshotBlock != 0, "Unknown proposal");
        require(block.timestamp < p.deadline, "Voting closed");
        require(!hasVoted[id][msg.sender], "Already voted");

        uint256 weight = token.getPastVotes(msg.sender, p.snapshotBlock);
        require(weight > 0, "No voting power at snapshot");

        hasVoted[id][msg.sender] = true;
        if (support) p.forVotes += weight; else p.againstVotes += weight;

        emit Voted(id, msg.sender, support, weight);
    }

    function execute(uint256 id) external nonReentrant {
        Proposal storage p = proposals[id];
        require(p.snapshotBlock != 0, "Unknown proposal");
        require(block.timestamp >= p.deadline, "Voting not ended");
        require(!p.executed, "Already executed");
        require(p.forVotes + p.againstVotes >= p.quorumVotes, "Quorum not reached");
        require(p.forVotes > p.againstVotes, "Majority not reached");

        p.executed = true; // Effects avant Interactions

        if (p.pType == ProposalType.EarlyRelease) core.approveEarlyRelease(p.campaignId);
        else core.freezeCampaign(p.campaignId);

        emit Executed(id);
    }
}