

## Corrections - Sélecteur d'équipe et Welcome

### 1. Sélecteur d'équipe : pills A/B/C + dropdown pour les autres

Remplacer le `<select>` unique par deux éléments côte à côte sur une seule ligne :

- **3 pills compactes** pour Équipe A, B, C (toujours visibles, style bouton actif/inactif)
- **Un dropdown moderne** (Select de Radix/shadcn) qui apparait uniquement si des équipes custom existent, avec le label "Autres" et une icône ChevronDown

Layout : `flex items-center gap-2` avec les 3 pills à gauche et le dropdown à droite.

**Fichier : `src/components/dashboard/ChampionnatTab.tsx` (lignes 555-577)**

Remplacer le bloc `<select>` par :

```text
<div className="flex items-center gap-1.5">
  {/* Pills A B C */}
  {BASE_TEAMS.map(team => (
    <button
      key={team}
      onClick={() => setSelectedTeam(team)}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
        selectedTeam === team
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:bg-secondary"
      )}
    >
      Éq. {team}
    </button>
  ))}

  {/* Dropdown pour les customs s'il y en a */}
  {customTeams.length > 0 && (
    <Popover>
      <PopoverTrigger>
        bouton "Autres" avec ChevronDown
      </PopoverTrigger>
      <PopoverContent>
        liste des équipes custom
      </PopoverContent>
    </Popover>
  )}
</div>
```

- "Éq. A", "Éq. B", "Éq. C" en labels courts pour tenir sur une ligne
- Si l'équipe sélectionnée est custom, le bouton "Autres" affiche le nom de l'équipe custom à la place

### 2. Welcome banner : icône Lucide native

Remplacer `Sparkles` par `Hand` (lucide-react) pour un rendu plus "app native" style salut.

**Fichier : `src/pages/Dashboard.tsx` (ligne 1131)**

- Importer `Hand` depuis lucide-react
- Remplacer `<Sparkles size={16} .../>` par `<Hand size={16} className="text-accent shrink-0" />`

### Résumé des fichiers

| Fichier | Modification |
|---------|-------------|
| `src/components/dashboard/ChampionnatTab.tsx` | Pills A/B/C + Popover dropdown pour les customs |
| `src/pages/Dashboard.tsx` | Remplacer Sparkles par Hand |

### Détails techniques

**Pills (ChampionnatTab.tsx)** :
- Utiliser le composant `Popover` / `PopoverTrigger` / `PopoverContent` de shadcn pour le dropdown "Autres"
- Le Popover aura un fond opaque (`bg-popover`), un `z-50`, et des items cliquables
- Chaque item custom dans le popover sera un bouton qui appelle `setSelectedTeam(team)` et ferme le popover
- Si l'équipe sélectionnée est custom, le bouton trigger affiche le nom au lieu de "Autres"
- Le container global garde `bg-secondary/60 backdrop-blur-sm rounded-xl border border-border/50 p-1`

**Welcome (Dashboard.tsx)** :
- Simplement remplacer l'icône, aucun changement de structure
