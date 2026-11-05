// scripts/advance-time.ts
// Avance l'horloge de la blockchain locale de 3 jours (+ 1 seconde)
// pour pouvoir exécuter une proposition pendant la démonstration.
import { network } from "hardhat";

const { ethers } = await network.connect({ network: "localhost" });

await ethers.provider.send("evm_increaseTime", [3 * 24 * 3600 + 1]);
await ethers.provider.send("evm_mine", []);

const bloc = await ethers.provider.getBlock("latest");
console.log("Temps avancé de 3 jours. Nouvelle date de la chaîne :", new Date(bloc!.timestamp * 1000).toLocaleString("fr-FR"));