// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICore {
    function createCampaign(uint256 goal, uint256 durationSeconds, string calldata ipfsHash) external returns (uint256);
    function contribute(uint256 id) external payable;
    function refund(uint256 id) external;
    function withdrawFunds(uint256 id) external;
}

// CONTRAT DE TEST UNIQUEMENT : il simule un pirate.
contract ReentrancyAttacker {
    enum Mode { None, Refund, Withdraw }

    ICore public immutable core;
    Mode public mode;
    uint256 public targetId;
    uint256 public attempts;       // combien de fois le pirate a retente
    bool public reentryBlocked;    // vrai si le contrat a refuse la 2e tentative

    constructor(address core_) {
        core = ICore(core_);
    }

    function createCampaign(uint256 goal, uint256 duration, string calldata hash) external returns (uint256) {
        return core.createCampaign(goal, duration, hash);
    }

    function contribute(uint256 id) external payable {
        core.contribute{value: msg.value}(id);
    }

    function attackRefund(uint256 id) external {
        mode = Mode.Refund;
        targetId = id;
        core.refund(id);
    }

    function attackWithdraw(uint256 id) external {
        mode = Mode.Withdraw;
        targetId = id;
        core.withdrawFunds(id);
    }

    // Se declenche automatiquement quand le pirate recoit de l'ETH
    receive() external payable {
        if (mode == Mode.None || attempts >= 1) return;
        attempts += 1;

        if (mode == Mode.Refund) {
            try core.refund(targetId) {} catch { reentryBlocked = true; }
        } else {
            try core.withdrawFunds(targetId) {} catch { reentryBlocked = true; }
        }
    }
}