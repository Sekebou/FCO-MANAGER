

## Problème

Le modal Convocation (bottom-sheet) monte trop haut et passe sous la barre de statut iPhone (heure, batterie). Le `maxHeight` à 92% du viewport ne suffit pas car il ne tient pas compte du safe-area-inset-top (encoche/Dynamic Island).

## Solution

Modifier le calcul du `maxHeight` dans `ConvocationWizard.tsx` pour soustraire le safe-area-inset-top du viewport, garantissant que le header reste toujours sous la barre de statut.

### Fichier : `src/components/dashboard/ConvocationWizard.tsx`

1. **Lire le safe-area-inset-top** dans le useEffect qui track le visualViewport :
   - Récupérer `env(safe-area-inset-top)` via `getComputedStyle` ou un fallback de ~50px
   - Stocker dans un state `safeAreaTop`

2. **Ajuster le maxHeight** (ligne 554) :
   - Changer de `viewportHeight * 0.92` à `viewportHeight - safeAreaTop - 8` (8px de marge supplémentaire)
   - Cela garantit que le modal ne déborde jamais dans la zone de statut, quelle que soit la taille de l'encoche

Le fix est purement CSS/layout, aucun changement fonctionnel. La recherche joueur reste intacte.

