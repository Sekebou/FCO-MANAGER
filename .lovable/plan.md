
Objectif : corriger le bug de persistance des positions sur les feuilles de match pour que les changements restent bien enregistrés après sauvegarde, reset, changement d’onglet et retour.

1. Corriger la source de vérité des feuilles de match
- Aujourd’hui, la sauvegarde des positions est faite dans `MatchSheetsTab`, mais seule sa copie locale (`localSheets`) est mise à jour.
- Le bug vient du fait que quand on change d’onglet, `MatchSheetsTab` est remonté avec `matchSheets` venant du `Dashboard`, qui n’a pas été mis à jour tout de suite.
- Je vais faire remonter la mise à jour au `Dashboard` pour que l’état central des feuilles de match soit mis à jour immédiatement après une sauvegarde/reset.

2. Synchroniser aussi le cache local
- Le projet recharge les feuilles via le cache local (`readCache('matchSheets')` / `writeCache('matchSheets')`).
- Aujourd’hui, le cache n’est réécrit qu’au chargement global, pas après modification d’une disposition.
- Je vais prévoir une mise à jour immédiate du cache des feuilles de match après sauvegarde pour éviter le retour à une ancienne version au remount.

3. Garder l’optimistic update, mais au bon niveau
- `MatchSheetsTab` pourra continuer à afficher la modif instantanément.
- Mais la vraie mise à jour optimiste doit aussi toucher `matchSheets` dans `Dashboard`, sinon le changement d’onglet casse la cohérence.
- Je vais donc passer un callback depuis `Dashboard` vers `MatchSheetsTab` pour centraliser la persistance.

4. Fiabiliser le reset
- Le reset enlève bien `customX/customY` en local, mais doit suivre exactement le même circuit de sauvegarde que le drag manuel.
- Je vais m’assurer que reset + valider écrit la version sans coordonnées custom dans la base, l’état central et le cache.

5. Réduire les effets de course
- Le garde-fou actuel dans `PitchView` avec la fenêtre de 3 secondes masque partiellement un problème de synchro mais ne le résout pas complètement.
- Je garderai la protection utile contre les retours réseau obsolètes, mais je ferai en sorte que les props envoyées au composant soient déjà à jour, pour que le changement d’onglet ne dépende plus du realtime.

6. Vérification ciblée après correction
- Cas 1 : déplacer plusieurs joueurs, valider, changer d’onglet, revenir.
- Cas 2 : reset, valider, changer d’onglet, revenir.
- Cas 3 : fermer/réouvrir la vue des feuilles si le cache local se réhydrate.
- Cas 4 : vérifier qu’une feuille existante avec positions custom reste correcte.

Détail technique
- Fichiers principaux concernés :
  - `src/components/dashboard/MatchSheetsTab.tsx`
  - `src/pages/Dashboard.tsx`
  - possiblement léger ajustement dans `src/components/dashboard/PitchView.tsx`
- Cause racine identifiée :
  - mise à jour DB OK
  - mise à jour locale du tab OK
  - mais pas de mise à jour immédiate du state parent `matchSheets`
  - ni du cache `matchSheets`
  - donc au changement d’onglet, l’ancienne version réapparaît jusqu’à un refresh réseau/realtime

Résultat attendu
- Les positions enregistrées restent stables immédiatement.
- Un reset reste bien appliqué.
- Le changement d’onglet ne fait plus revenir une ancienne composition.
