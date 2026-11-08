# Décisions de conception

## D1. Rôle de la gouvernance dans `withdrawFunds()`

**Contexte.** Le sujet demande que `withdrawFunds()` soit « conditionné à la
validation par gouvernance » et que le module de gouvernance serve à valider un
déblocage anticipé ou à geler une campagne litigieuse.

**Décision.** Le retrait normal (campagne réussie, échéance passée, non gelée)
n'exige pas de vote. La gouvernance contrôle deux cas :

- **Gel** : une campagne gelée par vote passe au statut `Cancelled`
  (`getStatus`), ce qui bloque `withdrawFunds` (`require(... == Successful)`)
  et ouvre le remboursement.
- **Déblocage anticipé** : avant l'échéance, `withdrawFunds` exige
  `earlyReleaseApproved`, que seul le contrat `Governance` peut activer
  (`GOVERNANCE_ROLE`).

**Justification.** Imposer un vote pour chaque retrait normal rendrait la
plateforme lente et donnerait à chaque projet réussi un risque de blocage par
la majorité. Le vote est réservé aux situations litigieuses ou exceptionnelles.

**Limite assumée.** Si une campagne réussie n'est pas gelée avant l'échéance,
le bénéficiaire peut retirer sans vote. Le gel doit donc intervenir pendant
la période de collecte.