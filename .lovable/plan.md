

# Synchronisation quasi-instantanee des actions sur iOS

## Probleme actuel

Sur iOS, toutes les donnees sont recuperees via un polling REST toutes les **5 secondes** qui telecharge l'integralite des collections (joueurs, evenements, news, presences, etc.). Quand un utilisateur clique sur "Present" depuis le web, il faut attendre jusqu'a 5s pour que ca apparaisse sur l'app iOS.

## Solution proposee

Separer les donnees en deux categories avec des frequences de polling differentes :

- **Donnees "chaudes"** (changent souvent, doivent etre rapides) : presences, likes/commentaires news, stats joueurs -- polling toutes les **2 secondes**
- **Donnees "froides"** (changent rarement) : evenements, championnats, albums, membres, cartes -- polling toutes les **8 secondes**

Cela divise la charge reseau tout en rendant les mises a jour de presences et interactions quasi-instantanees (2s max au lieu de 5s).

## Details techniques

### Fichier modifie : `src/pages/Dashboard.tsx`

Dans le bloc iOS REST polling (lignes ~304-356), remplacer le `fetchAll` unique par deux fonctions :

1. **`fetchHot()`** -- appele toutes les 2s :
   - `attendance_records`
   - `news` (pour les likes)
   - `news_comments`
   - `players` (pour les stats)

2. **`fetchCold()`** -- appele toutes les 8s :
   - `events`
   - `users` (membres)
   - `cards`
   - `championships`
   - `championship_matches`
   - `albums`
   - `gallery_photos`

3. Au demarrage, les deux sont appeles immediatement pour le chargement initial.

4. La fonction `refetchNow()` (apres actions locales) continue de tout rafraichir instantanement.

### Mise a jour du footer

Changer le texte "Rafraichissement auto toutes les 10s" en "Synchro auto" pour ne pas afficher un chiffre qui ne correspond plus a une seule frequence.

