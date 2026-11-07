// frontend/src/Onglets.tsx
// Trois cartes cliquables : Campagnes, Gouvernance, Coffre multisig
import { useState } from "react";
import Campaigns from "./Campaigns";
import Proposals from "./Proposals";
import Treasury from "./Treasury";

type Onglet = "campagnes" | "gouvernance" | "coffre";

const CARTES: {
  id: Onglet;
  icone: string;
  titre: string;
  texte: string;
  couleur: string;
  texteSur: string;
}[] = [
  {
    id: "campagnes",
    icone: "💰",
    titre: "Campagnes",
    texte: "Créer, financer, rembourser ou retirer les fonds",
    couleur: "#2f8f8f",
    texteSur: "#ffffff",
  },
  {
    id: "gouvernance",
    icone: "🗳️",
    titre: "Gouvernance",
    texte: "Proposer, voter avec les CFD, exécuter",
    couleur: "#fbbf24",
    texteSur: "#1f2937",
  },
  {
    id: "coffre",
    icone: "🔐",
    titre: "Coffre multisig",
    texte: "Trésorerie protégée par la règle 2-sur-3",
    couleur: "#f97316",
    texteSur: "#ffffff",
  },
];

export default function Onglets() {
  const [actif, setActif] = useState<Onglet>("campagnes");

  return (
    <>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          padding: "32px 24px 8px",
        }}
      >
        {CARTES.map((c) => {
          const selectionne = actif === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActif(c.id)}
              aria-pressed={selectionne}
              style={{
                cursor: "pointer",
                textAlign: "center",
                padding: "20px 16px",
                borderRadius: 18,
                border: `3px solid ${c.couleur}`,
                background: selectionne ? c.couleur : "transparent",
                color: selectionne ? c.texteSur : c.couleur,
                transition: "all 0.2s ease",
                transform: selectionne ? "translateY(-2px)" : "none",
                boxShadow: selectionne ? `0 8px 24px ${c.couleur}55` : "none",
              }}
            >
              <div style={{ fontSize: 32 }}>{c.icone}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{c.titre}</div>
              <div style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>{c.texte}</div>
              <div style={{ fontSize: 22, marginTop: 8, height: 24 }}>{selectionne ? "⌄" : ""}</div>
            </button>
          );
        })}
      </section>

      {actif === "campagnes" && <Campaigns />}
      {actif === "gouvernance" && <Proposals />}
      {actif === "coffre" && <Treasury />}
    </>
  );
}