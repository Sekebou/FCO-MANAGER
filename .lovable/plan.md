

## Migration du scraping vers l'API FFF + Suppression du double menu

### Partie 1 : Remplacement du scraping par l'API FFF

#### 1. Creer `src/lib/fffApi.ts`

Nouveau fichier avec les fonctions d'appel a l'API FFF via le proxy Edge Function :
- `callFFF(endpoint)` : appel central via `supabase.functions.invoke('fff-proxy')`
- `getEquipes(clubId)` : recupere les equipes + logos + cp_no
- `getResultats(cpNo, phase, poule)` : resultats passes
- `getCalendrier(cpNo, phase, poule)` : prochains matchs
- `getClassement(cpNo, phase, poule)` : classement
- `getAllCompetitions(equipes)` : liste toutes les competitions d'un club

Le `cl_no` d'Oisemont est 3246 (hardcode comme constante).

#### 2. Creer l'Edge Function `supabase/functions/fff-proxy/index.ts`

Simple proxy qui :
- Recoit un `{ endpoint }` dans le body
- Fait `fetch('https://api-dofa.fff.fr/api' + endpoint)` cote serveur
- Retourne le JSON au front
- Gere les headers CORS standards

Pas besoin de secret supplementaire (API publique sans cle).

#### 3. Mettre a jour `supabase/config.toml`

Ajouter la config `verify_jwt = false` pour la nouvelle fonction `fff-proxy`.

#### 4. Modifier le formulaire de creation de championnat dans `ChampionnatTab.tsx`

Remplacer le champ "URL FFF" par un systeme en 2 etapes :
1. Au lieu de coller une URL, l'utilisateur choisit parmi les equipes du club (recuperees via `getEquipes(3246)`)
2. Pour l'equipe selectionnee, on recupere automatiquement ses competitions (via `getAllCompetitions`)
3. L'utilisateur choisit la competition (championnat)
4. On importe classement + matchs via `getClassement` et `getResultats`/`getCalendrier`

Les donnees stockees en base changent :
- `fff_url` est remplace par `fff_cp_no` (numero de competition), `fff_phase`, `fff_poule` (stockes dans le champ existant `fff_url` sous forme JSON ou dans de nouvelles colonnes)

Alternative plus simple (sans migration de schema) : on stocke dans `fff_url` une string encodee comme `"cp:443362:1:1"` (cp_no:phase:poule) pour rester compatible avec la colonne existante.

#### 5. Modifier `refreshFromFFF` dans `Dashboard.tsx`

Au lieu d'appeler `scrapeFFFTeams`, appeler les fonctions de `fffApi.ts` :
- `getClassement(cpNo, phase, poule)` pour le classement
- `getResultats(cpNo, phase, poule)` pour les matchs joues
- `getCalendrier(cpNo, phase, poule)` pour les matchs a venir

Transformer les donnees API en format `ScrapedStanding[]` et `ScrapedMatch[]` existants pour garder l'affichage identique.

#### 6. Mettre a jour `auto-refresh-championships`

Remplacer l'appel a `scrape-fff-teams` par un appel direct a l'API FFF via `fff-proxy`, en utilisant le `cpNo/phase/poule` stocke.

#### 7. Supprimer l'ancien systeme de scraping

- Supprimer `supabase/functions/scrape-fff-teams/` (Edge Function)
- Supprimer `src/lib/api/scrape-fff.ts`
- Nettoyer les imports dans `ChampionnatTab.tsx` et `Dashboard.tsx`

### Partie 2 : Suppression du double menu (tablette)

Actuellement sur les ecrans larges (`lg+`), il y a :
- La barre de navigation en haut (top nav, `hidden lg:block`)
- La barre d'onglets en bas (BottomTabBar, toujours visible)

**Fix :** Supprimer completement la navigation du haut dans `Dashboard.tsx` (le bloc `<nav>` a la ligne 981) et garder uniquement la BottomTabBar pour toutes les tailles d'ecran. La BottomTabBar a deja un rendu optimise pour tablette (`md:flex` avec taille fixe centree).

Cela implique aussi :
- Retirer `lg:pb-0` du container principal (garder le padding en bas pour toutes les tailles)
- S'assurer que le header (logo + avatar + deconnexion) reste visible sur toutes les tailles

---

### Schema des donnees stockees (sans migration)

On reutilise la colonne `fff_url` existante pour stocker l'identifiant API au format :
```
fff-api::{cp_no}::{phase}::{poule}
```
Exemple : `fff-api::443362::1::1`

Cela permet de distinguer les anciens URLs de scraping des nouveaux identifiants API.

### Fichiers modifies/crees

| Fichier | Action |
|---------|--------|
| `src/lib/fffApi.ts` | Creer |
| `supabase/functions/fff-proxy/index.ts` | Creer |
| `src/components/dashboard/ChampionnatTab.tsx` | Modifier (formulaire + imports) |
| `src/pages/Dashboard.tsx` | Modifier (refreshFromFFF + suppression nav + imports) |
| `supabase/functions/auto-refresh-championships/index.ts` | Modifier |
| `supabase/functions/scrape-fff-teams/index.ts` | Supprimer |
| `src/lib/api/scrape-fff.ts` | Supprimer |

### Donnees de l'API FFF utilisees

- **Logo club** : `equipe.club.logo` (URL CDN directe)
- **Match joue** : `home_score !== null`
- **Match a venir** : `home_score === null`
- **Match reporte** : `status_label === "Reporte"`
- **Classement** : champs `rank`, `pts`, `played`, `won`, `drawn`, `lost`, `goals_for`, `goals_against`, `goal_diff` (mappes vers le format `ScrapedStanding` existant)

