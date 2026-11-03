// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICrowdfunding} from "../interfaces/ICrowdfunding.sol";

contract MockCore is ICrowdfunding {
    mapping(uint256 => bool) public released;
    mapping(uint256 => bool) public frozen;

    function approveEarlyRelease(uint256 id) external { released[id] = true; }
    function freezeCampaign(uint256 id) external { frozen[id] = true; }
}