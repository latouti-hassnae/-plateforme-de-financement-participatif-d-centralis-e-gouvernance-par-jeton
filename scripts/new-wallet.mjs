import { Wallet } from "ethers";
import { appendFileSync } from "node:fs";

const wallet = Wallet.createRandom();
appendFileSync(".env", `\nSEPOLIA_PRIVATE_KEY=${wallet.privateKey}\n`);
console.log("Compte de test créé. Adresse publique :", wallet.address);
console.log("La clé privée a été écrite dans .env (non affichée).");