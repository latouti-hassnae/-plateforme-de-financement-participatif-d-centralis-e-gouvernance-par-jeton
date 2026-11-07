import { network } from "hardhat";

const { ethers } = await network.connect({ network: "sepolia" });

const [compte] = await ethers.getSigners();
const reseau = await ethers.provider.getNetwork();
const solde = await ethers.provider.getBalance(compte.address);
const hote = new URL(process.env.SEPOLIA_RPC_URL as string).hostname;

console.log("Hôte RPC     :", hote);
console.log("Chain ID     :", reseau.chainId.toString(), "(Sepolia = 11155111)");
console.log("Compte       :", compte.address);
console.log("Solde (ETH)  :", ethers.formatEther(solde));