# Audit statique Slither 0.11.6

Commande : slither . --filter-paths "node_modules|mocks|\.t\.sol"

Résultat final : 10 résultats informatifs (7 timestamp, 3 low-level-calls), 0 vulnérabilité haute ou moyenne.

| Détecteur | Occurrences | Décision | Justification |
|---|---|---|---|
| timestamp | 7 | Accepté | Échéances de plusieurs jours ; une dérive de ~15 s du validateur est sans effet. |
| low-level-calls | 3 | Accepté | `.call` est la méthode recommandée pour envoyer de l'ETH ; réentrance neutralisée par `nonReentrant` et Checks-Effects-Interactions, prouvé par test/Reentrancy.ts. |
| missing-inheritance | 1 | **Corrigé** | `ICFDToken` déplacée dans `contracts/interfaces/` ; `CFDToken` en hérite explicitement (`override`). |
| unused-return | 1 | **Corrigé** | Conséquence de la correction précédente : le Core ignorait la valeur renvoyée par `mintForContribution`. Il la vérifie désormais (`require(minted > 0)`). |

Historique : premier passage, 11 résultats (docs/slither-report.txt). Après correction de missing-inheritance : 11 (apparition de unused-return). Après correction de unused-return : 10 résultats, tous justifiés (docs/slither-report-apres.txt).