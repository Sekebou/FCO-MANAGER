
Objectif: corriger proprement la composition sur le terrain pour que les joueurs restent visuellement à l’intérieur des lignes, en particulier le n°2 à droite qui touche la ligne sur ta capture.

Constat après analyse de l’image
- Le problème principal est bien visible sur le côté droit: le n°2 est trop collé à la ligne, presque dessus.
- Le bloc défensif est globalement trop large: les latéraux sont poussés trop près des bords.
- Le calcul actuel sous-estime l’encombrement réel d’un joueur à l’écran:
  - il tient compte d’une largeur logique,
  - mais visuellement il faut aussi absorber le maillot, l’ombre, l’étiquette du nom, et un peu de marge de sécurité.
- Résultat: mathématiquement “ça passe”, visuellement non.

Plan d’implémentation
1. Recalibrer la zone sûre horizontale dans `src/components/dashboard/PitchView.tsx`
- Augmenter la marge de sécurité utilisée par `getSafeBounds`.
- Ne plus se baser sur une largeur trop optimiste.
- Ajouter un petit “buffer” fixe pour que le premier et le dernier joueur restent clairement à l’intérieur des lignes, pas juste à ras.

2. Réduire légèrement l’empreinte visuelle des joueurs
- Diminuer un peu la taille du conteneur joueur.
- Réduire légèrement le maillot.
- Réduire un peu la largeur/hauteur du badge nom si nécessaire.
- Garder la lisibilité, mais prioriser un rendu propre sur mobile.

3. Rendre la ligne défensive plus compacte que les autres
- Appliquer une distribution un peu plus resserrée pour les lignes à 4 ou 5 joueurs, surtout en défense.
- Conserver la symétrie gauche/droite.
- Éviter que les latéraux soient alignés au bord exact du terrain.

4. Vérifier le rendu sur le cas réel montré par ta capture
- Contrôler spécifiquement le n°2 à droite et le n°3 à gauche.
- Vérifier aussi les ailiers du haut pour éviter qu’ils reviennent trop près des bords après l’ajustement.
- S’assurer que les noms ne dépassent pas non plus.

Résultat attendu
- Aucun maillot ne touche ou ne dépasse les lignes latérales.
- Le n°2 et le n°3 restent bien à l’intérieur avec un petit espace visuel propre.
- La défense paraît équilibrée et plus naturelle.
- Le terrain garde le style actuel, mais avec une composition plus compacte et plus propre.

Détails techniques
- Fichier concerné: `src/components/dashboard/PitchView.tsx`
- Le problème vient surtout de:
  - `PLAYER_SLOT_WIDTH` / `PLAYER_SLOT_HALF`
  - `getSafeBounds(containerWidth)`
  - `distributeEvenly(...)`
  - la largeur fixe du wrapper joueur (`w-14`) et la taille du `JerseyIcon`
- Je garderai la logique dynamique basée sur la largeur du terrain, mais avec:
  - une empreinte visuelle plus réaliste,
  - une marge de sécurité supplémentaire,
  - une distribution plus compacte pour la ligne défensive.

Critères de validation
- Sur la preview mobile, les joueurs extrêmes restent entièrement à l’intérieur.
- Les lignes latérales restent visibles avec un espace entre la ligne et les joueurs.
- Le rendu reste centré, symétrique et lisible.
