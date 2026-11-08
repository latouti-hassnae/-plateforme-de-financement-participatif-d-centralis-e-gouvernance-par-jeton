// frontend/src/Treasury.tsx
// Coffre multisig 2-sur-3 : propriétaires, solde, transactions, signatures
import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther, isAddress } from "ethers";
import { ADDRESSES, TREASURY_ABI } from "./contracts";

type Tx = {
  id: number;
  to: string;
  value: bigint;
  executee: boolean;
  confirmations: number;
  moiConfirme: boolean;
};

const court = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Treasury() {
  const [proprietaires, setProprietaires] = useState<string[]>([]);
  const [limite, setLimite] = useState<bigint>(0n);
  const [solde, setSolde] = useState<bigint>(0n);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [moi, setMoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Formulaires
  const [destinataire, setDestinataire] = useState("");
  const [montant, setMontant] = useState("");
  const [depot, setDepot] = useState("");

  const charger = useCallback(async () => {
    try {
      if (!window.ethereum) {
        setErreur("MetaMask n'est pas installé");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const ms = new Contract(ADDRESSES.treasury, TREASURY_ABI, provider);

      const comptes = await provider.listAccounts();
      const compte = comptes.length > 0 ? comptes[0].address : null;
      setMoi(compte);

      setProprietaires(await ms.getOwners());
      setLimite(await ms.smallLimit());
      setSolde(await provider.getBalance(ADDRESSES.treasury));

      const n = Number(await ms.transactionCount());
      const liste: Tx[] = [];
      for (let id = 0; id < n; id++) {
        const t = await ms.transactions(id);
        const moiConfirme = compte ? await ms.confirmed(id, compte) : false;
        liste.push({
          id,
          to: t[0],
          value: t[1],
          executee: t[2],
          confirmations: Number(t[3]),
          moiConfirme,
        });
      }
      setTxs(liste.reverse()); // la plus récente en premier
      setErreur(null);
    } catch (e) {
      console.error(e);
      setErreur("Lecture impossible : vérifie le réseau Hardhat Local et l'adresse de la trésorerie");
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

  async function envoyer(action: (ms: Contract) => Promise<any>, succes: string) {
    setMessage("Confirme dans MetaMask…");
    try {
      setOccupe(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const ms = new Contract(ADDRESSES.treasury, TREASURY_ABI, signer);
      const tx = await action(ms);
      setMessage("Transaction envoyée, en attente de confirmation…");
      await tx.wait();
      setMessage(succes);
      await charger();
    } catch (e: any) {
      console.error(e);
      setMessage(`Échec : ${e?.reason ?? e?.shortMessage ?? e?.message ?? "transaction refusée"}`);
    } finally {
      setOccupe(false);
    }
  }

  async function deposer() {
    if (Number(depot) <= 0) {
      setMessage("Entre un montant à déposer");
      return;
    }
    setMessage("Confirme dans MetaMask…");
    try {
      setOccupe(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({ to: ADDRESSES.treasury, value: parseEther(depot) });
      await tx.wait();
      setMessage(`${depot} ETH déposés dans le coffre.`);
      setDepot("");
      await charger();
    } catch (e: any) {
      console.error(e);
      setMessage(`Échec : ${e?.reason ?? e?.shortMessage ?? e?.message ?? "transaction refusée"}`);
    } finally {
      setOccupe(false);
    }
  }

  function proposer() {
    if (!isAddress(destinataire) || Number(montant) <= 0) {
      setMessage("Entre une adresse valide et un montant supérieur à 0");
      return;
    }
    envoyer(
      (ms) => ms.submit(destinataire, parseEther(montant)),
      "Paiement proposé. Tu as confirmé d'office."
    ).then(() => setMontant(""));
  }

  const estProprietaire =
    !!moi && proprietaires.some((p) => p.toLowerCase() === moi.toLowerCase());

  return (
    <section style={{ padding: "0 24px 24px" }}>
      <h2>Coffre multisig</h2>
      {erreur && <p>{erreur}</p>}
      {message && <p>{message}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Règle 2-sur-3</h3>
        <div className="big">{Number(formatEther(solde)).toLocaleString("fr-FR")} ETH</div>
        <div className="caption">
          Un paiement jusqu'à {formatEther(limite)} ETH demande 1 signature. Au-dessus, il en faut 2 sur 3.
        </div>
        {proprietaires.map((p, i) => (
          <div className="caption" key={p}>
            Gardien {i + 1} : {court(p)}
            {moi && p.toLowerCase() === moi.toLowerCase() ? " (toi)" : ""}
          </div>
        ))}
        {!estProprietaire && moi && (
          <div className="caption">Le compte connecté n'est pas un gardien : lecture seule.</div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="Déposer (ETH)"
            value={depot}
            onChange={(e) => setDepot(e.target.value)}
            style={{ padding: 8, borderRadius: 8, width: 160 }}
          />
          <button className="btn" disabled={occupe} onClick={deposer}>
            Déposer dans le coffre
          </button>
        </div>
      </div>

      {estProprietaire && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Proposer un paiement</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Adresse du destinataire (0x…)"
              value={destinataire}
              onChange={(e) => setDestinataire(e.target.value)}
              style={{ padding: 8, borderRadius: 8, flex: 1, minWidth: 240 }}
            />
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="Montant (ETH)"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              style={{ padding: 8, borderRadius: 8, width: 140 }}
            />
            <button className="btn" disabled={occupe} onClick={proposer}>
              Proposer
            </button>
          </div>
        </div>
      )}

      {txs.length === 0 && !erreur && <p>Aucune transaction pour le moment.</p>}

      {txs.map((t) => {
        const besoin = t.value > limite ? 2 : 1;
        return (
          <div className="card" key={t.id} style={{ marginBottom: 16 }}>
            <h3>
              Transaction #{t.id} · {t.executee ? "Exécutée" : "En attente"}
            </h3>
            <div className="big" style={{ fontSize: 22 }}>
              {formatEther(t.value)} ETH → {court(t.to)}
            </div>
            <div className="caption">
              Signatures : {t.confirmations} / {besoin} nécessaires
            </div>

            {!t.executee && estProprietaire && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!t.moiConfirme ? (
                  <button
                    className="btn"
                    disabled={occupe}
                    onClick={() => envoyer((ms) => ms.confirm(t.id), "Signature ajoutée.")}
                  >
                    Signer
                  </button>
                ) : (
                  <button
                    className="btn"
                    disabled={occupe}
                    onClick={() => envoyer((ms) => ms.revoke(t.id), "Signature retirée.")}
                  >
                    Retirer ma signature
                  </button>
                )}
                <button
                  className="btn"
                  disabled={occupe}
                  onClick={() => envoyer((ms) => ms.execute(t.id), "Paiement exécuté.")}
                >
                  Exécuter le paiement
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}