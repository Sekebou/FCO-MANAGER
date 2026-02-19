
## Remplacement des boutons de convocation par des boutons animés style "Présent/Absent"

### Contexte

Dans le mode édition des convocations (lignes 421-438 de `PresencesTab.tsx`), les boutons actuels sont de simples icônes sans texte ni animation. L'objectif est de les remplacer par des boutons plein texte **"Convoqué"** et **"Non convoqué"** avec les mêmes animations que les boutons Présent/Absent.

### Ce qui sera modifié

**Fichier : `src/components/dashboard/PresencesTab.tsx`** — Section du mode convocation (lignes 421-438)

Remplacement du rendu des boutons via `CONVOCATION_STATUSES.map(...)` par deux blocs distincts avec :

**Bouton "Convoqué"** (vert accent) :
- `whileTap={{ scale: 0.82 }}` au clic
- `animate` avec keyframes `[1, 1.25, 0.95, 1.08, 1]` quand actif
- 3 particules `✓` animées (`AnimatePresence`) qui s'envolent vers le haut
- Style actif : `bg-accent text-accent-foreground shadow-md shadow-accent/30`

**Bouton "Non convoqué"** (rouge destructive) :
- Mêmes animations mais avec keyframes `✕`
- Style actif : `bg-destructive text-destructive-foreground shadow-md shadow-destructive/30`

Les deux boutons affichent leur icône + texte (`<UserCheck size={12} /> Convoqué` et `<UserX size={12} /> Non convoqué`), avec le wrapper `relative overflow-visible` pour que les particules dépassent.

### Détail technique

```tsx
// Bouton "Convoqué"
<div className="relative overflow-visible">
  <motion.button
    onClick={() => updateDraft(player.id, { status: 'convoque' })}
    whileTap={{ scale: 0.82 }}
    animate={isConvoked ? { scale: [1, 1.25, 0.95, 1.08, 1] } : { scale: 1 }}
    transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
    className={`px-2.5 h-8 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition-colors ${
      isConvoked
        ? 'bg-accent text-accent-foreground shadow-md shadow-accent/30'
        : 'bg-card border border-border hover:border-accent/50 text-muted-foreground'
    }`}
  >
    <UserCheck size={12} /> Convoqué
  </motion.button>
  <AnimatePresence>
    {isConvoked && (
      <>
        <motion.span key={...} initial={{...}} animate={{...}} exit={{...}} className="...">✓</motion.span>
        {/* x2 autres particules */}
      </>
    )}
  </AnimatePresence>
</div>

// Bouton "Non convoqué" (même structure, couleurs destructive, particules ✕)
```

### Impact

- Aucune logique métier modifiée
- Uniquement le rendu des boutons dans le mode édition des convocations
- Cohérence visuelle totale avec les boutons Présent/Absent
