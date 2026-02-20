
## Correction des deux bugs de l'onglet Championnats

### Bug 1 — Championnat toujours placé en équipe A

**Cause racine :** Dans `Dashboard.tsx`, la fonction `addChampionship` déstructure correctement `data` (qui contient `team`), mais l'insert Supabase n'inclut **pas** le champ `team` :

```ts
// Ligne 726-729 actuelle — team manquant !
await supabase.from('championships').insert({
  name: champData.name, season: champData.season, teams: champData.teams,
  fff_url: champData.fffUrl || null, fff_standings: standings || [], team_logos: teamLogos || {},
  // ← team: champData.team  OUBLIÉ !
})
```

Résultat : `team = null` en base. Le filtre `(c.team || 'A') === selectedTeam` transforme null en `'A'`, donc tout apparaît dans l'onglet Équipe A.

**Fix :** Ajouter `team: champData.team || 'A'` dans l'objet insert.

---

### Bug 2 — Points incorrects dans le classement (ex: 8 au lieu de 24)

**Cause racine :** Dans `supabase/functions/scrape-fff-teams/index.ts`, la fonction `extractStandings` suppose cet ordre de colonnes dans le tableau FFF :

```
| rank | Pr. | Team | Pts | J. | G. | N. | P. | F. | P/Bo | Bp | Bc | Diff |
  [0]    [1]   [2]   [3]  [4]
```

Mais le format réel du tableau FFF (tel que scraped par Firecrawl en markdown) est :

```
| rank | Pr. | Team | J. | Pts | G. | N. | P. | F. | P/Bo | Bp | Bc | Diff |
  [0]    [1]   [2]   [3]  [4]
```

Les colonnes **J. (matchs joués)** et **Pts (points)** sont **inversées**. Donc `cells[3]` = J. = 8 (matchs joués) et `cells[4]` = Pts = 24 (points réels).

**Fix :** La solution la plus robuste est de **lire dynamiquement l'ordre des colonnes depuis la ligne d'en-tête** plutôt que d'utiliser des indices fixes. On détecte la position de `Pts` et `J.` dans le header pour les utiliser correctement.

Voici la logique corrigée pour `extractStandings` :

```ts
// Dans le header, on détecte les positions
let ptsIdx = -1, jIdx = -1, gIdx = -1, nIdx = -1, pIdx = -1, fIdx = -1, pboIdx = -1, bpIdx = -1, bcIdx = -1, diffIdx = -1;

// Pour le header row | Pr. | | Pts | J. | ...
// On mappe les colonnes depuis la position du Pr. et Team (fixes)
// puis on utilise les positions détectées pour les valeurs numériques
```

Alternative simple (sans détection dynamique) : **inverser les indices** en changeant `cells[3]` → pts et `cells[4]` → j par `cells[3]` → j et `cells[4]` → pts.

Mais pour robustesse maximale, on parsera le header row pour trouver l'index exact de chaque colonne (`Pts`, `J.`, `G.`, `N.`, `P.`, `F.`, `P/Bo.`, `Bp.`, `Bc.`, `Diff.`).

---

### Fichiers modifiés

1. **`src/pages/Dashboard.tsx`** — 1 ligne ajoutée dans l'insert Supabase de `addChampionship`
2. **`supabase/functions/scrape-fff-teams/index.ts`** — Refonte de `extractStandings` pour détecter dynamiquement les positions des colonnes depuis le header

### Impact

- Aucune migration de base de données nécessaire (la colonne `team` existe déjà dans `championships`)
- Les championnats déjà créés avec `team = null` resteront en équipe A (comportement actuel préservé pour l'existant)
- La correction ne touche qu'au parsing et à l'insert — aucune logique métier modifiée
- Les nouveaux championnats seront correctement associés à leur équipe (A, B ou C)
- Les points du classement seront correctement lus depuis la colonne FFF appropriée
