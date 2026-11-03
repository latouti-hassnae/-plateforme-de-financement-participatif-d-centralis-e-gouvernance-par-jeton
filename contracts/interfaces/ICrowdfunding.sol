// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICrowdfunding {
    function approveEarlyRelease(uint256 campaignId) external;
    function freezeCampaign(uint256 campaignId) external;
}