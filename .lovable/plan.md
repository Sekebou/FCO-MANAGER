
Objectif: faire en sorte que le modal “Remplacer joueur” se comporte exactement comme le modal Convocations sur iPhone, sans passer sous le clavier pendant la recherche.

1. Constats dans le code
- Le modal de remplacement est dans `src/components/dashboard/MatchSheetsTab.tsx`.
- Il calcule déjà un `maxHeight` avec `visualViewport`, mais de façon trop simplifiée.
- Il lit `--sat` pour le safe area top, alors que cette variable n’est pas définie globalement dans `src/index.css`.
- Contrairement à `ConvocationWizard.tsx`, il ne gère pas:
  - l’inset clavier réel (`keyboardInset`)
  - l’état `keyboardOpen`
  - le padding bas dynamique
  - le scroll auto de la liste quand on tape
  - un calcul de hauteur robuste avec fallback safe-area

2. Correction proposée
- Reprendre le même pattern que `ConvocationWizard.tsx` dans `SwapPlayerModal`.
- Ajouter dans le modal :
  - `viewportHeight`
  - `keyboardInset`
  - `keyboardOpen`
  - `safeAreaTop`
  - `searchInputRef` et `listScrollRef`
- Lire `safeAreaTop` avec la même stratégie fiable que Convocations :
  - tentative via style calculé
  - fallback via un élément temporaire mesurant `env(safe-area-inset-top)`
  - fallback final ~50px
- Écouter `window.visualViewport.resize` et `scroll` pour :
  - recalculer la hauteur disponible
  - détecter l’ouverture réelle du clavier
  - remonter le sheet au-dessus du clavier

3. Ajustements UI dans le modal
- Appliquer sur l’overlay un `paddingBottom` basé sur `keyboardInset`, comme dans Convocations.
- Remplacer le `maxHeight` actuel par une formule du type :
  - `maxHeight = max(320, viewportHeight - safeAreaTop - 8)`
- Mettre le body interne du modal en `min-h-0 overflow-y-auto overscroll-contain`.
- Ajouter un `scrollPaddingBottom` et `paddingBottom` dynamiques sur la liste des joueurs quand le clavier est ouvert.
- Au focus du champ recherche, forcer un `scrollIntoView` léger du champ pour éviter qu’il se retrouve masqué.
- Quand `swapSearch` change, remettre la liste en haut pour que les premiers résultats restent visibles immédiatement.

4. Zones à corriger
- `src/components/dashboard/MatchSheetsTab.tsx`
  - renforcer la logique viewport/clavier du composant `SwapPlayerModal`
  - fiabiliser la mesure du safe area top
  - ajuster la structure header / recherche / liste / mode “Nom libre”
- Pas besoin de toucher la logique métier de remplacement ni la sauvegarde backend.

5. Résultat attendu
- Le header du modal reste sous la status bar.
- Le champ recherche reste visible au-dessus du clavier.
- La liste filtrée reste scrollable sans se faire couper.
- Le comportement devient cohérent avec le modal Convocations, aussi bien en “Joueur inscrit” qu’en “Nom libre”.

Section technique
```text
Aujourd’hui:
maxHeight = visualViewport.height - parseInt(--sat) - 24
problèmes:
- --sat probablement vide/non défini
- pas de keyboardInset réel
- pas de padding bas quand le clavier s’ouvre

Après correction:
safeAreaTop = mesure fiable env(safe-area-inset-top)
keyboardInset = innerHeight - (vv.height + vv.offsetTop)
overlay padding-bottom = keyboardInset
sheet maxHeight = viewportHeight - safeAreaTop - marge
liste/input = scroll + padding dynamique quand clavier ouvert
```
