const JWT = import.meta.env.VITE_PINATA_JWT;

export async function uploadMetadata(title: string, description: string): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify({
      pinataContent: { title, description },
      pinataMetadata: { name: `campagne-${title}` },
    }),
  });
  if (!res.ok) throw new Error("Échec de l'upload IPFS");
  const data = await res.json();
  return data.IpfsHash; // le CID, seul élément stocké on-chain
}

export function ipfsUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}