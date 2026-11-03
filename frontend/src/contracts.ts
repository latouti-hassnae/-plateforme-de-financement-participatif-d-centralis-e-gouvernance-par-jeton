export const ADDRESSES = {
  token: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  core: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  governance: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

// ABI minimal : seulement les fonctions dont le front a besoin
export const GOVERNANCE_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256) view returns (uint256 campaignId, uint8 pType, string description, uint256 snapshotBlock, uint256 deadline, uint256 quorumVotes, uint256 forVotes, uint256 againstVotes, bool executed)",
  "function hasVoted(uint256, address) view returns (bool)",
  "function propose(uint256 campaignId, uint8 pType, string description) returns (uint256)",
  "function vote(uint256 id, bool support)",
  "function execute(uint256 id)",
];

export const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function getVotes(address) view returns (uint256)",
];