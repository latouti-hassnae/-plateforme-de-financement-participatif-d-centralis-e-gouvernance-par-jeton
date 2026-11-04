// scripts/deploy.ts
// Déploiement local avec les VRAIS contrats (plus de mocks)
import { network } from "hardhat";

const { ethers } = await network.connect({ network: "localhost" });

const ETH = ethers.parseEther;
const JOUR = 24 * 3600;

// Comptes Hardhat : #0, #1, #2 = propriétaires du multisig et votants de démo,
// #3 = porteur de la campagne de démonstration
const [admin, owner2, owner3, porteur] = await ethers.getSigners();

// 1. Token CFD
const token = await ethers.deployContract("CFDToken", [admin.address]);
await token.waitForDeployment();

// 2. Trésorerie multisig 2-sur-3 (smallLimit = 1 ETH)
const treasury = await ethers.deployContract("MultiSigTreasury", [
  [admin.address, owner2.address, owner3.address],
  ETH("1"),
]);
await treasury.waitForDeployment();

// 3. Core : constructor(token, treasury, admin)
const core = await ethers.deployContract("CrowdfundingCore", [
  await token.getAddress(),
  await treasury.getAddress(),
  admin.address,
]);
await core.waitForDeployment();

// 4. Governance : constructor(token, core)
const governance = await ethers.deployContract("Governance", [
  await token.getAddress(),
  await core.getAddress(),
]);
await governance.waitForDeployment();

// 5. Rôles : le Core mint les CFD, la Governance commande le Core
await (await token.grantRole(await token.MINTER_ROLE(), await core.getAddress())).wait();
await (await core.grantRole(await core.GOVERNANCE_ROLE(), await governance.getAddress())).wait();

// 6. Campagne de démonstration (id 1) : objectif 10 ETH, 30 jours
await (
  await core.connect(porteur).createCampaign(ETH("10"), 30 * JOUR, "ipfs://demo-cid-placeholder")
).wait();

// 7. Contributions de démonstration : sans elles, personne n'a de CFD pour voter
await (await core.connect(admin).contribute(1, { value: ETH("3") })).wait();
await (await core.connect(owner2).contribute(1, { value: ETH("2") })).wait();
await (await core.connect(owner3).contribute(1, { value: ETH("1") })).wait();

// 8. Résumé
console.log("CFDToken         :", await token.getAddress());
console.log("MultiSigTreasury :", await treasury.getAddress());
console.log("CrowdfundingCore :", await core.getAddress());
console.log("Governance       :", await governance.getAddress());
console.log("---");
console.log("Campagne 1, collecté (wei) :", (await core.getCampaign(1)).raised.toString());
for (const [nom, s] of [["Compte #0", admin], ["Compte #1", owner2], ["Compte #2", owner3]] as const) {
  const solde = await token.balanceOf(s.address);
  console.log(nom, s.address, "->", ethers.formatEther(solde), "CFD");
}