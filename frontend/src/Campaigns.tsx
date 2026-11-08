// frontend/src/Campaigns.tsx
// Liste des campagnes (lecture du Core) + création + contribution + remboursement + retrait
import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import { ADDRESSES, CORE_ABI, TOKEN_ABI } from "./contracts";
import { fetchMetadata, type Metadata } from "./ipfs";
import CreateCampaign from "./CreateCampaign";

// Même ordre que l'enum Status du contrat : Active, Successful, Failed, Cancelled
const STATUTS = ["En cours", "Réussie", "Échouée", "Annulée"];

type Campagne = {
  id: number;
  beneficiaire: string;
  objectif: bigint;
  collecte: bigint;
  echeance: bigint;
  cid: string;
  statut: number;
  retiree: boolean;
};

export default function Campaigns() {
  const [liste, setListe] = useState<Campagne[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [montants, setMontants] = useState<Record<number, string>>({});
  const [envoiEnCours, setEnvoiEnCours] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageCarte, setMessageCarte] = useState<{ id: number; texte: string } | null>(null);
  const [metas, setMetas] = useState<Record<number, Metadata | null>>({});
  const [moi, setMoi] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      if (!window.ethereum) {
        setErreur("MetaMask n'est pas installé");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const core = new Contract(ADDRESSES.core, CORE_ABI, provider);

      // Compte actuellement connecté (pour reconnaître le bénéficiaire)
      const comptes = await provider.listAccounts();
      setMoi(comptes.length > 0 ? comptes[0].address : null);

      const total = Number(await core.campaignCount());
      const resultat: Campagne[] = [];
      // Les ids du Core commencent à 1
      for (let id = 1; id <= total; id++) {
        const c = await core.getCampaign(id);
        const statut = Number(await core.getStatus(id));
        resultat.push({
          id,
          beneficiaire: c.beneficiary,
          objectif: c.goal,
          collecte: c.raised,
          echeance: c.deadline,
          cid: c.ipfsHash,
          statut,
          retiree: Boolean(c.withdrawn),
        });
      }
      setListe(resultat);

      // Lecture des métadonnées (titre, description) depuis IPFS
      const m: Record<number, Metadata | null> = {};
      await Promise.all(
        resultat.map(async (c) => {
          m[c.id] = await fetchMetadata(c.cid);
        })
      );
      setMetas(m);

      setErreur(null);
    } catch (e) {
      console.error(e);
      setErreur("Lecture impossible : vérifie le réseau Hardhat Local et les adresses");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);
  // Recharge quand le compte MetaMask change
  useEffect(() => {
    if (!window.ethereum) return;
    const surChangement = () => {
      charger();
    };
    window.ethereum.on("accountsChanged", surChangement);
    return () => window.ethereum.removeListener("accountsChanged", surChangement);
  }, [charger]);
  async function contribuer(id: number) {
    setMessage(null);
    const montant = montants[id];
    if (!montant || Number(montant) <= 0) {
      setMessage("Entre un montant en ETH supérieur à 0");
      return;
    }
    try {
      setEnvoiEnCours(id);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner(); // demande le compte à MetaMask
      const core = new Contract(ADDRESSES.core, CORE_ABI, signer);

      // contribute est "payable" : l'ETH part avec la transaction (value)
      const tx = await core.contribute(id, { value: parseEther(montant) });
      setMessage("Transaction envoyée, en attente de confirmation…");
      await tx.wait();

      // Le Core a minté des CFD : on relit le solde du contributeur
      const token = new Contract(ADDRESSES.token, TOKEN_ABI, provider);
      const solde = await token.balanceOf(await signer.getAddress());
      setMessage(`Contribution confirmée. Ton solde : ${formatEther(solde)} CFD`);
      setMontants({ ...montants, [id]: "" });
      await charger();
    } catch (e: any) {
      console.error(e);
      setMessage(`Échec : ${e?.reason ?? e?.shortMessage ?? "transaction refusée"}`);
    } finally {
      setEnvoiEnCours(null);
    }
  }

  // Remboursement (campagne échouée ou annulée) ou retrait (campagne réussie)
  async function agir(id: number, action: "refund" | "withdrawFunds") {
    setMessageCarte({ id, texte: "Envoi en cours, confirme dans MetaMask…" });
    try {
      setEnvoiEnCours(id);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const core = new Contract(ADDRESSES.core, CORE_ABI, signer);

      const tx = await core[action](id);
      setMessageCarte({ id, texte: "Transaction envoyée, en attente de confirmation…" });
      await tx.wait();

      setMessageCarte({
        id,
        texte:
          action === "refund"
            ? `Remboursement effectué pour la campagne #${id}.`
            : `Fonds retirés pour la campagne #${id} (98 % au bénéficiaire, 2 % à la trésorerie).`,
      });
      await charger();
    } catch (e: any) {
      console.error(e);
      setMessageCarte({
        id,
        texte: `Échec : ${e?.reason ?? e?.shortMessage ?? e?.message ?? "transaction refusée"}`,
      });
    } finally {
      setEnvoiEnCours(null);
    }
  }

  return (
    <section style={{ padding: "0 24px 24px" }}>
      <h2>Campagnes</h2>

      <CreateCampaign onCreated={charger} />

      {chargement && <p>Chargement…</p>}
      {erreur && <p>{erreur}</p>}
      {message && <p>{message}</p>}
      {!chargement && !erreur && liste.length === 0 && <p>Aucune campagne pour le moment.</p>}

      {liste.map((c) => {
        const pourcent = c.objectif > 0n ? Number((c.collecte * 100n) / c.objectif) : 0;
        const meta = metas[c.id];
        const estBeneficiaire = !!moi && moi.toLowerCase() === c.beneficiaire.toLowerCase();
        return (
          <div className="card" key={c.id} style={{ marginBottom: 16 }}>
            <h3>
              Campagne #{c.id} · {STATUTS[c.statut]}
              {c.retiree ? " · fonds retirés" : ""}
            </h3>
            <div className="big">
              {formatEther(c.collecte)} / {formatEther(c.objectif)} ETH
            </div>
            <div className="vote-bar">
              <div className="vote-yes" style={{ width: `${Math.min(pourcent, 100)}%` }} />
            </div>
            <div className="caption">
              {pourcent} % de l'objectif · échéance{" "}
              {new Date(Number(c.echeance) * 1000).toLocaleDateString("fr-FR")}
            </div>
            <div className="caption">
              Bénéficiaire : {c.beneficiaire.slice(0, 6)}…{c.beneficiaire.slice(-4)}
              {estBeneficiaire ? " (toi)" : ""}
            </div>

            {meta ? (
              <>
                <h4>{meta.title}</h4>
                <p>{meta.description}</p>
              </>
            ) : (
              <div className="caption">Métadonnées indisponibles (CID : {c.cid})</div>
            )}

            {c.statut === 0 && (
              <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Montant en ETH"
                  value={montants[c.id] ?? ""}
                  onChange={(e) => setMontants({ ...montants, [c.id]: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, width: 160 }}
                />
                <button className="btn" disabled={envoiEnCours === c.id} onClick={() => contribuer(c.id)}>
                  {envoiEnCours === c.id ? "Envoi…" : "Contribuer"}
                </button>
              </div>
            )}

            {/* Campagne échouée ou annulée : chaque contributeur peut se faire rembourser */}
            {(c.statut === 2 || c.statut === 3) && (
              <div style={{ marginTop: 16 }}>
                <button className="btn" disabled={envoiEnCours === c.id} onClick={() => agir(c.id, "refund")}>
                  {envoiEnCours === c.id ? "Envoi…" : "Se faire rembourser"}
                </button>
                <div className="caption">Possible seulement si tu as contribué avec le compte connecté.</div>
              </div>
            )}

            {/* Campagne réussie : le bénéficiaire retire les fonds */}
            {c.statut === 1 && !c.retiree && estBeneficiaire && (
              <div style={{ marginTop: 16 }}>
                <button className="btn" disabled={envoiEnCours === c.id} onClick={() => agir(c.id, "withdrawFunds")}>
                  {envoiEnCours === c.id ? "Envoi…" : "Retirer les fonds"}
                </button>
                <div className="caption">
                  Possible après l'échéance, ou avant si la gouvernance a approuvé le déblocage anticipé.
                </div>
              </div>
            )}

            {/* Résultat de la dernière action sur cette carte */}
            {messageCarte?.id === c.id && <p>{messageCarte.texte}</p>}
          </div>
        );
      })}
    </section>
  );
}