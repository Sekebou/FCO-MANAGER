

## Plan de corrections

### Fichiers modifies

1. **`src/components/modals/AddEventForm.tsx`**
2. **`src/components/dashboard/PresencesTab.tsx`**

### Changements

#### 1. Import FFF : utiliser `getTousMatchsAvenir` au lieu de `getCalendrier`
- Remplacer l'appel `getCalendrier` par `getTousMatchsAvenir(comp.cpNo, comp.phase, comp.poule)` qui retourne deja les matchs groupes par mois, filtres sur Oisemont
- Afficher les matchs groupes par mois avec des headers (ex: "Mars 2026", "Avril 2026")
- Ajouter les logos des equipes (extraits depuis les donnees FFF `home.club.logo` / `away.club.logo`) dans la liste de selection
- Auto-remplir date, heure ET lieu quand on selectionne un match (deja fait mais le lieu doit aussi se propager correctement)

#### 2. Lieux entrainement : ajouter "Autre" et conditionner LocationAutocomplete
- Ajouter un 3e bouton "Autre" a cote de "Stade Oisemont" et "Salle"
- Quand "Stade" selectionne → location = "Stade municipal, Oisemont", masquer LocationAutocomplete
- Quand "Salle" selectionne → location = "Salle des sports, Oisemont", masquer LocationAutocomplete  
- Quand "Autre" selectionne → vider location, afficher LocationAutocomplete
- Par defaut (rien selectionne) → masquer LocationAutocomplete

#### 3. Optimiser les boutons type (Match/Entrainement/Autre) sur petits ecrans
- Reduire le padding, utiliser `text-[10px]` sur `< 380px`, s'assurer que "Entrainement" ne deborde pas via `overflow-hidden` et `truncate`

#### 4. Optimiser boutons Present/Absent sur carte liste (PresencesTab)
- Rendre les boutons plus compacts : icone seule sans texte sur tres petits ecrans, ou utiliser des icones rondes style toggle
- Aligner horizontalement avec le contenu de la carte pour gagner de l'espace vertical

