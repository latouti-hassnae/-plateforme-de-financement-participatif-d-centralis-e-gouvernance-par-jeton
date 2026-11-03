// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICFDToken {
    function mintForContribution(address to, uint256 weiAmount) external;
}

contract CrowdfundingCore is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public constant FEE_BPS = 200; // 2 %
    uint256 public constant BPS_DENOMINATOR = 10_000;

    enum Status { Active, Successful, Failed, Cancelled }

    struct Campaign {
        address payable beneficiary;
        uint256 goal;
        uint256 deadline;
        uint256 raised;
        string ipfsHash;
        bool frozen;
        bool earlyReleaseApproved;
        bool withdrawn;
    }

    ICFDToken public immutable token;
    address payable public immutable treasury;

    uint256 public campaignCount;
    mapping(uint256 => Campaign) private campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    event CampaignCreated(uint256 indexed id, address indexed beneficiary, uint256 goal, uint256 deadline, string ipfsHash);
    event Contributed(uint256 indexed id, address indexed contributor, uint256 amount);
    event Refunded(uint256 indexed id, address indexed contributor, uint256 amount);
    event FundsWithdrawn(uint256 indexed id, address indexed beneficiary, uint256 payout, uint256 fee);
    event EarlyReleaseApproved(uint256 indexed id);
    event CampaignFrozen(uint256 indexed id);

    constructor(address token_, address payable treasury_, address admin) {
        require(token_ != address(0), "Token invalide");
        require(treasury_ != address(0), "Tresorerie invalide");
        require(admin != address(0), "Admin invalide");

        token = ICFDToken(token_);
        treasury = treasury_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ------------------------------------------------------------------
    // Circuit breaker
    // ------------------------------------------------------------------

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ------------------------------------------------------------------
    // Campagnes
    // ------------------------------------------------------------------

    function createCampaign(
        uint256 goal,
        uint256 durationSeconds,
        string calldata ipfsHash
    ) external whenNotPaused returns (uint256 id) {
        require(goal > 0, "Objectif nul");
        require(durationSeconds > 0, "Duree nulle");
        require(bytes(ipfsHash).length > 0, "Hash IPFS vide");

        campaignCount += 1;
        id = campaignCount;

        uint256 deadline = block.timestamp + durationSeconds;

        campaigns[id] = Campaign({
            beneficiary: payable(msg.sender),
            goal: goal,
            deadline: deadline,
            raised: 0,
            ipfsHash: ipfsHash,
            frozen: false,
            earlyReleaseApproved: false,
            withdrawn: false
        });

        emit CampaignCreated(id, msg.sender, goal, deadline, ipfsHash);
    }

    function contribute(uint256 id) external payable whenNotPaused nonReentrant {
        Campaign storage c = campaigns[id];
        require(c.beneficiary != address(0), "Campagne inexistante");
        require(msg.value > 0, "Montant nul");
        require(!c.frozen, "Campagne gelee");
        require(!c.withdrawn, "Fonds deja retires");
        require(block.timestamp < c.deadline, "Campagne terminee");

        // Effects
        c.raised += msg.value;
        contributions[id][msg.sender] += msg.value;

        // Interactions
        token.mintForContribution(msg.sender, msg.value);

        emit Contributed(id, msg.sender, msg.value);
    }

    function refund(uint256 id) external whenNotPaused nonReentrant {
        Campaign storage c = campaigns[id];
        require(c.beneficiary != address(0), "Campagne inexistante");

        Status s = getStatus(id);
        require(s == Status.Failed || s == Status.Cancelled, "Remboursement impossible");

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Rien a rembourser");

        // Effects
        contributions[id][msg.sender] = 0;

        // Interactions
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Echec du remboursement");

        emit Refunded(id, msg.sender, amount);
    }

    function withdrawFunds(uint256 id) external whenNotPaused nonReentrant {
        Campaign storage c = campaigns[id];
        require(c.beneficiary != address(0), "Campagne inexistante");
        require(msg.sender == c.beneficiary, "Beneficiaire uniquement");
        require(!c.withdrawn, "Fonds deja retires");
        require(getStatus(id) == Status.Successful, "Objectif non atteint");
        require(
            block.timestamp >= c.deadline || c.earlyReleaseApproved,
            "Echeance non atteinte"
        );

        // Effects
        c.withdrawn = true;
        uint256 total = c.raised;
        uint256 fee = (total * FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = total - fee;

        // Interactions
        (bool okFee, ) = treasury.call{value: fee}("");
        require(okFee, "Echec frais tresorerie");

        (bool okPay, ) = c.beneficiary.call{value: payout}("");
        require(okPay, "Echec du retrait");

        emit FundsWithdrawn(id, c.beneficiary, payout, fee);
    }

    // ------------------------------------------------------------------
    // Fonctions reservees a la gouvernance
    // ------------------------------------------------------------------

    function approveEarlyRelease(uint256 id) external onlyRole(GOVERNANCE_ROLE) {
        Campaign storage c = campaigns[id];
        require(c.beneficiary != address(0), "Campagne inexistante");
        require(!c.withdrawn, "Fonds deja retires");

        c.earlyReleaseApproved = true;
        emit EarlyReleaseApproved(id);
    }

    function freezeCampaign(uint256 id) external onlyRole(GOVERNANCE_ROLE) {
        Campaign storage c = campaigns[id];
        require(c.beneficiary != address(0), "Campagne inexistante");
        require(!c.withdrawn, "Fonds deja retires");

        c.frozen = true;
        emit CampaignFrozen(id);
    }

    // ------------------------------------------------------------------
    // Lecture
    // ------------------------------------------------------------------

    function getStatus(uint256 id) public view returns (Status) {
        Campaign storage c = campaigns[id];
        require(c.beneficiary != address(0), "Campagne inexistante");

        if (c.frozen) return Status.Cancelled;
        if (c.raised >= c.goal) return Status.Successful;
        if (block.timestamp < c.deadline) return Status.Active;
        return Status.Failed;
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        require(campaigns[id].beneficiary != address(0), "Campagne inexistante");
        return campaigns[id];
    }
}