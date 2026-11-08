# Audit statique Slither 0.11.6

Commande (projet complet, Governance incluse) :

`slither . --filter-paths "node_modules|test|mocks|Fuzz" > docs\slither-complet.txt 2>&1`

Résultat final : 12 résultats informatifs (9 timestamp, 3 low-level-calls), 0 vulnérabilité haute ou moyenne. Rapport brut : `docs/slither-complet.txt`.

| Détecteur | Occurrences | Décision | Justification |
|---|---|---|---|
| timestamp | 9 | Accepté | 7 dans CrowdfundingCore (échéances de campagnes de plusieurs jours) et 2 dans Governance (`vote`, `execute`, durée de vote de 3 jours). Une dérive de ~15 s du validateur est sans effet. Le pouvoir de vote n'utilise pas le temps : il est figé au bloc `block.number - 1` (snapshot). |
| low-level-calls | 3 | Accepté | `.call` est la méthode recommandée pour envoyer de l'ETH ; réentrance neutralisée par `nonReentrant` et Checks-Effects-Interactions, prouvé par `test/Reentrancy.ts`. |

Résultats déjà corrigés lors des passages précédents (absents du rapport final) :

| Détecteur | Décision | Justification |
|---|---|---|
| missing-inheritance | **Corrigé** | `ICFDToken` déplacée dans `contracts/interfaces/` ; `CFDToken` en hérite explicitement (`override`). |
| unused-return | **Corrigé** | Conséquence de la correction précédente : le Core ignorait la valeur renvoyée par `mintForContribution`. Il la vérifie désormais (`require(minted > 0)`). |

Historique : premier passage sur le code du token et du Core, 11 résultats (`docs/slither-report.txt`). Après correction de missing-inheritance : 11 (apparition de unused-return). Après correction de unused-return : 10 résultats, tous justifiés (`docs/slither-report-apres.txt`). Passage final sur le projet complet avec Governance : 12 résultats, tous justifiés (`docs/slither-complet.txt`).