# Audit statique Slither 0.11.6

Commande : slither . --filter-paths "node_modules|mocks|\.t\.sol"
Résultat : 11 résultats informatifs, 0 vulnérabilité haute ou moyenne.

| Détecteur | Occurrences | Décision | Justification |
|---|---|---|---|
| timestamp | 7 | Accepté | Échéances de plusieurs jours ; une dérive de ~15 s du validateur est sans effet. |
| low-level-calls | 3 | Accepté | `.call` est la méthode recommandée pour envoyer de l'ETH ; réentrance neutralisée par `nonReentrant` et Checks-Effects-Interactions, prouvé par test/Reentrancy.ts. |
| missing-inheritance | 1 | Accepté | CFDToken n'hérite pas de ICFDToken ; l'interface sert uniquement à l'appel depuis le Core. Aucun impact sécurité. |