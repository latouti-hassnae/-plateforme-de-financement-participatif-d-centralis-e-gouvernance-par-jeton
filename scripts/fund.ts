import { network } from "hardhat";

const { ethers } = await network.connect({ network: "localhost" });

const [deployer] = await ethers.getSigners();
const to = process.env.TO as string;

if (!to) {
  throw new Error("Variable TO manquante : $env:TO=\"0x...\"");
}

const tx = await deployer.sendTransaction({
  to,
  value: ethers.parseEther("100"),
});
await tx.wait();
console.log("100 ETH envoyés à", to);