

## Correction des 3 bugs du classement et matchs

### Bug 1 : Double classement identique (haut + bas)

Le classement "live" (API FFF) s'affiche en haut de la page (lignes 402-478). Quand on deplie un championnat stocke en base, un deuxieme classement identique s'affiche dans la section expandable (lignes 644-684). 

**Solution** : Supprimer le classement dans la section expandable du championnat (`getStandings` + son affichage lignes 644-684). Le classement live en haut suffit et est toujours a jour depuis l'API FFF.

### Bug 2 : Optimiser la lisibilite

**Solution** : 
- Garder uniquement le classement live en haut (deja bien formate avec surlignage Oisemont)
- Dans la section expandable du championnat, ne garder que les matchs par journee (supprimer le bloc classement redondant)
- Cela allege la vue et evite la confusion

### Bug 3 : Prochains matchs / Derniers resultats ne filtre pas par equipe selectionnee

Actuellement, ces sections filtrent par `filteredChampIds` (championnats stockes en base). Probleme : si on selectionne Eq. C (Seniors D6), les matchs affiches viennent du championnat stocke en base, pas forcement de la bonne equipe.

**Solution** : Les matchs affiches dans "Prochains matchs" et "Derniers resultats" doivent etre filtres par le `championshipId` correspondant a l'equipe selectionnee. Si un championnat est stocke en base pour cette equipe, utiliser ses matchs. Les matchs affiches proviennent deja de `filteredChampionships` via `filteredChampIds`, donc le filtre `(c.team || 'A') === selectedTeam` devrait fonctionner. Il faut verifier que le champ `team` est bien renseigne lors de la creation du championnat.

### Fichiers modifies

| Fichier | Modification |
|---|---|
| `src/components/dashboard/ChampionnatTab.tsx` | Supprimer le bloc classement dans la section expandable (lignes 644-684), ne garder que le classement live en haut |

