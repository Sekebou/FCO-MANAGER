
## Deux améliorations dans l'onglet Présences

### 1. Prénom + Nom mieux visibles dans les convocations

**Problème actuel** : Le nom de famille est affiché en `text-[11px] text-muted-foreground uppercase` — trop discret, trop petit, et potentiellement tronqué si le prénom prend toute la place avec `truncate`.

**Solution** : Restructurer le bloc nom pour que les deux parties soient lisibles :
- Prénom : `text-sm font-semibold text-foreground` (inchangé)
- Nom de famille : `text-sm font-medium text-foreground/70` (même taille, légèrement atténué — plus de `text-[11px]`, plus de `uppercase`)
- Conteneur : `flex flex-col leading-tight` au lieu de `flex items-baseline gap-1` pour éviter les problèmes de troncature sur mobile (deux lignes plutôt qu'une seule ligne compressée)

Résultat visuel :
```
[Avatar]  Jean
          DUPONT           [Convoqué] [Non convoqué]
```

### 2. Masquer la liste présences/absences quand on entre en mode convocation

**Objectif** : Quand le coach clique sur "Gérer les convocations", la liste des joueurs avec leurs boutons Présent/Absent occupe beaucoup de place inutilement. En masquant cette section, la page se concentre uniquement sur la sélection des joueurs à convoquer.

**Ce qui change** : Dans le rendu de la liste des présences (lignes 178-291), conditionner l'affichage entier avec `{!isConvocationMode && (...)}`.

Résultat :
- Mode normal : liste présences visible comme aujourd'hui
- Mode convocation activé : liste présences masquée, seule la section convocation est affichée → page allégée, focus sur la tâche

### Fichier modifié

`src/components/dashboard/PresencesTab.tsx`

**Changement 1** — Bloc nom (lignes 418-426) :
```tsx
// Avant
<div className="flex items-baseline gap-1 min-w-0">
  <span className="font-semibold text-sm text-foreground truncate">{firstName}</span>
  {lastName && <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">{lastName}</span>}
</div>

// Après
<div className="flex flex-col leading-tight min-w-0">
  <span className="font-semibold text-sm text-foreground">{firstName}</span>
  {lastName && <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">{lastName}</span>}
</div>
```

**Changement 2** — Wrapping de la liste présences (ligne 178) :
```tsx
// Avant
<div className="space-y-1.5">
  {/* liste joueurs */}
</div>

// Après
{!isConvocationMode && (
  <div className="space-y-1.5">
    {/* liste joueurs */}
  </div>
)}
```

### Impact

- Aucune logique métier modifiée
- Deux retouches chirurgicales dans le même fichier
- La liste des présences reste intacte, elle est juste masquée visuellement en mode édition convocation
