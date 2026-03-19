
Problème réellement identifié dans le code actuel : le décalage ne vient pas seulement des coordonnées, mais surtout du rendu différent entre le mode normal et le mode édition dans `src/components/dashboard/PitchView.tsx`.

En lecture normale, les joueurs sont rendus dans un `motion.div` avec `initial/animate` sur `y`. Framer Motion réécrit le `transform`, ce qui casse le centrage Tailwind `-translate-x-1/2 -translate-y-1/2`.  
En mode édition, les joueurs sont rendus dans un `div` simple (`DraggablePlayer`) qui garde bien ce centrage. Résultat :
- quand on clique sur “Modifier la disposition”, tous les joueurs changent de repère visuel et partent à gauche ;
- quand on valide, ils repassent dans le wrapper animé du mode normal et repartent à droite ;
- les `customX/customY` enregistrés peuvent être justes, mais l’affichage ne l’est pas.

Plan de correction

1. Unifier le wrapper visuel des joueurs
- Utiliser exactement le même conteneur positionné pour les 2 modes (normal + édition).
- Garder `left/top` en `%` et le centrage `translate(-50%, -50%)` identiques partout.
- Éviter que le conteneur absolu des joueurs soit un `motion.div` avec animation sur `x/y/transform`.

2. Déplacer les animations hors du conteneur positionné
- Supprimer l’animation Framer Motion sur le bloc qui porte la position absolue.
- Si on veut garder l’effet d’apparition, l’appliquer sur un enfant interne (maillot/label), avec `opacity` et `scale` uniquement.
- Ainsi, le repère visuel ne changera plus quand on passe d’un mode à l’autre.

3. Rendre le mode édition visuellement identique au mode normal
- Conserver la même largeur, le même centrage et le même point d’ancrage des maillots.
- Vérifier que `DraggablePlayer` et le rendu normal utilisent le même markup de base, avec uniquement le drag/click qui change.

4. Stabiliser la sauvegarde
- Conserver la logique actuelle de sauvegarde des `customX/customY`, mais s’assurer qu’après `Valider`, le rendu relit ces coordonnées dans le même système visuel.
- Garder la protection contre la resynchro trop tôt (`justSavedRef`), mais corriger d’abord le problème principal de `transform`, qui semble être la vraie cause du saut.

5. Vérifications à faire après correction
- Ouvrir une feuille avec une composition existante.
- Cliquer sur “Modifier la disposition” : aucun joueur ne doit bouger d’un pixel.
- Déplacer un joueur puis cliquer sur “Valider” : il doit rester exactement au même endroit.
- Fermer/réouvrir la feuille de match : la position doit être identique.
- Tester sur mobile étroit (comme actuellement) pour confirmer qu’il n’y a plus de décalage gauche/droite.

Détails techniques
```text
Cause probable principale :
- mode normal = wrapper joueur en motion.div avec animation sur y
- mode édition = wrapper joueur en div classique

Conséquence :
- Framer Motion prend la main sur `transform`
- le `translate(-50%, -50%)` n’est plus appliqué pareil
- les coordonnées sauvegardées paraissent “fausses” alors que c’est surtout l’ancrage visuel qui change

Correction :
- même wrapper absolu dans les 2 modes
- pas d’animation transform sur le wrapper positionné
- animations éventuelles déplacées sur un enfant interne
```

Fichiers à modifier
- `src/components/dashboard/PitchView.tsx`

Pas de changement backend ou base de données nécessaire pour ce correctif.
