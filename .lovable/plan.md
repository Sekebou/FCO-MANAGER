
## Ajouter le badge icône dans les headers de tous les onglets

### Constat

L'onglet **Championnats** a un header avec un badge icône stylisé :
```tsx
<div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
  <Trophy className="text-accent" size={18} />
</div>
<div>
  <h2 className="text-lg sm:text-xl font-bold text-foreground">Championnats</h2>
  <p className="text-xs sm:text-sm text-muted-foreground">...</p>
</div>
```

Tous les autres onglets ont un header sans badge, juste un `h2` nu. L'objectif est d'uniformiser.

---

### Fichiers et modifications

#### 1. `src/components/dashboard/StatsTab.tsx` — ligne 79-81

Remplacer le `h2` nu par le pattern avec badge :
- Icône : `TrendingUp` (déjà importé)
- Titre : "Statistiques"

#### 2. `src/components/dashboard/NewsTab.tsx` — ligne 58-65

Remplacer le `h2` par le pattern avec badge dans le `flex justify-between` :
- Icône : `Bell` (déjà importé)
- Titre : "Au cœur du club"

#### 3. `src/components/dashboard/PresencesTab.tsx` — ligne 85-94

Remplacer le `h2` par le pattern avec badge :
- Icône : `ClipboardCheck` (à importer depuis lucide-react)
- Titre : "Gestion des présences"

#### 4. `src/components/dashboard/CalendarTab.tsx` — ligne 81

Remplacer le `h2` par le pattern avec badge :
- Icône : `CalendarDays` (déjà importé)
- Titre : "Calendrier"

#### 5. `src/components/dashboard/GalleryTab.tsx` — ligne 112-115

Remplacer `<Camera size={28} className="text-accent" />` + `h2` nu par le badge pattern :
- Icône : `Camera` (déjà importé)
- Titre : "Galerie photos"

#### 6. `src/components/dashboard/MembersTab.tsx` — ligne 74-81

Remplacer le `h2` nu par le badge pattern :
- Icône : `Users` (déjà importé)
- Titre : "Membres du club"

#### 7. `src/components/dashboard/ChatTab.tsx` — ligne 564-570 (vue `tabs` uniquement)

Remplacer le header du chat par le pattern avec badge :
- Icône : `MessageCircle` (déjà importé)
- Titre : "Discussions"

---

### Pattern exact à reproduire (identique à ChampionnatTab)

```tsx
<div className="flex items-center gap-2 sm:gap-3">
  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
    <IconName className="text-accent" size={18} />
  </div>
  <div>
    <h2 className="text-lg sm:text-xl font-bold text-foreground">Titre</h2>
    {/* sous-titre optionnel */}
  </div>
</div>
```

Les headers qui ont un bouton d'action à droite (Actus, Présences, Membres, Galerie) gardent leur `flex justify-between` — le badge et le titre s'encapsulent dans un `div flex items-center gap-2 sm:gap-3` à gauche.

### Fichiers modifiés

- `src/components/dashboard/StatsTab.tsx`
- `src/components/dashboard/NewsTab.tsx`
- `src/components/dashboard/PresencesTab.tsx`
- `src/components/dashboard/CalendarTab.tsx`
- `src/components/dashboard/GalleryTab.tsx`
- `src/components/dashboard/MembersTab.tsx`
- `src/components/dashboard/ChatTab.tsx`

### Impact

- Aucune modification de base de données
- Aucun changement de logique métier
- Purement cosmétique — cohérence visuelle entre tous les onglets
