

## Plan de corrections multiples

### 1. Display role pour Thomas (admin affiché comme Entraîneur)

**Probleme** : Quand un admin a un `displayRole` (ex: "entraineur"), l'app montre quand même "Administrateur" à plusieurs endroits :
- `created_by_name` dans les événements/actus = stocke le nom, pas le rôle (OK)
- `RoleBadge` dans PresencesTab (ligne 200) utilise `creator.role` et `creator.displayRole` → déjà correct via RoleBadge
- `MembersTab` ligne 90 : les admins sont groupés par `m.role === 'admin'` même s'ils ont un displayRole → il faut regrouper par `displayRole || role`
- `MembersTab` `roleConfig` et `getRoleLabel` : quand displayRole est défini, le label est correct via `getRoleLabel(role, displayRole)` mais le groupement ne suit pas le displayRole
- `AvatarModal` ligne 162 : affiche `currentUser.role` sans tenir compte du displayRole

**Fichiers** :
- `src/components/dashboard/MembersTab.tsx` : regrouper les membres par `displayRole || role` au lieu de `role`
- `src/components/modals/AvatarModal.tsx` : utiliser `currentUser.displayRole || currentUser.role` pour l'affichage

### 2. Double notification à la création d'album

**Probleme** : `toast.success` appelé dans `GalleryTab.tsx` ligne 59 ET dans `Dashboard.tsx` ligne 1037.

**Fix** : Retirer le `toast.success` de `Dashboard.tsx` ligne 1037 (laisser celui de GalleryTab).

### 3. FFF Import : filtrer uniquement les matchs non joués d'Oisemont

**Probleme** : Dans `AddEventForm.tsx` lignes 70-89, tous les matchs sont affichés (joués + non joués, toutes équipes).

**Fix** :
- Filtrer les matchs : exclure ceux déjà joués (`m.played !== true` ou pas de score)
- Filtrer par Oisemont : ne montrer que les matchs où `home.club.cl_no === OISEMONT_CL_NO || away.club.cl_no === OISEMONT_CL_NO`
- Auto-remplir le stade depuis les données FFF `terrain` quand disponible

### 4. Affichage match sur carte liste : X VS X avec VS en avant

**Probleme** : Le titre du match s'affiche comme texte simple. L'utilisateur veut "X VS X" avec VS mis en avant, et l'heure plus visible.

**Fix dans PresencesTab** liste (lignes 600-632) :
- Pour les events de type match, parser le titre "X vs Y" et afficher avec VS en gros/bold
- Mettre l'heure en avant (plus grande/bold)
- Ajouter le stade visible

### 5. Lieux prédéfinis pour entraînements

**Probleme** : Pour la création d'entraînements, proposer des lieux prédéfinis au lieu de recherche.

**Fix dans AddEventForm** : Quand `type === 'training'`, afficher des boutons rapides de lieux prédéfinis ("Stade Oisemont", "Salle intérieure") avant le champ de recherche.

### 6. Boutons Présent/Absent sur carte liste (style TeamPulse)

**Probleme** : Actuellement il faut ouvrir le détail pour répondre. L'utilisateur veut pouvoir répondre directement depuis la liste.

**Fix dans PresencesTab** liste : Ajouter des boutons Présent/Absent compacts sur chaque carte pour le joueur connecté uniquement. Le détail reste pour voir tous les joueurs.

### 7. Scroll lock manquant sur BetModal et modal "Nouveau championnat"

**Probleme** : On peut scroller derrière le modal de paris et le modal de création de championnat.

**Fix** :
- `BetModal.tsx` : ajouter `useBodyScrollLock()` (conditionnel sur `isOpen`)
- `ChampionnatTab.tsx` : ajouter le scroll lock dans les modals `showAddChamp` et `showAddMatch`

### 8. Championnat : équipes A/B/C non supprimables, admin+ seul pour modifier/supprimer

**Probleme** : Les équipes par défaut (A, B, C) ne devraient pas être supprimables/modifiables par un admin normal. Seul admin+ peut tout modifier/supprimer.

**Fix dans ChampionnatTab** :
- Bouton delete sur A/B/C : masquer sauf pour admin+
- `canManage()` pour l'ajout reste mais delete/rename restreint à `currentUserRole === 'admin+'`
- Le bouton "Nouveau" doit être grisé pour les équipes A/B/C si elles ont déjà un championnat (déjà fait via `teamHasChampionship`)

### 9. Toast de suppression championnat avant confirmation

**Probleme** : Dans `ChampionnatTab` ligne 591, le `toast.success` est dans le callback du bouton "Supprimer" du delete tab, mais `onDeleteChampionship` dans Dashboard appelle `setConfirmModal` qui demande confirmation. Le toast arrive avant la confirmation car c'est le tab qui est supprimé directement, pas via `deleteChampionship`.

**Fix** : Déplacer le `toast.success` dans le callback `onConfirm` du ConfirmModal, ou supprimer le toast direct de ChampionnatTab et laisser le flow passer par Dashboard confirmModal.

### Fichiers modifiés

1. `src/components/dashboard/MembersTab.tsx` — regroupement par displayRole
2. `src/components/modals/AvatarModal.tsx` — affichage displayRole
3. `src/pages/Dashboard.tsx` — retirer toast doublon album
4. `src/components/modals/AddEventForm.tsx` — filtre FFF, lieux prédéfinis training
5. `src/components/dashboard/PresencesTab.tsx` — boutons présent/absent sur carte, affichage VS match
6. `src/components/dashboard/BetModal.tsx` — scroll lock
7. `src/components/dashboard/ChampionnatTab.tsx` — scroll lock modals, restrictions admin+, fix toast suppression

