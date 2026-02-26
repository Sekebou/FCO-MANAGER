

## Plan de corrections et améliorations

### Problemes identifies et solutions

---

### 1. Blocage du scroll arriere-plan quand un modal est ouvert

**Probleme** : Quand un modal (AddEventForm, ConfirmModal, etc.) est ouvert avec le fond flou, on peut encore scroller le contenu derriere.

**Solution** : Ajouter un `useEffect` dans chaque composant modal (ou un hook partage) qui applique `document.body.style.overflow = 'hidden'` a l'ouverture et le restaure a la fermeture. Les modaux concernes :
- `ConfirmModal.tsx`
- `AddEventForm.tsx`
- `AddPlayerForm.tsx`
- `AddNewsForm.tsx`
- `AddCardForm.tsx`
- `ChangePasswordForm.tsx`
- `AdminResetPasswordForm.tsx`
- `AvatarModal.tsx`
- `InvitePlayerForm.tsx`

Approche : creer un hook `useBodyScrollLock()` appele dans chaque modal, ou ajouter directement le `useEffect` dans chaque fichier.

---

### 2. Retirer la gestion des convocations pour les entrainements

**Probleme** : La section convocations est actuellement affichee uniquement pour `event.type === 'match'` (ligne 324 de PresencesTab), donc c'est deja le cas. Cependant, il faut aussi verifier qu'aucun bouton convocation n'apparait pour les entrainements dans la vue detail.

**Verification** : Le code a la ligne 324 filtre deja `event.type === 'match'`. Aucun changement necessaire ici, c'est deja correct.

---

### 3. Optimiser la suppression (rendu instantane)

**Probleme** : Quand on supprime un evenement, il y a un delai de 1-2 secondes car la suppression attend la reponse du serveur avant de mettre a jour l'UI.

**Solution** : Appliquer un "optimistic delete" dans `deleteEvent` (Dashboard.tsx) : retirer l'evenement du state local immediatement dans le `onConfirm` du ConfirmModal AVANT l'appel Supabase, puis restaurer en cas d'erreur. Meme approche pour les autres suppressions si necessaire.

---

### 4. Deplacer le bouton delete sur la carte compacte (liste)

**Probleme** : Le bouton supprimer est actuellement dans la vue detail de l'evenement (ligne 145-148 de PresencesTab). L'utilisateur souhaite le voir directement sur les cartes dans la vue liste.

**Solution** : 
- Retirer le bouton Trash2 de la vue detail (lignes 144-148)
- Ajouter un bouton Trash2 sur chaque carte dans la vue liste (apres ligne 601), visible uniquement si `canDeleteEvent(event)` est vrai
- Utiliser `e.stopPropagation()` pour eviter d'ouvrir la carte en cliquant sur supprimer

---

### 5. Creation assistee de matchs via API FFF

**Probleme** : Quand on cree un match, on veut pouvoir choisir l'equipe (recuperable via API FFF), puis selectionner un match de la liste pour pre-remplir automatiquement adversaire, lieu (domicile/exterieur) et titre (X vs Y), avec possibilite de remplir manuellement.

**Solution** dans `AddEventForm.tsx` :
- Quand `type === 'match'`, ajouter un toggle/section "Importer depuis FFF" (optionnel)
- Appeler `getEquipes(OISEMONT_CL_NO)` pour lister les equipes du club
- Selector d'equipe (A, B, C...)
- Une fois l'equipe choisie, appeler `getAllCompetitions()` + `getCalendrier()` pour lister les prochains matchs
- Selector de match pre-remplissant : titre (Home vs Away), lieu (domicile/exterieur deduisant si `home.club.cl_no === OISEMONT_CL_NO`), date et heure
- Garder la possibilite d'ignorer l'import et remplir manuellement

---

### 6. Vue detail enrichie pour les entrainements

**Probleme** : Quand on ouvre un entrainement, on veut voir une presentation structuree avec : date en toutes lettres, heure, duree de la seance, et lieu.

**Solution** dans `PresencesTab.tsx` vue detail :
- Quand `event.type === 'training'`, afficher un bloc structure avec :
  - Date formatee : "mercredi 25 fevrier 2026"
  - Heure : "19:00"
  - Duree : "90 minutes — Duree de la seance"
  - Lieu : "Terrain synthetique" avec icone MapPin
- Ajouter un champ `duration` au formulaire AddEventForm (visible pour entrainement)

**Migration DB** : Ajouter la colonne `duration` (integer, nullable) a la table `events`.

---

### 7. Optimisation des conversations/messages (plus natif)

**Probleme** : Les conversations pourraient etre plus fluides et natives.

**Ameliorations dans MessagesTab.tsx** :
- Ajouter `document.body.style.overflow = 'hidden'` quand une conversation est ouverte (pour empecher le scroll de la page derriere)
- Ameliorer les transitions entre vues (liste → conversation → creation) avec des animations plus douces
- S'assurer que le delete de conversation dans la liste utilise un swipe ou une confirmation plus native

---

### Ordre d'implementation

1. Hook `useBodyScrollLock` + application a tous les modaux
2. Optimistic delete pour les evenements
3. Bouton delete sur carte compacte + retrait de la vue detail
4. Migration DB : colonne `duration` sur events
5. Vue detail enrichie entrainement (date, heure, duree, lieu)
6. Formulaire creation match assiste FFF (equipe, selection match, pre-remplissage)
7. Amelioration messagerie (scroll lock, animations)

### Fichiers modifies

- `src/hooks/useBodyScrollLock.ts` (nouveau)
- `src/components/modals/ConfirmModal.tsx`
- `src/components/modals/AddEventForm.tsx` (scroll lock + FFF integration)
- `src/components/modals/AddPlayerForm.tsx` (scroll lock)
- `src/components/modals/AddNewsForm.tsx` (scroll lock)
- `src/components/modals/AddCardForm.tsx` (scroll lock)
- `src/components/modals/ChangePasswordForm.tsx` (scroll lock)
- `src/components/modals/AdminResetPasswordForm.tsx` (scroll lock)
- `src/components/modals/AvatarModal.tsx` (scroll lock)
- `src/components/modals/InvitePlayerForm.tsx` (scroll lock)
- `src/components/dashboard/PresencesTab.tsx` (delete sur carte, vue detail entrainement, retrait convocations detail)
- `src/pages/Dashboard.tsx` (optimistic delete, interface Event + duration)
- `src/components/dashboard/MessagesTab.tsx` (scroll lock, animations)
- Migration SQL : `ALTER TABLE events ADD COLUMN duration integer DEFAULT NULL`

