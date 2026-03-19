
Problème identifié : les coordonnées ne reposent pas sur le même repère selon le mode d’affichage. La composition “normale” utilise un centrage artificiel (`GLOBAL_X_OFFSET` + `getSafeBounds`) alors que le mode édition et la sauvegarde utilisent d’autres bornes (`DRAG_BOUNDS`). Résultat :
- quand on clique sur “Modifier la disposition”, toute l’équipe se recalcule sur un autre repère et se décale ;
- quand on valide, les `customX/customY` sont bien sauvegardés, mais leur réaffichage ne tombe pas exactement au même endroit visuel.

Plan de correction :

1. Unifier le système de coordonnées du terrain
- Remplacer la logique actuelle par une seule source de vérité pour les limites gauche/droite/haut/bas du terrain.
- Utiliser les vraies lignes blanches du SVG comme repère unique pour :
  - la disposition automatique,
  - le drag,
  - l’affichage après sauvegarde.
- Supprimer le décalage global artificiel (`GLOBAL_X_OFFSET`) pour éviter tout changement de repère entre les modes.

2. Stabiliser l’entrée en mode édition
- Faire en sorte que “Modifier la disposition” n’altère jamais les positions visibles.
- Les joueurs affichés avant clic devront apparaître exactement au même endroit après passage en mode édition.
- Si un joueur n’a pas encore de position personnalisée, sa position de départ sera calculée une fois avec le même repère que celui utilisé pour le drag.

3. Corriger la sauvegarde pour éviter le saut après validation
- Conserver les coordonnées affichées pendant l’édition comme coordonnées finales exactes.
- Vérifier que l’état local, le rendu après validation et le retour des données sauvegardées utilisent la même conversion.
- Éviter tout recalcul horizontal parasite après `Valider`.

4. Nettoyer les détails qui aggravent le bug
- Corriger l’avertissement React sur les refs dans `DraggablePlayer` / `JerseyIcon`, car il indique un montage fragile pendant le mode édition.
- Revoir la synchro `localConvocations` / `convocations` pour que l’état ne soit pas réinjecté avec un autre layout au mauvais moment.

5. Vérifications ciblées après correction
- Ouvrir une feuille de match avec composition existante.
- Cliquer sur “Modifier la disposition” : aucun joueur ne doit bouger.
- Déplacer un joueur tout à gauche / tout à droite : il doit rester dans les lignes blanches.
- Valider : le joueur doit rester exactement à l’endroit choisi.
- Rouvrir la feuille : la position doit être identique.

Détails techniques
```text
Aujourd’hui il y a 2 systèmes qui se contredisent :
- auto layout : getSafeBounds(...) + GLOBAL_X_OFFSET
- drag/save : DRAG_BOUNDS + pourcentages directs

Correction prévue :
- créer une seule fonction de bornes terrain
- calculer les positions auto dans ce même espace
- stocker et relire customX/customY dans cet espace sans transformation cachée
- ne plus changer de repère entre “vue normale” et “mode édition”
```
