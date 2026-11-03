// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract CFDToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// 1 ETH contribué = 1000 CFD
    uint256 public constant RATE = 1000;

    constructor(address admin)
        ERC20("Crowdfunding DAO Token", "CFD")
        ERC20Permit("Crowdfunding DAO Token")
    {
        require(admin != address(0), "CFD: admin is zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mintForContribution(address to, uint256 weiAmount)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 minted)
    {
        minted = weiAmount * RATE;
        _mint(to, minted);

        // Auto-délégation : sans elle, ERC20Votes ne compte aucun pouvoir de vote
        if (delegates(to) == address(0)) {
            _delegate(to, to);
        }
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}