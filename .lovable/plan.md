

## Affichage automatique du classement FFF par equipe selectionnee

### Ce qui sera fait

Quand l'utilisateur clique sur Eq. A, B ou C, le classement de cette equipe se charge automatiquement depuis l'API FFF et s'affiche directement, sans avoir besoin de creer un championnat au prealable.

### Modifications

#### 1. `src/lib/fffApi.ts`

- Ajouter `clNo?: number` au type `ScrapedStanding` pour permettre le surlignage
- Reecrire `mapClassementToStandings` pour utiliser les vrais noms de champs API :
  - `rang` (pas `rank`)
  - `point_count`, `total_games_count`, `won_games_count`, `draw_games_count`, `lost_games_count`, `goals_for_count`, `goals_against_count`, `goals_diff`
  - Extraire `equipe.club.cl_no` dans `clNo`
- La fonction recevra directement le tableau `hydra:member` (tableau plat d'entrees de classement, pas de journees imbriquees)
- Corriger aussi `extractTeamLogosFromClassement` pour le meme format plat
- Ajouter une fonction utilitaire `getTeamChampionship(equipes, categoryCode, code)` qui trouve l'engagement `type === 'CH'` et retourne `{ cpNo, phase, poule }`

#### 2. `src/components/dashboard/ChampionnatTab.tsx`

- Ajouter un state `liveClassement` (tableau de standings) et `isLoadingLive` (boolean)
- Ajouter un `useEffect` qui se declenche quand `selectedTeam` change :
  1. Appeler `getEquipes(3246)` (ou reutiliser le cache si deja charge)
  2. Mapper A → SEM/code 1, B → SEM/code 2, C → SEM/code 3
  3. Trouver l'engagement `competition.type === 'CH'`
  4. Appeler `getClassement(cpNo, phase, poule)`
  5. Extraire `data['hydra:member']` et le passer a `mapClassementToStandings`
  6. Stocker dans `liveClassement`
- Afficher le classement live au-dessus de la liste des championnats :
  - Tableau : Rang, Equipe, Pts, J, G, N, P, Bp, Bc, Diff
  - Surligner la ligne ou `clNo === 3246` avec `bg-accent/15 border-l-4 border-l-accent`
  - Afficher un `Loader2` pendant le chargement
  - Si `hydra:totalItems === 0` ou tableau vide : "Classement non disponible"
- Corriger aussi `handleImportCompetition` pour extraire `classementData['hydra:member']` avant de le passer a `mapClassementToStandings`

### Mapping equipe selectionnee vers equipe FFF

| Selecteur | category_code | code | Resultat |
|-----------|--------------|------|----------|
| Eq. A | SEM | 1 | Seniors D2 (cp_no 443358) |
| Eq. B | SEM | 2 | Seniors D4 (cp_no 443360) |
| Eq. C | SEM | 3 | Seniors D6 (cp_no 443362) |

### Mapping des champs API (reference)

| Champ API FFF | Champ ScrapedStanding |
|---|---|
| `rang` | `rank` |
| `equipe.short_name` | `team` |
| `equipe.club.cl_no` | `clNo` |
| `point_count` | `points` |
| `total_games_count` | `played` |
| `won_games_count` | `won` |
| `draw_games_count` | `drawn` |
| `lost_games_count` | `lost` |
| `goals_for_count` | `goalsFor` |
| `goals_against_count` | `goalsAgainst` |
| `goals_diff` | `goalDiff` |

### Fichiers modifies

| Fichier | Action |
|---|---|
| `src/lib/fffApi.ts` | Corriger `mapClassementToStandings`, ajouter `clNo`, ajouter `getTeamChampionship` |
| `src/components/dashboard/ChampionnatTab.tsx` | Ajouter fetch automatique + affichage classement live + surlignage Oisemont |

