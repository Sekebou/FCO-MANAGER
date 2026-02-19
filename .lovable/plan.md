
## Amélioration de la ligne joueur dans le mode Convocation

### Problèmes identifiés

1. **Affichage du nom** : `player.name` est affiché en un seul bloc. Il n'existe pas de champ `firstName`/`lastName` séparé dans les types `Player` ou `Member`. La solution est de découper `player.name` sur le premier espace pour afficher le prénom en gras et le nom de famille en secondaire.

2. **Sélecteur de poste** : C'est un `<select>` brut avec `font-size: 16px` (anti-zoom iOS) mais sans habillage visuel — il apparaît trop grand et peu raffiné.

3. **Input numéro** : Même problème, trop large (w-16) et visuellement lourd pour un simple numéro 1-99.

---

### Solution retenue : Sélecteurs "flat" avec overlay invisible (pattern existant)

Le projet utilise déjà ce pattern dans `MembersTab.tsx` pour les sélecteurs de poste/rôle : un affichage visuel compact + un `<select>` invisible superposé avec `font-size: 16px` pour éviter le zoom iOS. On applique le même principe ici.

---

### Ce qui sera modifié

**Fichier : `src/components/dashboard/PresencesTab.tsx`** — Section lignes 403-495

**1. Ligne joueur (informations)**

Découpage du nom :
```tsx
const [firstName, ...rest] = player.name.split(' ');
const lastName = rest.join(' ');
```

Affichage restructuré :
```
[Avatar] [Prénom en gras] [NOM en muted] [Poste si mobile masqué → gardé]
```

**2. Sélecteur de poste — style "flat natif"**

Remplacement du `<select>` brut par un wrapper visuel élégant :
```
┌────────────────────────────────────┐
│  Gardien          ˅               │  ← label visible, petit, compact
└────────────────────────────────────┘
       [select opacity-0 par-dessus, font-size:16px]
```

Classes visuelles : `bg-secondary/50 border border-border/60 rounded-lg px-2 py-1 text-[11px] font-medium`
Icône : `ChevronDown size={9}` en muted à droite

**3. Input numéro — style "flat natif"**

Remplacement de l'input large par un champ ultra-compact :
- Largeur : `w-12` au lieu de `w-16`
- Hauteur : `h-7` (28px)
- Style : même bg/border que le sélecteur de poste
- Placeholder : `#` centré
- `font-size: 16px` inline pour anti-zoom iOS
- `text-[11px]` pour l'affichage visuel

**Résultat visuel attendu**

```
[Avatar] Jean DUPONT                    [✓ Convoqué] [✕ Non conv.]

         [Défenseur central ˅]  [# 5]   ← compact, natif, discret
```

La ligne d'édition (poste + numéro) n'apparaît que quand `isConvoked === true`, ce qui reste inchangé.

### Impact

- Aucune logique métier modifiée
- Aucun type à modifier (`name` est splitté à la volée)
- Cohérence visuelle avec le pattern de `MembersTab.tsx`
- Respect de l'anti-zoom iOS (font-size 16px sur les éléments natifs)
