import { network } from "hardhat";
import { writeFileSync } from "node:fs";

const { ethers } = await network.connect({ network: "sepolia" });

const OWNER_2 = "0x8aD55b83d6D095f80543a84eFd43bb870bF72c6B";
const OWNER_3 = "0xea68F31C84fE72d74f9240455Bb7381f97524FA0";

const [admin] = await ethers.getSigners();
const owner2 = ethers.getAddress(OWNER_2); // vérifie le format
const owner3 = ethers.getAddress(OWNER_3);

const solde = await ethers.provider.getBalance(admin.address);
console.log("Déployeur :", admin.address);
console.log("Solde     :", ethers.formatEther(solde), "ETH");

// 1. Token CFD
const token = await ethers.deployContract("CFDToken", [admin.address]);
await token.waitForDeployment();
console.log("CFDToken         :", await token.getAddress());

// 2. Trésorerie multisig 2-sur-3 (smallLimit = 0.01 ETH)
const treasury = await ethers.deployContract("MultiSigTreasury", [
  [admin.address, owner2, owner3],
  ethers.parseEther("0.01"),
]);
await treasury.waitForDeployment();
console.log("MultiSigTreasury :", await treasury.getAddress());

// 3. Core
const core = await ethers.deployContract("CrowdfundingCore", [
  await token.getAddress(),
  await treasury.getAddress(),
  admin.address,
]);
await core.waitForDeployment();
console.log("CrowdfundingCore :", await core.getAddress());

// 4. Governance
const governance = await ethers.deployContract("Governance", [
  await token.getAddress(),
  await core.getAddress(),
]);
await governance.waitForDeployment();
console.log("Governance       :", await governance.getAddress());

// 5. Rôles
await (await token.grantRole(await token.MINTER_ROLE(), await core.getAddress())).wait();
console.log("MINTER_ROLE donné au Core");
await (await core.grantRole(await core.GOVERNANCE_ROLE(), await governance.getAddress())).wait();
console.log("GOVERNANCE_ROLE donné à Governance");

// 6. Sauvegarde des adresses
const adresses = {
  network: "sepolia",
  chainId: 11155111,
  deployer: admin.address,
  token: await token.getAddress(),
  treasury: await treasury.getAddress(),
  core: await core.getAddress(),
  governance: await governance.getAddress(),
};
writeFileSync("docs/sepolia-addresses.json", JSON.stringify(adresses, null, 2));
console.log("Adresses enregistrées dans docs/sepolia-addresses.json");

const reste = await ethers.provider.getBalance(admin.address);
console.log("Solde restant :", ethers.formatEther(reste), "ETH");