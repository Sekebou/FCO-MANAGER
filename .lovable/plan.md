
## Repositionner la bulle de chat pour ne jamais gêner les boutons

### Problème actuel

La bulle flottante est positionnée en `fixed` à droite (`right-4`) à une hauteur calculée (`bottom-[calc(8rem+env(safe-area-inset-bottom))]`). Deux problèmes persistent sur mobile :

1. **Bulle fermée** : elle se superpose visuellement aux boutons d'action (Présent/Absent, Convoquer, etc.) qui sont dans le contenu scrollable, surtout sur les petits écrans (iPhone SE, 375px)
2. **Bulle ouverte** : le panel de chat (`60vh`) + le bouton de fermeture en dessous poussent l'ensemble très bas et peuvent chevauchent la BottomTabBar ou nécessiter que l'utilisateur scrolle le panel lui-même

### Analyse de la hauteur de la BottomTabBar

La `BottomTabBar` est `fixed bottom-0` avec :
- Mobile : `pb-[max(0.5rem,env(safe-area-inset-bottom))]` + les items (~72px total)
- La bulle doit donc être au minimum à `~80px + safe-area` du bas

Actuellement `calc(8rem + safe-area)` = ~128px → c'est déjà au-dessus de la tab bar, mais le panel ouvert dépasse vers le bas.

### Solution — 3 changements coordonnés

**1. Déplacer la bulle fermée à gauche sur mobile**

Au lieu de `right-4` (côté droit où se trouvent souvent les boutons d'action), positionner la bulle **à gauche** sur mobile. Sur la plupart des apps mobiles les boutons d'action principaux sont à droite. La bulle à gauche évite tout conflit.

```tsx
// Avant
"fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] lg:bottom-24 right-4 sm:right-6 z-50"

// Après  
"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:right-6 sm:left-auto z-50"
```

Sur mobile : coin **bas-gauche**, juste au-dessus de la tab bar (~88px du bas)
Sur tablette/desktop : reste en bas-droite (comportement inchangé)

**2. Le panel ouvert — ancré en bas-gauche sur mobile, centré horizontalement**

Quand `chatOpen === true`, le panel s'ouvre depuis la gauche sur mobile. La largeur reste `calc(100vw - 2rem)` mais l'ancrage change :

```tsx
// Avant
"fixed bottom-[calc(8rem+...)] right-4 sm:right-6 z-50 flex flex-col items-end gap-3"

// Après
"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 sm:left-auto sm:right-6 z-50 flex flex-col items-start sm:items-end gap-3"
```

**3. Hauteur du panel ajustée pour ne pas dépasser vers le bas**

Le panel `60vh` peut être trop haut sur certains mobiles. Utiliser une hauteur max calculée pour ne jamais toucher la BottomTabBar :

```tsx
// Avant
"h-[60vh] sm:h-[540px] max-h-[75vh]"

// Après  
"h-[55vh] sm:h-[540px] max-h-[calc(100dvh-12rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))]"
```

`dvh` (dynamic viewport height) s'adapte au clavier virtuel iOS/Android.

### Résultat visuel

```text
┌─────────────────────────────┐
│  Header (safe-area-top)     │
│                             │
│  Contenu scrollable         │
│  [Bouton Présent] [Absent]  │  ← jamais masqués
│                             │
│  ┌───────────────────┐      │
│  │  Panel Chat       │      │ ← ancré à gauche, height calculée
│  │  (55vh max)       │      │
│  └───────────────────┘      │
│  🔵 (bulle gauche)          │ ← juste au-dessus de la tab bar
├─────────────────────────────┤
│  BottomTabBar (fixed)       │
└─────────────────────────────┘
```

### Fichier modifié

`src/components/dashboard/ChatBubble.tsx` — uniquement les deux blocs `return` (lignes 396-409) :
- Bulle fermée : classes de positionnement `right-4` → `left-3` sur mobile
- Panel ouvert : idem + hauteur `max-h` recalculée

### Impact

- Aucune logique de messagerie modifiée
- Aucune base de données touchée
- Changement purement CSS/layout
- Compatible safe-area iOS natif (Capacitor)
- Sur tablette/desktop : comportement identique à aujourd'hui
