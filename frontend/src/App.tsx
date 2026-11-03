import { useState } from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { ADDRESSES, TOKEN_ABI } from "./contracts";

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Valeurs d'exemple, à remplacer plus tard par les données des contrats
const YES_PERCENT = 68;
const NO_PERCENT = 100 - YES_PERCENT;

// Un cube isométrique : une face du dessus et deux faces latérales
function Cube({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon
        points={`${x},${y - 24} ${x + 42},${y} ${x},${y + 24} ${x - 42},${y}`}
        fill="#4a6a7d"
      />
      <polygon
        points={`${x - 42},${y} ${x},${y + 24} ${x},${y + 72} ${x - 42},${y + 48}`}
        fill="#34505f"
      />
      <polygon
        points={`${x + 42},${y} ${x},${y + 24} ${x},${y + 72} ${x + 42},${y + 48}`}
        fill="#27404d"
      />
    </g>
  );
}

function Illustration() {
  return (
    <svg
      viewBox="0 0 600 520"
      className="illustration"
      role="img"
      aria-label="Pièce CFD sur une plateforme"
    >
      <defs>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Lignes de circuit et noeuds */}
      <g stroke="#f97316" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M40 430 L95 462 L150 440" />
        <path d="M205 502 L250 478" />
        <path d="M505 430 L562 472" />
      </g>
      <g fill="#f97316">
        <circle cx="40" cy="430" r="9" />
        <circle cx="205" cy="502" r="9" />
        <circle cx="562" cy="472" r="9" />
      </g>

      {/* Plateforme orange */}
      <polygon points="70,400 300,490 300,508 70,418" fill="#c2410c" />
      <polygon points="530,400 300,490 300,508 530,418" fill="#9a3412" />
      <polygon
        points="300,310 530,400 300,490 70,400"
        fill="#f97316"
        stroke="#f97316"
        strokeWidth="14"
        strokeLinejoin="round"
      />

      {/* Plaques décoratives */}
      <polygon points="470,215 560,188 590,204 500,232" fill="#f97316" />
      <polygon points="120,260 210,232 240,248 150,276" fill="#2b4150" />
      <polygon points="440,470 530,444 560,460 470,486" fill="#f97316" />

      {/* Pièce ETH à gauche (coupée par le bord) */}
      <circle cx="28" cy="300" r="62" fill="#fbbf24" />
      <circle cx="28" cy="300" r="44" fill="none" stroke="#d97706" strokeWidth="6" />
      <text x="36" y="322" textAnchor="middle" fontSize="64" fontWeight="800" fill="#d97706">
        Ξ
      </text>

      {/* Blocs reliés (la chaîne) */}
      <g stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M78 98 L40 112" />
        <path d="M162 98 L200 112" />
      </g>
      <Cube x={120} y={60} />
      <Cube x={70} y={150} />
      <Cube x={170} y={150} />

      {/* Bouclier avec cadenas */}
      <g transform="translate(430 10)">
        <path
          d="M70 10 L130 32 V90 C130 130 105 155 70 170 C35 155 10 130 10 90 V32 Z"
          fill="#2d3f4d"
          stroke="#3f5a6b"
          strokeWidth="4"
        />
        <path d="M57 75 V66 a13 13 0 0 1 26 0 V75" fill="none" stroke="#f97316" strokeWidth="6" />
        <rect x="50" y="75" width="40" height="32" rx="6" fill="#f97316" />
        <circle cx="70" cy="91" r="4" fill="#2d3f4d" />
      </g>

      {/* Bouclier ETH */}
      <g transform="translate(480 250) scale(0.85)">
        <path
          d="M70 10 L130 32 V90 C130 130 105 155 70 170 C35 155 10 130 10 90 V32 Z"
          fill="#2f6f6f"
          stroke="#3b8a8a"
          strokeWidth="4"
        />
        <text x="70" y="115" textAnchor="middle" fontSize="70" fontWeight="800" fill="#1b4a4a">
          Ξ
        </text>
      </g>

      {/* Pile de pièces */}
      <ellipse cx="300" cy="392" rx="92" ry="32" fill="#b45309" />
      <rect x="208" y="362" width="184" height="30" fill="#b45309" />
      <ellipse cx="300" cy="362" rx="92" ry="32" fill="#d97706" />
      <rect x="208" y="332" width="184" height="30" fill="#d97706" />
      <ellipse cx="300" cy="332" rx="92" ry="32" fill="#fbbf24" />
      <ellipse cx="300" cy="332" rx="62" ry="21" fill="#f59e0b" />

      {/* Grande pièce CFD lumineuse */}
      <ellipse cx="318" cy="190" rx="112" ry="128" fill="#ca8a04" />
      <ellipse cx="300" cy="190" rx="112" ry="128" fill="#fde047" filter="url(#glow)" />
      <ellipse cx="300" cy="190" rx="84" ry="100" fill="#f59e0b" />
      <text
        x="300"
        y="214"
        textAnchor="middle"
        fontSize="70"
        fontWeight="800"
        fill="#1f2937"
        fontFamily="Segoe UI, system-ui, sans-serif"
      >
        CFD
      </text>
    </svg>
  );
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Installe MetaMask d'abord");
      return;
    }
    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);

    // Test de lecture : solde CFD du compte connecté
    const token = new Contract(ADDRESSES.token, TOKEN_ABI, provider);
    const balance = await token.balanceOf(accounts[0]);
    console.log("Mon solde CFD :", formatEther(balance));
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="logo">CFD</div>
          CrowdFunding DAO
        </div>
        {account ? (
          <div className="address">
            {account.slice(0, 6)}…{account.slice(-4)}
          </div>
        ) : (
          <button className="btn" onClick={connectWallet}>
            Connecter MetaMask
          </button>
        )}
      </header>

      <main>
        <section className="hero">
          <div>
            <h1>
              Decentralized <span>Crowdfunding</span>
            </h1>
            <p>
              Finance des projets en ETH, reçois des jetons de gouvernance CFD
              et vote pour débloquer les fonds, sans intermédiaire.
            </p>
            {!account && (
              <button className="btn" onClick={connectWallet}>
                Connecter MetaMask
              </button>
            )}
          </div>
          <Illustration />
        </section>

        <section className="stats">
          <div className="card">
            <h3>Campaigns</h3>
            <div className="big">12</div>
            <div className="caption">campagnes actives (exemple)</div>
          </div>

          <div className="card">
            <h3>Governance vote</h3>
            <div className="vote-bar">
              <div className="vote-yes" style={{ width: `${YES_PERCENT}%` }} />
              <div className="vote-no" style={{ width: `${NO_PERCENT}%` }} />
            </div>
            <div className="vote-legend">
              <span>Yes {YES_PERCENT}%</span>
              <span>No {NO_PERCENT}%</span>
            </div>
          </div>

          <div className="card">
            <h3>Vault</h3>
            <div className="big">34,5 ETH</div>
            <div className="caption">fonds sécurisés (exemple)</div>
          </div>
        </section>
      </main>
    </>
  );
}