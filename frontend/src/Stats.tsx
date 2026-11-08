// frontend/src/Stats.tsx
// Les trois cartes d'accueil, alimentées par les vrais contrats
import { useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { ADDRESSES, CORE_ABI, GOVERNANCE_ABI } from "./contracts";

type DernierVote = {
  id: number;
  pour: bigint;
  contre: bigint;
  executee: boolean;
  fin: bigint;
  quorum: bigint;
};

export default function Stats() {
  const [total, setTotal] = useState(0);
  const [actives, setActives] = useState(0);
  const [coffre, setCoffre] = useState<bigint>(0n);
  const [vote, setVote] = useState<DernierVote | null>(null);
  const [maintenant, setMaintenant] = useState<bigint>(0n);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    async function charger() {
      try {
        if (!window.ethereum) return;
        const provider = new BrowserProvider(window.ethereum);
        const core = new Contract(ADDRESSES.core, CORE_ABI, provider);
        const gov = new Contract(ADDRESSES.governance, GOVERNANCE_ABI, provider);

        // Campagnes : total et nombre de campagnes "En cours" (statut 0)
        const n = Number(await core.campaignCount());
        let enCours = 0;
        for (let id = 1; id <= n; id++) {
          if (Number(await core.getStatus(id)) === 0) enCours++;
        }
        setTotal(n);
        setActives(enCours);

        // Coffre : ETH actuellement détenus par le Core
        setCoffre(await provider.getBalance(ADDRESSES.core));

        // Temps de la blockchain (et non celui de l'ordinateur)
        const bloc = await provider.getBlock("latest");
        setMaintenant(BigInt(bloc!.timestamp));

        // Vote : dernière proposition créée
        const nbProp = Number(await gov.proposalCount());
        if (nbProp > 0) {
          const p = await gov.proposals(nbProp);
          setVote({
            id: nbProp,
            pour: p[6],
            contre: p[7],
            executee: p[8],
            fin: p[4],
            quorum: p[5],
          });
        } else {
          setVote(null);
        }
        setErreur(false);
      } catch (e) {
        console.error(e);
        setErreur(true);
      }
    }

    charger();
    const timer = setInterval(charger, 5000); // rafraîchit toutes les 5 s
    return () => clearInterval(timer);
  }, []);

  const totalVoix = vote ? vote.pour + vote.contre : 0n;
  const oui = totalVoix > 0n && vote ? Number((vote.pour * 100n) / totalVoix) : 0;
  const non = 100 - oui;

  let statut = "";
  if (vote) {
    if (vote.executee) statut = "Exécutée";
    else if (maintenant < vote.fin) statut = "Vote en cours";
    else if (totalVoix >= vote.quorum && vote.pour > vote.contre) statut = "Adoptée : à exécuter";
    else statut = "Rejetée";
  }

  return (
    <section className="stats">
      <div className="card">
        <h3>Campaigns</h3>
        <div className="big">{erreur ? "—" : total}</div>
        <div className="caption">
          {actives} en cours sur {total} au total
        </div>
      </div>

      <div className="card">
        <h3>Governance vote</h3>
        {vote && totalVoix > 0n ? (
          <>
            <div className="vote-bar">
              <div className="vote-yes" style={{ width: `${oui}%` }} />
              <div className="vote-no" style={{ width: `${non}%` }} />
            </div>
            <div className="vote-legend">
              <span>Yes {oui}%</span>
              <span>No {non}%</span>
            </div>
            <div className="caption">
              Proposition #{vote.id} · {statut}
            </div>
          </>
        ) : (
          <div className="caption">
            {vote
              ? `Proposition #${vote.id} · ${statut} : aucun vote`
              : "Aucune proposition pour le moment"}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Vault</h3>
        <div className="big">
          {erreur ? "—" : `${Number(formatEther(coffre)).toLocaleString("fr-FR")} ETH`}
        </div>
        <div className="caption">fonds détenus par le Core</div>
      </div>
    </section>
  );
}