

## Plan : Enrichir le classement, bilan minimaliste, lieu cliquable, prochain match en vedette et systeme de paris

Ce plan couvre 5 grands axes de modifications.

---

### 1. Tableau de classement enrichi (colonnes completes)

Ajouter toutes les colonnes statistiques au tableau de classement : **G (Gagne), N (Nul), P (Perdu), F (Forfaits), P/Bo (Penalites/Bonus), Bp (Buts pour), Bc (Buts contre), Diff (Difference), Serie en cours**.

**Modifications :**
- `src/components/dashboard/ChampionnatTab.tsx` : Elargir la grille du classement avec un scroll horizontal pour supporter toutes les colonnes sur mobile
- `src/lib/fffApi.ts` : Ajouter un champ `series` (ou `streak`) au type `ScrapedStanding` en extrayant la serie en cours depuis les resultats (calculee a partir des derniers matchs)
- Colonnes affichees : Rang | Logo + Nom | Pts | J | G | N | P | F | P/Bo | Bp | Bc | Diff | Serie

La serie en cours sera calculee cote client a partir des derniers resultats (ex: "VVN", "DDD") et affichee sous forme de pastilles colorees (vert=V, gris=N, rouge=D).

---

### 2. Bilan en ronds minimalistes

Remplacer les cartes rectangulaires du bilan V/N/D par des **cercles minimalistes** compacts.

**Modifications :**
- `src/components/dashboard/ChampionnatTab.tsx` : Section bilan redesignee
- 3 cercles alignes horizontalement : cercle vert (Victoires), cercle gris (Nuls), cercle rouge (Defaites)
- Chiffre au centre du cercle, label en dessous
- Style : `w-14 h-14 rounded-full` avec bordure coloree, chiffre `text-lg font-black` au centre

---

### 3. Lieu cliquable pour les prochains matchs

Ajouter un lien Waze/Google Maps propre pour chaque prochain match, avec une icone flat.

**Modifications :**
- `src/components/dashboard/ChampionnatTab.tsx` : Dans la section "Prochains matchs", modifier l'affichage de la ville/terrain
- Utiliser le meme pattern que `PresencesTab.tsx` : icone `MapPin` + `ExternalLink`, texte tronque, lien vers `https://waze.com/ul?q=...`
- Construire l'adresse a partir de `match.terrain?.name` + `match.terrain?.city`
- Style propre : `text-[11px] text-accent/80 underline truncate`, pas de lien brut visible

---

### 4. Prochain match en vedette avec decompte

Mettre en avant LE prochain match (le plus proche) dans une carte speciale centree, avec un compte a rebours en temps reel.

**Modifications :**
- `src/components/dashboard/ChampionnatTab.tsx` : Nouvelle section "PROCHAIN MATCH" placee apres le bilan et avant la grille matchs
- Carte speciale avec :
  - Logos des 2 equipes, noms complets, "VS" au centre
  - Decompte en temps reel (jours, heures, minutes, secondes) via `setInterval` chaque seconde
  - Date et heure du match
  - Lieu cliquable (meme pattern Waze)
  - Badge "LIVE MATCH" pulse quand le match est en cours (date du jour)
- Logique : prendre le premier match de `liveUpcoming` qui est le plus proche

---

### 5. Systeme de paris gratuits avec monnaie virtuelle

Creer un systeme complet de paris sur les matchs avec des points virtuels.

#### 5a. Base de donnees (nouvelles tables)

**Table `user_points`** :
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `balance` (integer, DEFAULT 100)
- `total_won` (integer, DEFAULT 0)
- `total_bet` (integer, DEFAULT 0)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

RLS : chaque utilisateur peut voir tous les soldes (classement), mais ne peut modifier que le sien.

**Table `bets`** :
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `user_name` (text, NOT NULL)
- `match_date` (text, NOT NULL)
- `home_team` (text, NOT NULL)
- `away_team` (text, NOT NULL)
- `prediction` (text, NOT NULL) — "home", "draw", "away"
- `odds` (numeric, NOT NULL) — cote entre 1.5 et 5
- `amount` (integer, NOT NULL) — mise en points
- `status` (text, DEFAULT 'pending') — "pending", "won", "lost"
- `payout` (integer, DEFAULT 0)
- `created_at` (timestamptz)
- `settled_at` (timestamptz)

RLS : tous les authenticated peuvent voir tous les paris, chaque utilisateur peut inserer ses propres paris, seuls les admins peuvent mettre a jour (pour regler les paris).

**Table `points_transactions`** :
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `amount` (integer, NOT NULL) — positif ou negatif
- `type` (text) — "bet", "win", "bonus"
- `description` (text)
- `created_at` (timestamptz)

RLS : chaque utilisateur voit ses propres transactions.

#### 5b. Cotes automatiques aleatoires

Les cotes seront generees cote client lors de l'affichage d'un match :
- Basees sur un hash deterministe (date + equipes) pour etre stables
- Plage de 1.5 a 5.0
- 3 cotes par match : victoire domicile, nul, victoire exterieur
- La somme des probabilites implicites depasse 100% (marge classique)

#### 5c. Interface de paris

**Modifications :**
- `src/components/dashboard/ChampionnatTab.tsx` : Ajouter un bouton "Parier" sur la carte du prochain match en vedette et sur chaque match a venir
- Nouveau composant `src/components/dashboard/BetModal.tsx` :
  - Affiche les 3 cotes (1 / N / 2)
  - Slider ou input pour la mise (min 1, max le solde du joueur)
  - Gain potentiel affiche en temps reel (mise x cote)
  - Bouton de confirmation
- Nouveau composant `src/components/dashboard/BetLeaderboard.tsx` :
  - Classement des meilleurs parieurs par gains totaux
  - Affiche dans l'onglet Championnats sous les matchs

#### 5d. Animation LIVE MATCH

Quand un match est en cours (date = aujourd'hui) :
- Badge "LIVE MATCH" avec animation pulse rouge
- Point rouge clignotant
- Les paris sur ce match passent en mode "EN COURS" (plus de nouveaux paris possibles)
- Fond de carte subtil avec animation de bordure

#### 5e. Reglement des paris

- Fait manuellement par les admins via un bouton "Regler les paris" sur les resultats
- Ou automatiquement quand le score est entre dans les resultats FFF
- Le gain est calcule : mise x cote, credite au solde du joueur
- Notification toast pour le gagnant

---

### Resume des fichiers modifies/crees

| Fichier | Action |
|---------|--------|
| `src/lib/fffApi.ts` | Ajouter champ `series` au ScrapedStanding |
| `src/components/dashboard/ChampionnatTab.tsx` | Tableau enrichi, bilan rond, prochain match vedette, lieu cliquable, integration paris |
| `src/components/dashboard/BetModal.tsx` | Nouveau — Modal de pari |
| `src/components/dashboard/BetLeaderboard.tsx` | Nouveau — Classement des parieurs |
| Migration SQL | 3 nouvelles tables : `user_points`, `bets`, `points_transactions` avec RLS |

### Ordre d'implementation

1. Migration SQL (tables + RLS)
2. `fffApi.ts` (series)
3. `ChampionnatTab.tsx` (classement enrichi + bilan rond + lieu + prochain match vedette)
4. `BetModal.tsx` + `BetLeaderboard.tsx` (systeme de paris)
5. Integration du tout dans ChampionnatTab

