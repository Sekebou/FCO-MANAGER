
## Correction du bandeau d'info dans le mode convocation

### Problème

Le texte s'affiche collé : `"réponduPrésent"` car le `<span>` est directement accolé au texte sans espace React explicite. Le composant `<p>` est en `flex` avec `items-center`, ce qui supprime les espaces blancs entre les nœuds texte et les éléments inline.

### Cause technique

```tsx
// Actuel — le flex supprime les espaces entre les nœuds
<p className="... flex items-center gap-1.5">
  <Clock size={11} />
  Seuls les joueurs ayant répondu <span className="...">Présent</span> apparaissent ici.
</p>
```

En mode `flex`, les enfants deviennent des *flex items* — le nœud texte et le `<span>` sont deux items séparés, et le `gap-1.5` s'applique uniquement entre les enfants directs de flex, pas à l'intérieur d'un nœud texte mixte.

### Solution

Deux options possibles :

**Option retenue — restructurer en une seule chaîne via un `<span>` wrapper** :

```tsx
<div className="text-[11px] text-muted-foreground/70 bg-muted/40 rounded-lg px-3 py-1.5 mb-2 flex items-center gap-1.5">
  <Clock size={11} className="shrink-0 text-muted-foreground/50" />
  <span>
    Seuls les joueurs ayant répondu{' '}
    <span className="font-semibold text-accent/80">Présent</span>
    {' '}apparaissent ici.
  </span>
</div>
```

L'utilisation de `{' '}` (espace explicite React) garantit qu'il y a bien un espace avant et après le mot `Présent`, quelle que soit la mise en page. Le tout est dans un `<span>` inline qui se comporte comme un bloc de texte normal.

### Fichier modifié

`src/components/dashboard/PresencesTab.tsx` — ligne 382-385 uniquement.

### Impact

- Correction purement cosmétique
- Aucune logique modifiée
- Résultat : `"Seuls les joueurs ayant répondu Présent apparaissent ici."` avec l'espace correct de part et d'autre du mot en gras
