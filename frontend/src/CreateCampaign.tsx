import { useState } from "react";
import { BrowserProvider, Contract, parseEther } from "ethers";
import { ADDRESSES, CORE_ABI } from "./contracts";
import { uploadMetadata } from "./ipfs";

export default function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [objectif, setObjectif] = useState("");
  const [jours, setJours] = useState("30");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function creer() {
    if (!titre || !description || Number(objectif) <= 0 || Number(jours) <= 0) {
      setMessage("Remplis tous les champs avec des valeurs valides");
      return;
    }
    try {
      setEnCours(true);
      setMessage("Envoi des métadonnées sur IPFS…");
      const cid = await uploadMetadata(titre, description);

      setMessage("Création de la campagne, confirme dans MetaMask…");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const core = new Contract(ADDRESSES.core, CORE_ABI, signer);

      // ⚠️ À ADAPTER à la signature réelle de createCampaign (voir CORE_ABI)
      const tx = await core.createCampaign(
        parseEther(objectif),
        BigInt(Number(jours) * 24 * 3600),
        cid
      );
      await tx.wait();

      setMessage(`Campagne créée. CID IPFS : ${cid}`);
      setTitre(""); setDescription(""); setObjectif("");
      onCreated();
    } catch (e: any) {
      console.error(e);
      setMessage(`Échec : ${e?.reason ?? e?.shortMessage ?? e?.message ?? "erreur"}`);
    } finally {
      setEnCours(false);
    }
  }

  const champ = { padding: 8, borderRadius: 8, width: "100%", marginBottom: 8 } as const;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3>Créer une campagne</h3>
      <input style={champ} placeholder="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      <textarea style={champ} rows={3} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input style={champ} type="number" min="0" step="0.1" placeholder="Objectif en ETH" value={objectif} onChange={(e) => setObjectif(e.target.value)} />
      <input style={champ} type="number" min="1" placeholder="Durée en jours" value={jours} onChange={(e) => setJours(e.target.value)} />
      <button className="btn" disabled={enCours} onClick={creer}>
        {enCours ? "En cours…" : "Créer la campagne"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}