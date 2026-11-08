// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICFDToken {
    function mintForContribution(address to, uint256 weiAmount) external returns (uint256 minted);
}