# Plateforme de financement participatif décentralisée (gouvernance par jeton)

Mini-projet Blockchain, ENSA Béni Mellal.
Encadrant : Pr. Hamza Touil.
Binôme : Hassnae Latouti, Ferdaous Kouzi.

## Présentation

Plateforme de crowdfunding sur Ethereum. Chaque contribution en ETH est
convertie en jetons de gouvernance **CFD** (1 ETH = 1000 CFD). Les détenteurs
de jetons votent sur les décisions de la plateforme.

## Fonctionnalités

- Création de campagnes (objectif, date limite, description stockée sur IPFS).
- Contribution en ETH et réception automatique de jetons CFD.
- Remboursement si la campagne échoue.
- Retrait des fonds par le créateur si la campagne réussit.
- Gouvernance : propositions, vote pondéré par les jetons, exécution.
- Trésorerie multi-signature (2 signatures sur 3) pour les montants élevés.

## Architecture

| Contrat | Rôle |
|---|---|
| `CFDToken` | Jeton ERC20 avec votes (ERC20Votes) et permit |
| `CrowdfundingCore` | Campagnes, contributions, remboursements, retraits |
| `MultiSigTreasury` | Trésorerie à signatures multiples |
| `Governance` | Propositions et votes |

Rôles : `MINTER_ROLE`, `GOVERNANCE_ROLE`, `PAUSER_ROLE`.
Frais de plateforme : 2 % envoyés à la trésorerie.
Quorum : 10 %, majorité simple, vote de 3 jours.

## Technologies

Solidity 0.8.34, Hardhat 3, OpenZeppelin, ethers.js, React + Vite,
IPFS (Pinata), Slither.

## Installation

```bash
npm install
cd frontend
npm install
```

## Utilisation en local

```bash
npx hardhat compile
npx hardhat test
npx hardhat node
```

Dans un deuxième terminal :

```bash
npx hardhat run scripts/deploy.ts --network localhost
cd frontend
npm run dev
```

## Déploiement Sepolia

Les adresses déployées sont dans `docs/sepolia-addresses.json`.
Les contrats sont vérifiés sur Etherscan.

Configuration : copier les variables nécessaires dans un fichier `.env`
(clé RPC, clé de test, clé Etherscan, clé Pinata). Ce fichier n'est jamais
envoyé sur Git.

## Sécurité

- Protection contre la réentrance (`ReentrancyGuard`) et schéma « effets avant interactions ».
- Contrôle d'accès par rôles (`AccessControl`) et mise en pause (`Pausable`).
- Audit Slither : voir `docs/slither-analyse.md`.
- Décisions de conception : voir `docs/decisions.md`.

## Documentation

- Rapport final : `docs/Rapport_mini_projet_blockchain_final.pdf`
- Audit de sécurité : `docs/slither-analyse.md`
- Décisions : `docs/decisions.md`