// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CFDToken} from "./CFDToken.sol";
import {CrowdfundingCore} from "./CrowdfundingCore.sol";

contract CrowdfundingFuzzTest is Test {
    CFDToken token;
    CrowdfundingCore core;

    address treasury = makeAddr("treasury");
    address beneficiary = makeAddr("beneficiary");
    address alice = makeAddr("alice");

    uint256 constant GOAL = 10_000 ether; // objectif volontairement inatteignable

    function setUp() public {
        token = new CFDToken(address(this));
        core = new CrowdfundingCore(address(token), payable(treasury), address(this));
        token.grantRole(token.MINTER_ROLE(), address(core));
    }

    function _newCampaign(uint256 goal) internal returns (uint256 id) {
        vm.prank(beneficiary);
        id = core.createCampaign(goal, 1 days, "QmFuzz");
    }

    // Test 1 : le jeton frappe est toujours exactement montant x 1000
    function testFuzz_ContributionMintsExactly(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);
        uint256 id = _newCampaign(GOAL);

        vm.deal(alice, amount);
        vm.prank(alice);
        core.contribute{value: amount}(id);

        assertEq(token.balanceOf(alice), amount * 1000);
        assertEq(address(core).balance, amount);
        assertEq(core.contributions(id, alice), amount);
        assertEq(token.getVotes(alice), amount * 1000); // auto-delegation
    }

    // Test 2 : un remboursement rend toujours exactement la contribution
    function testFuzz_RefundReturnsExactAmount(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);
        uint256 id = _newCampaign(GOAL);

        vm.deal(alice, amount);
        vm.prank(alice);
        core.contribute{value: amount}(id);

        vm.warp(block.timestamp + 2 days); // la campagne echoue

        vm.prank(alice);
        core.refund(id);

        assertEq(alice.balance, amount);
        assertEq(address(core).balance, 0);
        assertEq(core.contributions(id, alice), 0);
    }

    // Test 3 : frais + versement = total, aucun wei perdu
    function testFuzz_WithdrawSplitsExactly(uint256 goal) public {
        goal = bound(goal, 1, 1000 ether);
        uint256 id = _newCampaign(goal);

        vm.deal(alice, goal);
        vm.prank(alice);
        core.contribute{value: goal}(id); // objectif atteint pile

        vm.warp(block.timestamp + 2 days);

        vm.prank(beneficiary);
        core.withdrawFunds(id);

        uint256 expectedFee = (goal * 200) / 10_000;
        assertEq(treasury.balance, expectedFee);
        assertEq(beneficiary.balance, goal - expectedFee);
        assertEq(treasury.balance + beneficiary.balance, goal);
        assertEq(address(core).balance, 0);
    }
}