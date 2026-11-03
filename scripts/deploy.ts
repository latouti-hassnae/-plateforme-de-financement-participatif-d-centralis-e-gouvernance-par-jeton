import { network } from "hardhat";

const { ethers } = await network.connect({ network: "localhost" });

const token = await ethers.deployContract("MockToken");
await token.waitForDeployment();

const core = await ethers.deployContract("MockCore");
await core.waitForDeployment();

const governance = await ethers.deployContract("Governance", [
  await token.getAddress(),
  await core.getAddress(),
]);
await governance.waitForDeployment();

// Donne des jetons de test aux 3 premiers comptes et active leur vote
const signers = await ethers.getSigners();
for (const s of signers.slice(0, 3)) {
  await token.mint(s.address, ethers.parseEther("1000"));
  await token.connect(s).delegate(s.address);
}

console.log("MockToken  :", await token.getAddress());
console.log("MockCore   :", await core.getAddress());
console.log("Governance :", await governance.getAddress());