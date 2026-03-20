

# Plan de corrections multiples

## 1. Bug remplaçants : "10 titulaires" au lieu de 11
**Cause** : Le filtre `allConvokedPlayers` (ligne 304 de PitchView.tsx) exclut les joueurs convoqués qui n'ont ni position ni numéro ≥ 12. Le joueur N°11 sans position assignée est invisible.

**Correction** : Inclure TOUS les joueurs avec `status === 'convoque'`, puis séparer titulaires (numéro ≤ 11 ou sans numéro) / remplaçants (numéro ≥ 12).

**Fichier** : `src/components/dashboard/PitchView.tsx` — ligne 304

## 2. Style du banc remplaçants
- Fond noir/gris → **fond blanc** avec bordure subtile pour lisibilité
- Agrandir les maillots remplaçants (28×32 → 32×36)
- Label et noms en couleur sombre au lieu de blanc/gris sur fond sombre
- Garder la partie terrain intacte (pelouse, lignes, drapeaux)

**Fichier** : `src/components/dashboard/PitchView.tsx` — zone bench (lignes 439-678)

## 3. Invitation bloquée pour admin/entraîneur
**Cause** : `MembersTab.tsx` ligne 128 vérifie `currentUser?.role === 'admin+'` — seul admin+ voit le bouton actif.

**Correction** : Tout utilisateur pour qui `canManage()` est vrai peut inviter (admin+, admin, entraîneur).

**Fichier** : `src/components/dashboard/MembersTab.tsx` — lignes 127-143

## 4. Création de comptes bloquée avant version publique
Le bouton "Inviter" pour les non-admin+ affiche un message d'erreur au lieu d'ouvrir le formulaire. Correction : supprimer cette restriction, tous les managers peuvent inviter.

**Fichier** : même section de `MembersTab.tsx`

## 5. Bug codes collectifs — deuxième utilisation impossible
**Cause double** :
- `Auth.tsx` ligne 200 : vérifie `inv.status === 'used'` → bloque dès la 1ère utilisation car `register_user` met le statut à `'used'`
- `register_user` RPC : met `status = 'used'` sans vérifier `max_uses`

**Corrections** :
- **Auth.tsx** : Pour les codes collectifs (max_uses > 1), ne vérifier que `use_count >= max_uses`, pas le status
- **Migration SQL** : Modifier `register_user` pour ne mettre `status = 'used'` que quand `use_count + 1 >= max_uses`, et toujours incrémenter `use_count`

## 6. Durée d'expiration 24h pour tous les codes/liens
**Cause** : Les liens email et unique expirent en 48h, les collectifs en 7j.

**Correction** : Tous les modes → 24h. Afficher "24h" dans les textes d'info.

**Fichier** : `src/pages/Dashboard.tsx` (ligne 1714) + `src/components/modals/InvitePlayerForm.tsx` (textes info)

## Fichiers modifiés
1. `src/components/dashboard/PitchView.tsx` — filtre starters/subs + style banc blanc
2. `src/components/dashboard/MembersTab.tsx` — déblocage invitation
3. `src/pages/Auth.tsx` — validation codes collectifs
4. `src/pages/Dashboard.tsx` — expiration 24h
5. `src/components/modals/InvitePlayerForm.tsx` — textes 24h
6. **Migration SQL** — modifier `register_user` pour gérer correctement les codes collectifs

