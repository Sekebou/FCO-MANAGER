
# Corrections : onglets coupés + bulle de chat simplifiée

## Problème 1 — Onglets rognés sur les côtés

### Cause
Le conteneur scrollable de la `BottomTabBar` a seulement `px-1` de padding horizontal. Quand l'utilisateur scrolle jusqu'au premier onglet (Stats) ou au dernier (Membres), une partie de l'icône ou du label est visuellement coupée par les bords de l'écran.

### Solution
- Ajouter `scroll-padding-inline` et remplacer `px-1` par **`pl-3 pr-3`** sur le conteneur scrollable pour que les onglets extrêmes ne collent pas aux bords
- Ajouter un **fade gradient** à gauche et à droite de la barre (pseudo-overlay `pointer-events-none`) pour signaler visuellement qu'il y a du contenu scrollable et masquer la coupure nette
- Les fades seront deux `div` absolues avec `bg-gradient-to-r from-card to-transparent` (et l'inverse à droite), qui disparaissent progressivement

## Problème 2 — Bulle de chat à simplifier

### Cause
L'utilisateur a dit "non non déplorable" concernant la bulle de chat draggable/déplaçable. Le drag est trop complexe sur mobile, il cause des conflits de gestes et n'est pas agréable.

### Solution : position fixe simple, propre et discrète
Revenir à une **bulle fixe positionnée** sans drag, à une hauteur intermédiaire pour ne pas gêner la bottom bar, avec un design épuré :

- **Position** : `fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4` sur mobile — juste au-dessus de la barre de navigation
- **Design bulle fermée** : rond de 52px, couleur `accent`, ombre douce, badge non-lus
- **Panneau ouvert** : ancré en bas à droite, sans drag handle, avec juste un bouton X pour fermer — simple et fonctionnel
- Supprimer entièrement le système de `drag` / `dragControls` / `useDragControls` / `GripHorizontal`

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/components/dashboard/BottomTabBar.tsx` | Augmenter le padding latéral du scroll container + ajouter fades aux extrémités |
| `src/components/dashboard/ChatBubble.tsx` | Supprimer le drag, position fixe simple, panneau épuré sans poignée |

## Détail technique

### BottomTabBar — Fades aux extrémités
```text
┌──────────────────────────────────────┐
│▓▓▓[Stats][Clasmt][Actus][Pres][Cal]▓▓▓│
│← fade                       fade →  │
└──────────────────────────────────────┘
```
Deux `div` absolues `z-10 pointer-events-none` :
- Gauche : `left-0 w-6 bg-gradient-to-r from-card to-transparent`
- Droite : `right-0 w-6 bg-gradient-to-l from-card to-transparent`

Et `px-4` sur le scroll container pour que les onglets démarrent décalés des bords.

### ChatBubble — Structure simplifiée
```text
FERMÉE :               OUVERTE :
[💬]  ←  rond fixe    ┌─────────────┐
        en bas droite  │ Discussion  │[X]
                       │ ...         │
                       │             │
                       └─────────────┘
                          (ancré bas droite)
```

Le panneau ouvert reste `fixed bottom-[...] right-4` avec `w-[calc(100vw-2rem)] sm:w-[380px] h-[60vh]` — identique à avant mais sans le système de drag.
