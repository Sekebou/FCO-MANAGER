

## Modification du flux des paris : suppression de la dépendance aux résultats FFF

### Problème actuel
- Le match passe en LIVE pendant 100 minutes, puis affiche "En attente du résultat FFF"
- La progression vers le match suivant nécessite un score officiel FFF + règlement des paris
- L'admin règle manuellement les paris mais le système attend quand même les scores FFF

### Changements prévus

**Fichier : `src/components/dashboard/ParisTab.tsx`**

1. **Réduire le LIVE de 100min à 60min** (fonction `getMatchStatus`, ligne 479)

2. **Changer le texte "En attente du résultat FFF" → "En attente"** (ligne 918)

3. **Modifier `isMatchSettled`** (ligne 408-420) : Un match est considéré comme réglé si :
   - Le match est terminé (jour passé OU 3h après le coup d'envoi via `isMatchFinished`)
   - ET aucun pari pending ne reste sur ce match
   - Plus besoin de score FFF (`home_score`/`away_score`)

4. **Modifier `isMatchDone` dans `settleCards`** (ligne 567-569) : Même logique — retirer l'exigence de score FFF, utiliser la logique temporelle + absence de paris pending

### Résultat attendu
- Match → LIVE (1h) → "En attente" → Admin règle les paris → Le match disparaît → Prochain match affiché

