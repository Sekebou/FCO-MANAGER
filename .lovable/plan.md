
## Correction définitive du classement FFF + Mise à jour automatique hebdomadaire

### Diagnostic précis du bug de parsing

Les logs confirment que le header est bien détecté :
```
"Pr.", "Equipe", "Pts", "J.", "G.", "N.", "P.", "F.", "P/Bo.", "Bp.", "Bc.", "Diff."
→  [0]     [1]    [2]   [3]   [4]   [5]   [6]   [7]     [8]    [9]   [10]   [11]
```
Donc `idxPts = 2`, `idxJ = 3`, etc.

Mais dans les **lignes de données**, quand on split par `|`, la cellule "Equipe" (qui contient le lien markdown `[![undefined](url) HARONDEL ES](url)`) génère des `|` parasites ou élargit les cellules, ce qui décale tous les indices. Résultat en base de données :

```
HARONDEL ES : rank=1, pts=24, played=8, won=8 → pts OK par hasard
AMIENS MONTIERES CS : played=13, won=8, pts=0 → incohérent, colonnes mélangées
OISEMONT FC : rank=8, played=7, won=8 → impossible
```

### Solution de parsing robuste

Au lieu d'utiliser des **indices absolus** (qui dépendent de la position du lien équipe dans le split), la nouvelle stratégie :

1. **Extraire la partie numérique de la ligne** : après avoir isolé le nom de l'équipe (via regex), on supprime le bloc lien de la ligne et on ne split que les cellules restantes (toutes numériques ou texte court).

2. **Aligner les colonnes numériques** sur les colonnes du header **à partir de la colonne Pts** (index 2 dans le header = index 0 dans les cellules numériques après suppression du bloc rank + lien-equipe).

La stratégie concrète :
```text
Ligne raw: | 1 | [![...](logo) HARONDEL ES](url) | 24 | 8 | 8 | 0 | 0 | 0 | 0 | 25 | 1 | 24 | ... |

Étape 1 : extraire rank = cells[0] = "1"
Étape 2 : extraire teamName via regex
Étape 3 : supprimer tout jusqu'après le lien équipe, puis re-split
          → numCells = ["24", "8", "8", "0", "0", "0", "0", "25", "1", "24", ...]
Étape 4 : aligner sur header à partir de index idxPts (en soustrayant l'offset = idxPts)
          numCells[0] = Pts, numCells[1] = J, numCells[2] = G, ...
```

### Mise à jour automatique hebdomadaire

Après le match du dimanche, le classement doit se mettre à jour automatiquement. Stratégie :

- **Cron job pg_cron** : tous les **lundis à 8h00** (heure française = 7h UTC), appel HTTP vers l'edge function `scrape-fff-teams` pour chaque championnat ayant une `fff_url` configurée.
- La fonction de mise à jour existante (`refreshFromFFF`) sera appelée via une **nouvelle edge function** dédiée (`auto-refresh-championships`) qui :
  1. Récupère tous les championnats avec une `fff_url` depuis la base
  2. Pour chacun, appelle `scrape-fff-teams` et met à jour les standings + scores

### Fichiers modifiés

1. **`supabase/functions/scrape-fff-teams/index.ts`** — Réécriture de `extractStandings` avec la nouvelle stratégie de parsing (extraction numérique relative)
2. **`supabase/functions/auto-refresh-championships/index.ts`** — Nouvelle edge function pour la mise à jour automatique
3. **Migration SQL** — Activation de `pg_cron` + création du job hebdomadaire (lundi 7h UTC)

### Impact

- Aucune modification de schéma de base de données
- Les championnats existants avec `fff_url` seront mis à jour automatiquement chaque lundi
- Les mises à jour manuelles (bouton Refresh) continuent de fonctionner
- La correction du parsing garantit des points corrects (HARONDEL ES = 24 pts, OISEMONT FC au bon rang)
