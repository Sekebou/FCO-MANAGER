

## Modernisation du Bilan, du Prochain Match et restriction des paris

### 1. Bilan V/N/D : design moderne sans cercles blancs

Remplacer les cercles avec fond blanc et bordure par un design plus moderne et integre :

- **Style "glass card"** : fond semi-transparent avec un leger blur, sans bordure epaisse
- Chaque stat dans une mini-carte avec un fond gradie subtil (vert pour V, gris pour N, rouge pour D)
- Le chiffre en gros, le label en dessous
- Un petit indicateur de couleur (barre ou dot) plutot qu'une bordure circulaire

**Rendu prevu** : 3 mini-cartes horizontales avec fond colore subtil, arrondies, compactes. Par exemple :
- V : fond `bg-emerald-500/10`, texte `text-emerald-500`, petit dot emerald
- N : fond `bg-slate-400/10`, texte `text-slate-400`
- D : fond `bg-red-500/10`, texte `text-red-500`

Taille compacte : `px-5 py-3 rounded-xl`

### 2. Prochain Match Hero : design premium

Refonte complete de la carte "Prochain Match" pour un rendu premium :

- **Fond gradient** sombre/accent au lieu de `bg-card` blanc basique
- **Layout centre** avec les logos plus grands et un "VS" stylise avec un effet glow
- **Countdown modernise** avec des cases individuelles arrondies et une separation ":" animee
- **Badge LIVE** plus visible avec un fond gradient rouge pulse
- **Bouton Parier** integre directement sous le countdown, design accent avec icone Zap et texte des cotes affichees (apercu rapide 1/N/2)
- **Lieu** affiche de maniere plus discrete en bas avec icone MapPin

### 3. Paris uniquement sur le prochain match

- **Supprimer** le bouton "Parier" de chaque match dans la liste "Prochains matchs" (lignes 832-844)
- Le pari ne sera possible **que** via le Hero du prochain match
- Une fois le match passe, le prochain match dans `liveUpcoming` prend sa place automatiquement (deja le cas dans la logique existante)

### Fichier modifie

| Fichier | Modifications |
|---------|--------------|
| `src/components/dashboard/ChampionnatTab.tsx` | Bilan redesigne, Hero prochain match premium, suppression boutons pari des matchs individuels |

### Details techniques

**Bilan (lignes 631-652)** : Remplacement des `w-14 h-14 rounded-full border-[3px]` par des mini-cartes `flex-1 px-4 py-3 rounded-xl bg-{color}/10` avec dot colore + chiffre + label.

**Hero prochain match (lignes 654-761)** : Refonte du container avec `bg-gradient-to-br from-slate-900 via-slate-800 to-accent/20` (dark mode natif), logos plus grands (`w-16 h-16`), VS avec `text-2xl` et effet de glow, countdown avec separateurs ":", bouton parier plus prominent avec apercu des cotes.

**Suppression paris individuels (lignes 832-844)** : Retrait du bouton "Parier" dans le mapping des matchs a venir.

