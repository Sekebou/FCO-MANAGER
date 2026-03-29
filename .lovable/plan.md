

## Correction de l'affichage du modal Convocations avec clavier virtuel

### Probleme identifie
Sur le screenshot, quand le clavier s'ouvre, le modal bascule en haut de l'ecran (`items-start`) avec un arrondi en bas, mais cela cree un rendu peu naturel : un espace gris visible entre le contenu et le clavier, et le modal semble "detache" — pas du tout natif.

### Solution
Arreter de basculer le modal de bas vers haut quand le clavier s'ouvre. A la place, garder le modal toujours ancre en bas (comportement bottom-sheet natif iOS/Android) et simplement reduire sa hauteur maximale pour correspondre exactement au `visualViewport.height`. Cela donne un rendu ou le modal reste colle au-dessus du clavier.

### Changements — `src/components/dashboard/ConvocationWizard.tsx`

1. **Conteneur overlay** (ligne 525) : Supprimer la logique conditionnelle `keyboardOpen ? 'items-start' : 'items-end'` → toujours `items-end`

2. **Modal sheet** (lignes 529-533) :
   - Supprimer les animations conditionnelles basees sur `keyboardOpen` — toujours animer depuis le bas (`y: '100%'`)
   - Supprimer la classe conditionnelle `keyboardOpen ? 'rounded-b-3xl border-b' : 'rounded-t-3xl border-t'` → toujours `rounded-t-3xl border-t`

3. **Max-height** (ligne 534) : Utiliser directement `viewportHeight * 0.95` quand le viewport est disponible, ce qui s'adapte automatiquement a l'espace restant au-dessus du clavier

4. **Variable `keyboardOpen`** : Conserver le state pour d'eventuels ajustements futurs, mais ne plus l'utiliser pour le positionnement du modal

### Resultat attendu
- Le modal reste toujours en bas de l'ecran (bottom-sheet classique)
- Quand le clavier s'ouvre, le modal se reduit en hauteur pour rester au-dessus du clavier
- Plus de gap ni de basculement haut/bas — rendu natif propre sur iOS et Android

