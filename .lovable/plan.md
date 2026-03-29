

## Correction des équipes incorrectes sur les événements

### Problème identifié

Après vérification croisée de **tous les événements** avec les données officielles FFF (calendrier D2/D4/D6), j'ai trouvé **2 événements avec une équipe incorrecte** :

| Match | Date | Heure | Équipe actuelle | Équipe correcte | Affichage actuel → corrigé |
|-------|------|-------|----------------|----------------|---------------------------|
| NESLOIS AS DU PAYS vs OISEMONT | 26 avr. | 12:30 | B | **A** | "OISEMONT FC 2" → **"OISEMONT FC"** |
| OISEMONT FC vs WOIGNARUE CO | 31 mai | 15:00 | C | **B** | "OISEMONT FC 3" → **"OISEMONT FC 2"** |

Tous les autres événements sont corrects selon les championnats FFF.

### Plan

**Étape unique** : Exécuter 2 UPDATE SQL via l'outil d'insertion pour corriger le champ `team` :
- `a6850ae0` → team = 'A' (NESLOIS est en D2)
- `238e0a1f` → team = 'B' (WOIGNARUE du 31 mai est en D4, pas D6)

Aucune modification de code nécessaire — le problème est uniquement dans les données.

