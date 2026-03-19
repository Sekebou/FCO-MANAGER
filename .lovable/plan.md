

## Plan de corrections

### Problèmes identifiés

1. **Logos non persistés** : La table `events` n'a pas de colonnes `home_logo`/`away_logo`. Les logos sont dans le state local mais jamais insérés en DB, donc perdus au rechargement.
2. **Heure non auto-remplie** dans le sélecteur natif (le `time` est mis dans `formData.time` mais le `NativeTimePicker` l'affiche bien — à vérifier si c'est un problème d'affichage).
3. **Après sélection d'un match FFF**, tout reste visible (équipe, compétition, liste) — il faut cacher la section FFF et montrer la date/heure.
4. **LocationAutocomplete toujours visible** pour les matchs — il faut le cacher par défaut et ne le montrer que si le stade n'est pas trouvé via FFF ou via un bouton admin+.
5. **Icône "en attente"** manquante à côté des compteurs ✓ et ✗ sur les cartes liste.
6. **Texte "Appuie pour voir les détails"** à améliorer + ajouter un petit espace.
7. **Animations** manquantes sur les boutons Présent/Absent de la carte liste.

### Modifications

#### 1. Migration DB : ajouter `home_logo` et `away_logo` à `events`
```sql
ALTER TABLE public.events ADD COLUMN home_logo text;
ALTER TABLE public.events ADD COLUMN away_logo text;
```

#### 2. `src/pages/Dashboard.tsx`
- Dans `addEvent` (ligne 706-713) : inclure `home_logo: eventData.homeLogo`, `away_logo: eventData.awayLogo` dans l'insert
- Dans le fetch des events : mapper `home_logo`/`away_logo` vers `homeLogo`/`awayLogo` dans le type Event

#### 3. `src/components/modals/AddEventForm.tsx`
- **`handleFFFMatchSelect`** : après sélection, mettre un state `fffMatchSelected = true` qui masque toute la section FFF (équipes, compétitions, matchs) pour montrer uniquement titre/date/heure/lieu pré-remplis
- Ajouter un bouton "Modifier le match" pour ré-ouvrir la sélection FFF si besoin
- **LocationAutocomplete pour match** : masquer par défaut. Afficher uniquement si `!formData.location` (stade non trouvé via FFF) OU si admin+ clique sur un bouton "Modifier le stade"
- S'assurer que `formData.time` est bien rempli (déjà fait dans `handleFFFMatchSelect` ligne 119)

#### 4. `src/components/dashboard/PresencesTab.tsx`
- **Compteur "en attente"** : ajouter une icône Clock avec le count des joueurs n'ayant pas répondu à côté des ✓ et ✗ sur les cartes liste
- **Texte hint** : changer en "Appuyez pour voir plus de détails sur l'événement" avec un `mt-1` pour l'espacement
- **Animations Présent/Absent** : ajouter `motion.button` avec `whileTap={{ scale: 0.9 }}` et `AnimatePresence` pour les boutons de la carte liste (comme dans la vue détail)

### Fichiers modifiés
1. Migration SQL (nouvelle)
2. `src/pages/Dashboard.tsx`
3. `src/components/modals/AddEventForm.tsx`
4. `src/components/dashboard/PresencesTab.tsx`

