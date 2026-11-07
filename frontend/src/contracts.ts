// frontend/src/contracts.ts
// Adresses issues de : npx hardhat run scripts/deploy.ts --network localhost
// (valables tant que le nœud local n'est pas relancé)
import CoreArtifact from "./abi/CrowdfundingCore.json";
import TokenArtifact from "./abi/CFDToken.json";
import GovernanceArtifact from "./abi/Governance.json";
import TreasuryArtifact from "./abi/MultiSigTreasury.json";
export const ADDRESSES = {
  token: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  treasury: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  core: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  governance: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
};

// ABI générés à la compilation (copiés depuis artifacts/ vers src/abi/)
export const CORE_ABI = CoreArtifact.abi;
export const TOKEN_ABI = TokenArtifact.abi;
export const GOVERNANCE_ABI = GovernanceArtifact.abi;
export const TREASURY_ABI = TreasuryArtifact.abi;