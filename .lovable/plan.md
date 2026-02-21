

## Plan de modernisation : Paris, Points, Presences et Championnats multiples

### 1. Hero Prochain Match : retirer les cotes, simplifier

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx`

- Supprimer le bloc "Odds preview with labels" (lignes 750-774) qui affiche les 3 boutons de cotes sous la date
- Garder uniquement le bouton "Parier sur ce match" qui ouvre la BetModal
- La BetModal affiche deja les cotes a l'interieur, donc pas de perte de fonctionnalite

### 2. Bilan V/N/D : cercles minimalistes

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx` (lignes 631-651)

- Remplacer les "glass cards" actuelles par de vrais cercles minimalistes :
  - `w-14 h-14 rounded-full` avec fond subtil colore (`bg-emerald-500/10`, `bg-slate-400/10`, `bg-red-500/10`)
  - Chiffre au centre en gras, label dessous
  - Pas de bordure epaisse, juste le fond colore leger dans un cercle

### 3. Remonter le classement parieurs

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx`

- Deplacer `<BetLeaderboard />` (ligne 1007) juste apres le Hero prochain match (apres ligne 817), avant les sections "Prochains matchs" et "Derniers resultats"

### 4. Retirer le bloc "Aucun championnat pour l'equipe X"

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx` (lignes 1053-1063)

- Supprimer ce bloc completement. Le classement live, matchs et resultats se chargent deja dynamiquement via l'API FFF

### 5. Points dans Membres et profil

**Fichier** : `src/components/dashboard/MembersTab.tsx`

- Ajouter une ligne dans chaque carte membre affichant le solde de points de pari (query `user_points` par `user_id`)
- Afficher aussi le dernier gain : "+X gagne sur le match Y" (query `points_transactions` derniere entree de type `bet` avec amount positif)
- Afficher sous forme d'un badge `Coins` avec le solde

### 6. Gain de 5 pts a la presence

**Fichier** : `src/pages/Dashboard.tsx` (fonction `togglePresence`, lignes 443-452)

- Quand un joueur clique "Present" ou "Absent" (et qu'il n'avait pas deja repondu a cet evenement), ajouter 5 points a son solde `user_points`
- Inserer une transaction dans `points_transactions` avec type `presence` et description "Presence repondue : [nom evenement]"
- Eviter le doublon : ne pas redonner 5pts si le joueur change sa reponse (verifier si une presence existait deja)

**Fichier** : `src/components/dashboard/PresencesTab.tsx`

- Ajouter un message informatif sous chaque evenement : "5 pts de pari seront ajoutes a votre solde" (petit texte discret)

### 7. Ajout de championnats par les admins (multi-onglets)

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx`

La fonctionnalite existe deja : le bouton "Nouveau" (ligne 490-498) permet aux admins d'ajouter un championnat avec selection d'equipe (A, B, C). Les onglets equipe en haut servent de selecteur. Actuellement, le bouton n'apparait que si l'equipe selectionnee n'a pas encore de championnat (`!teamHasChampionship(selectedTeam)`).

Le systeme actuel fonctionne deja comme demande :
- Chaque equipe (A, B, C) a son onglet en haut
- Un admin peut ajouter un championnat par equipe
- Chaque onglet affiche son propre classement, prochain match et derniers resultats

Pas de modifications necessaires ici, le systeme est deja en place.

### Resume des fichiers modifies

| Fichier | Modifications |
|---------|--------------|
| `src/components/dashboard/ChampionnatTab.tsx` | Retirer cotes du hero, bilan en cercles, remonter leaderboard, retirer bloc "aucun championnat" |
| `src/components/dashboard/BetModal.tsx` | Aucune modification (les cotes sont deja affichees dans le modal) |
| `src/components/dashboard/MembersTab.tsx` | Ajouter solde de points et dernier gain par membre |
| `src/pages/Dashboard.tsx` | Ajouter logique +5pts dans `togglePresence` |
| `src/components/dashboard/PresencesTab.tsx` | Ajouter message "5 pts de pari seront ajoutes" |

### Details techniques

**Logique des 5 pts (Dashboard.tsx)** :

```text
togglePresence():
  1. Verifier si presences[playerId] existe deja (= deja repondu)
  2. Si non (premiere reponse) :
     - Upsert user_points : balance += 5
     - Insert points_transactions : { amount: +5, type: 'presence', description: '...' }
     - Toast: "+5 pts de pari ajoutes !"
  3. Si oui (changement de reponse) : pas de bonus supplementaire
```

**Affichage points dans MembersTab** :

```text
- Fetch user_points pour tous les membres au mount
- Pour chaque membre, afficher un badge Coins avec le solde
- Fetch la derniere transaction positive de type 'bet' pour afficher "+X sur match Y"
```

