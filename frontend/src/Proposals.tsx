// frontend/src/Proposals.tsx
// Tableau de vote de la gouvernance : lecture, vote, exécution, création
import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { ADDRESSES, GOVERNANCE_ABI } from "./contracts";

// Ordre vérifié par les tests d'intégration : 0 = déblocage anticipé, 1 = gel
const TYPES = ["Déblocage anticipé", "Gel de la campagne"];

type Proposition = {
  id: number;
  campagne: bigint;
  type: number;
  description: string;
  deadline: bigint;
  quorum: bigint;
  pour: bigint;
  contre: bigint;
  executee: boolean;
  aVote: boolean;
};

function tempsRestant(secondes: number): string {
  const j = Math.floor(secondes / 86400);
  const h = Math.floor((secondes % 86400) / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  return `${j} j ${h} h ${m} min`;
}

export default function Proposals() {
  const [liste, setListe] = useState<Proposition[]>([]);
  const [maintenant, setMaintenant] = useState<bigint>(0n);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Formulaire de création
  const [campagneId, setCampagneId] = useState("1");
  const [type, setType] = useState("0");
  const [description, setDescription] = useState("");

  const charger = useCallback(async () => {
    try {
      if (!window.ethereum) {
        setErreur("MetaMask n'est pas installé");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const gov = new Contract(ADDRESSES.governance, GOVERNANCE_ABI, provider);

      // Le temps de la blockchain (et non celui de l'ordinateur) décide de la fin du vote
      const bloc = await provider.getBlock("latest");
      setMaintenant(BigInt(bloc!.timestamp));

      const comptes = await provider.listAccounts();
      const moi = comptes.length > 0 ? comptes[0].address : null;

      const total = Number(await gov.proposalCount());
      const resultat: Proposition[] = [];
      // Les ids de proposition commencent à 1 (vérifié par les tests)
      for (let id = 1; id <= total; id++) {
        const p = await gov.proposals(id);
        const aVote = moi ? await gov.hasVoted(id, moi) : false;
        resultat.push({
          id,
          campagne: p[0],
          type: Number(p[1]),
          description: p[2],
          deadline: p[4],
          quorum: p[5],
          pour: p[6],
          contre: p[7],
          executee: p[8],
          aVote,
        });
      }
      setListe(resultat.reverse()); // la plus récente en premier
      setErreur(null);
    } catch (e) {
      console.error(e);
      setErreur("Lecture impossible : vérifie le réseau Hardhat Local et les adresses");
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Envoie une transaction vers Governance, puis recharge les données
  async function envoyer(action: (gov: Contract) => Promise<any>, succes: string) {
    setMessage(null);
    try {
      setOccupe(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const gov = new Contract(ADDRESSES.governance, GOVERNANCE_ABI, signer);
      const tx = await action(gov);
      setMessage("Transaction envoyée, en attente de confirmation…");
      await tx.wait();
      setMessage(succes);
      await charger();
    } catch (e: any) {
      console.error(e);
      setMessage(`Échec : ${e?.reason ?? e?.shortMessage ?? "transaction refusée"}`);
    } finally {
      setOccupe(false);
    }
  }

  function creer() {
    if (!description.trim()) {
      setMessage("Écris une description pour la proposition");
      return;
    }
    envoyer(
      (gov) => gov.propose(BigInt(campagneId), Number(type), description.trim()),
      "Proposition créée. Le vote est ouvert pendant 3 jours."
    ).then(() => setDescription(""));
  }

  return (
    <section style={{ padding: "0 24px 24px" }}>
      <h2>Gouvernance : propositions</h2>

      {erreur && <p>{erreur}</p>}
      {message && <p>{message}</p>}

      {/* Création d'une proposition */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Nouvelle proposition</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="number"
            min="1"
            value={campagneId}
            onChange={(e) => setCampagneId(e.target.value)}
            placeholder="N° de campagne"
            style={{ padding: 8, borderRadius: 8, width: 140 }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ padding: 8, borderRadius: 8 }}
          >
            {TYPES.map((t, i) => (
              <option key={i} value={i}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            style={{ padding: 8, borderRadius: 8, flex: 1, minWidth: 200 }}
          />
          <button className="btn" disabled={occupe} onClick={creer}>
            Proposer
          </button>
        </div>
      </div>

      {liste.length === 0 && !erreur && <p>Aucune proposition pour le moment.</p>}

      {liste.map((p) => {
        const totalVoix = p.pour + p.contre;
        const pourcentPour = totalVoix > 0n ? Number((p.pour * 100n) / totalVoix) : 0;
        const voteOuvert = maintenant < p.deadline;
        const quorumAtteint = totalVoix >= p.quorum;

        let etat = "Vote en cours";
        if (p.executee) etat = "Exécutée";
        else if (!voteOuvert) etat = "Vote terminé";

        return (
          <div className="card" key={p.id} style={{ marginBottom: 16 }}>
            <h3>
              Proposition #{p.id} · {etat}
            </h3>
            <div className="big" style={{ fontSize: 22 }}>
              {TYPES[p.type]} · campagne #{p.campagne.toString()}
            </div>
            <div className="caption">{p.description}</div>

            <div className="vote-bar" style={{ marginTop: 12 }}>
              <div className="vote-yes" style={{ width: `${pourcentPour}%` }} />
              <div className="vote-no" style={{ width: `${totalVoix > 0n ? 100 - pourcentPour : 100}%` }} />
            </div>
            <div className="vote-legend">
              <span>Pour : {formatEther(p.pour)} CFD</span>
              <span>Contre : {formatEther(p.contre)} CFD</span>
            </div>
            <div className="caption">
              Quorum requis : {formatEther(p.quorum)} CFD ({quorumAtteint ? "atteint" : "non atteint"})
            </div>
            {voteOuvert && !p.executee && (
              <div className="caption">
                Temps restant : {tempsRestant(Number(p.deadline - maintenant))}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {voteOuvert && !p.executee && !p.aVote && (
                <>
                  <button
                    className="btn"
                    disabled={occupe}
                    onClick={() => envoyer((gov) => gov.vote(p.id, true), "Vote « Pour » enregistré.")}
                  >
                    Voter Pour
                  </button>
                  <button
                    className="btn"
                    disabled={occupe}
                    onClick={() => envoyer((gov) => gov.vote(p.id, false), "Vote « Contre » enregistré.")}
                  >
                    Voter Contre
                  </button>
                </>
              )}
              {voteOuvert && !p.executee && p.aVote && <div className="caption">Tu as déjà voté.</div>}
              {!voteOuvert && !p.executee && (
                <button
                  className="btn"
                  disabled={occupe}
                  onClick={() => envoyer((gov) => gov.execute(p.id), "Proposition exécutée sur le Core.")}
                >
                  Exécuter
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}