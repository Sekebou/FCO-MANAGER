

# Plan de correction — 8 points

## 1. Bug FCM tokens (notifications push)

**Problème identifié** : Le hook `usePushNotifications` tente de `delete` les tokens d'autres utilisateurs avant l'upsert, mais la politique RLS `(auth.uid())::text = user_id` bloque cette suppression silencieusement. De plus, l'upsert avec `onConflict: 'token'` échoue probablement car il n'y a pas de contrainte UNIQUE sur la colonne `token` en base.

**Corrections** :
- Migration : ajouter une contrainte UNIQUE sur `fcm_tokens.token` si elle n'existe pas
- Ajouter une politique RLS permettant la suppression par token (ou utiliser une fonction `SECURITY DEFINER` pour gérer l'upsert côté serveur)
- Simplifier le hook : supprimer le `delete` préalable et garder uniquement l'`upsert` avec `onConflict: 'token'`, en s'assurant que le `user_id` correspond bien à `auth.uid()::text`

## 2. Suppression automatique des événements passés (48h)

**Approche** : Créer une edge function `cleanup-old-events` déclenchée par un cron job quotidien.

- Sélectionne les événements dont `date < now() - 48h` et type `match` ou `training`
- Archive les présences dans `attendance_records` avant suppression
- Supprime les événements de la table `events`
- Cron : exécution 1x/jour via `pg_cron`

## 3. Amélioration section statistiques

**Problème** : Les formats `3/3` et `1/1` dans le podium et la liste des présences ne sont pas explicites.

**Corrections dans `StatsTab.tsx`** :
- Podium (ligne ~301) : remplacer `{present}/{total}` par `Présent à {present} entraînements sur {total}` (version courte pour le podium : `{present} sur {total}`)
- Liste ranking (ligne ~329) : idem, remplacer `{present}/{total}` par `{present} sur {total}`
- Section "Tops joueurs" : ajouter des labels plus explicites

## 4. Bug classement (BetLeaderboard)

**Problème** : Le classement des parieurs trie par `total_bet` (montant total misé) au lieu d'un critère pertinent comme le `balance` ou `total_won`.

**Correction dans `BetLeaderboard.tsx`** :
- Trier par `balance` décroissant (celui qui a le plus de points est premier)
- Ou trier par `total_won` si l'intention est de classer par gains

## 5. Navigation accueil → événement dans Présences

**Problème** : Quand on clique sur le prochain match/entraînement depuis `HomeTab`, ça navigue vers l'onglet `presences` mais n'ouvre pas l'événement concerné.

**Corrections** :
- Modifier `HomeTab` : passer l'id de l'événement dans le callback `onNavigate`, ex: `onNavigate('presences', nextMatch.id)`
- Modifier `Dashboard` : gérer un paramètre `initialEventId` dans `handleTabChange`
- Modifier `PresencesTab` : accepter un prop `initialSelectedEventId` et l'utiliser pour pré-sélectionner l'événement à l'ouverture

## 6. Bug points (mise à jour en temps réel)

**Problème** : Les points dans `HeaderPoints` sont chargés une seule fois au montage et ne se rafraîchissent jamais. Idem dans `MembersTab` et `BetLeaderboard`.

**Corrections** :
- `HeaderPoints` : ajouter un abonnement Realtime sur `user_points` pour rafraîchir automatiquement
- Ou rafraîchir les points après chaque action (pari, présence, like, commentaire) via un callback partagé
- S'assurer que `user_points` est dans la publication Realtime

## 7. Nettoyage BDD points + suppression Daily Bonus

**Problème** : Le daily bonus génère 1 transaction/jour/utilisateur, ce qui multiplie les rows inutilement. De plus, il y a des doublons dans `user_points`.

**Corrections** :
- Supprimer la logique `awardDailyBonus` dans `Dashboard.tsx` (retirer le bonus quotidien)
- Nettoyage via requête SQL (outil insert) :
  - Supprimer toutes les transactions de type `daily`
  - Dédupliquer `user_points` : garder 1 seule row par `user_id` avec le solde le plus récent
- Ajouter une contrainte UNIQUE sur `user_points.user_id` pour éviter les futurs doublons

## 8. Optimisation API Championnat

**Problème** : Le cache de 24h fonctionne déjà en principe (implémenté précédemment), mais il y a un risque que le cache ne soit pas sauvegardé si `teamChamp` est `undefined` (ligne 376 du ChampionnatTab : `if (... && teamChamp)`). Si un utilisateur ouvre l'app et qu'il n'y a pas encore de championship dans la BDD pour cette équipe, le cache n'est jamais sauvegardé.

**Corrections** :
- Vérifier que le cache est bien sauvegardé même quand le championship est récent
- S'assurer que le cron `auto-refresh-championships` fonctionne correctement pour pré-remplir le cache
- Ajouter un log/debug pour confirmer que l'API n'est appelée qu'une fois par jour

---

## Résumé des fichiers à modifier

| Fichier | Changements |
|---|---|
| `src/hooks/usePushNotifications.ts` | Fix upsert FCM, retirer delete |
| `src/pages/Dashboard.tsx` | Supprimer daily bonus, gérer navigation avec eventId |
| `src/components/dashboard/HomeTab.tsx` | Passer eventId dans onNavigate |
| `src/components/dashboard/PresencesTab.tsx` | Accepter initialSelectedEventId |
| `src/components/dashboard/StatsTab.tsx` | Textes explicites pour présences |
| `src/components/dashboard/BetLeaderboard.tsx` | Fix tri classement par balance |
| `src/components/dashboard/ChampionnatTab.tsx` | Vérifier sauvegarde cache |
| Migration SQL | UNIQUE sur fcm_tokens.token, UNIQUE sur user_points.user_id |
| SQL nettoyage (insert) | Purge daily transactions, dédoublonnage user_points, purge invitations used |
| Edge function + cron | cleanup-old-events |

