// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICrowdfunding} from "../interfaces/ICrowdfunding.sol";

contract MockCore is ICrowdfunding {
    mapping(uint256 => bool) public released;
    mapping(uint256 => bool) public frozen;

    // Nombre de campagnes simulées : les ids 1 à 3 "existent"
    uint256 public campaignCount = 3;

    function approveEarlyRelease(uint256 id) external { released[id] = true; }
    function freezeCampaign(uint256 id) external { frozen[id] = true; }
}