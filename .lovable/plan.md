
## Corriger le bug : bulle de chat sous la navbar sur la page Présences

### Cause du problème

La `BottomTabBar` (`fixed bottom-0 z-50`) et la bulle de chat (`fixed z-50`) ont le **même niveau de z-index (50)**. En CSS, quand deux éléments `fixed` ont le même z-index, c'est **l'ordre d'apparition dans le DOM** qui décide lequel s'affiche au-dessus. La `BottomTabBar` étant rendue après la bulle dans l'arbre React, elle passe par-dessus la bulle.

Sur la page Présences en particulier, le re-rendu du composant `PresencesTab` peut modifier l'ordre de rendu et aggraver le problème.

### Solution — 1 fichier, 2 lignes

Augmenter le z-index de la bulle de `z-50` à `z-[60]` dans `ChatBubble.tsx`. Cela garantit qu'elle est toujours au-dessus de la `BottomTabBar` (z-50), quelle que soit la page.

```tsx
// Bulle fermée — ligne 398
// Avant
"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-50"
// Après
"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-[60]"

// Panel ouvert — ligne 407
// Avant
"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-50 flex flex-col items-start sm:items-end gap-3"
// Après
"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-[60] flex flex-col items-start sm:items-end gap-3"
```

### Hiérarchie des z-index après correction

```text
z-[60]  → Bulle de chat (toujours au-dessus)
z-50    → BottomTabBar
z-50    → Modals (backdrop z-60 déjà géré par radix)
```

### Fichier modifié

`src/components/dashboard/ChatBubble.tsx` — lignes 398 et 407 uniquement : `z-50` → `z-[60]`

### Impact

- Correction purement CSS, aucune logique modifiée
- Aucune base de données touchée
- Le panel de chat ouvert sera également au-dessus de la navbar (comportement attendu)
- Compatible toutes pages (Présences, Calendrier, etc.)
