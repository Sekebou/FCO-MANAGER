
# Animation de fin de tutoriel et bouton Présences en "pop-out"

## Problèmes actuels

### 1. Animation de fin trop rapide
- Le `setTimeout` dans `handleComplete` n'est que de **900ms**, l'écran de célébration disparaît avant que l'utilisateur puisse le voir correctement
- La redirection vers "Présences" est immédiate dans `onComplete` de `Dashboard.tsx`, donc le changement d'onglet est invisible sous l'écran de célébration
- Il faut allonger la durée et séquencer : célébration → fermeture overlay → changement d'onglet avec un délai visible

### 2. Bouton Présences à l'intérieur de la barre
- Actuellement le bouton a `marginTop: '-2rem'` mais la barre parent a `items-end` et une hauteur fixe, ce qui fait que le bouton reste visuellement **à l'intérieur** de la barre
- Il faut que le bouton **dépasse physiquement** vers le haut, au-dessus de la barre de fond
- Le fond de la barre doit avoir un "creux" ou laisser apparaître le bouton au-dessus

## Solutions

### Fichier 1 : `src/components/dashboard/OnboardingTutorial.tsx`

**Allonger la séquence de célébration :**
- `handleComplete` : passer le timeout de **900ms à 2200ms** pour que l'utilisateur voit bien la célébration
- Ajouter une **animation de transition** vers l'onglet Présences : afficher l'icône `ClipboardCheck` animée qui "vole" vers le bas (vers la BottomTabBar) juste avant la fermeture
- Enrichir l'écran de célébration :
  - Texte "C'est parti 🎉" → reste mais plus grand, avec un sous-texte "Tu es redirigé vers Présences" 
  - Ajouter une flèche animée qui pointe vers le bas (vers la barre de navigation)
  - Conserver les rings radiatifs mais les laisser plus longtemps visibles

### Fichier 2 : `src/components/dashboard/BottomTabBar.tsx`

**Faire sortir réellement le bouton Présences de la barre :**

La structure actuelle pose le problème : le container `relative` de la barre englobe tout. Il faut restructurer pour que le bouton featured soit **en dehors du flow de la barre** mais positionné absolument au-dessus.

Approche :
```text
STRUCTURE ACTUELLE :
┌─────────────────────────────┐ ← barre (z-50)
│ Stats  Classem. [Présences] │   bouton à l'intérieur
└─────────────────────────────┘

STRUCTURE CIBLE :
        [Présences]            ← bouton (z-51) au-dessus
┌────────────────────────────┐ ← barre (z-50) avec espace central
│ Stats  Classem.    Calendr.│
└────────────────────────────┘
```

**Implémentation concrète :**
1. Wrapper la barre dans un conteneur `relative` qui a de la **hauteur supplémentaire en haut** (ex: `pt-8`) pour "réserver" l'espace du bouton featured
2. Positionner le bouton `Présences` en **`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2`** sur le wrapper, pour qu'il soit à cheval entre l'extérieur et la barre
3. Le fond de la barre utilise `inset-0` mais avec une forme qui laisse un "creux" en haut au centre — via un `clipPath` arrondi ou simplement en ajoutant un cercle blanc/card en arrière-plan derrière le bouton featured (style FAB)
4. Ajouter un **cercle de fond** derrière le bouton (même couleur que la barre) avec `border-t` pour simuler la barre qui "accueille" le bouton
5. Animation d'entrée du bouton avec un `spring` depuis le bas (scale + translateY)

**Animation de l'icône Présences lors de la redirection :**
- Quand `activeTab` passe à `'presences'`, déclencher une animation :
  - Scale pulse : `[1, 1.25, 1]`
  - Rotation : `[0, -10, 10, 0]` 
  - Glow qui s'intensifie momentanément
  - Durée : ~800ms visible

### Fichier 3 : `src/pages/Dashboard.tsx`

**Séquencer la redirection :**
```ts
onComplete={() => {
  setShowTutorial(false);
  setTutorialMandatory(false);
  // Délai pour laisser l'overlay se fermer avant de changer l'onglet
  setTimeout(() => setActiveTab('presences'), 400);
}}
```
Ainsi l'utilisateur voit d'abord l'onglet en cours, puis la barre de navigation reprend vie avec l'onglet Présences animé.

## Résumé des changements

| Fichier | Changement |
|---|---|
| `OnboardingTutorial.tsx` | Timeout 900ms → 2200ms, écran célébration enrichi avec flèche et texte de redirection |
| `BottomTabBar.tsx` | Restructuration du bouton Présences en position absolue au-dessus de la barre + animation forte à l'activation |
| `Dashboard.tsx` | Délai de 400ms avant `setActiveTab('presences')` pour que la transition soit visible |
