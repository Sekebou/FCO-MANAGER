

## Plan de correction - 4 points

### 1. Optimiser le "+ Autre" dans le formulaire d'ajout de championnat

Actuellement, les boutons d'equipe (Eq. A, Eq. B, Eq. C, + Autre) utilisent `flex-1 min-w-[60px]` ce qui les rend trop larges et serres quand il y a des equipes custom en plus. 

**Corrections dans `ChampionnatTab.tsx`** :
- Changer le layout du selecteur d'equipe : utiliser `flex-wrap gap-2` avec des boutons a taille `auto` (`px-4`) au lieu de `flex-1`
- Reduire le padding des boutons pour qu'ils tiennent mieux sur petits ecrans
- Afficher "Équipe A" au lieu de "Éq. A" dans le formulaire (ligne 1179)

### 2. Optimiser la suppression de championnat et l'affichage admin

La barre admin (lignes 1094-1136) affiche chaque championnat dans une carte separee. Si plusieurs championnats existent, ils ne sont pas tous visibles car les cartes sont affichees verticalement sans scroll.

**Corrections dans `ChampionnatTab.tsx`** :
- Rendre les cartes admin plus compactes : reduire le padding, utiliser une mise en page horizontale plus dense
- Ajouter une confirmation avant la suppression (actuellement `onDeleteChampionship` est appele directement au clic)
- Changer "Éq." en "Équipe" dans la description des cartes (ligne 1109)

### 3. Actualisation automatique apres ajout de championnat

Le probleme : `addChampionship` dans `Dashboard.tsx` insere le championnat en base mais ne met pas a jour le state local immediatement. La mise a jour depend du realtime subscription, qui peut avoir un delai ou ne pas etre active sur cette table.

**Corrections dans `Dashboard.tsx` (fonction `addChampionship`, lignes 825-843)** :
- Apres l'insert reussi, refetcher immediatement les championnats et les matchs depuis la base : `supabase.from('championships').select('*')` puis `setChampionships(...)` et idem pour `championship_matches`
- Cela garantit une actualisation instantanee sans dependre du realtime

### 4. Ajouter un message "Bienvenue, X" sous le header

Un message de bienvenue moderne et discret sous le header, affichant le prenom de l'utilisateur connecte.

**Corrections dans `Dashboard.tsx` (apres la balise `</header>`, vers ligne 1107)** :
- Ajouter un composant `WelcomeBanner` compact entre le header et le content principal
- Design : fond subtil avec un gradient, icone de salutation, texte "Bienvenue, [Prenom]" avec une animation d'entree en fondu
- Le message s'affiche uniquement lors du premier chargement (pas a chaque changement d'onglet), visible en haut de la page

### Resume des fichiers a modifier

| Fichier | Corrections |
|---------|-------------|
| `src/components/dashboard/ChampionnatTab.tsx` | Layout "+ Autre" optimise, suppression avec confirmation, labels complets |
| `src/pages/Dashboard.tsx` | Refetch apres ajout championnat, ajout "Bienvenue X" |

### Details techniques

**Layout equipes dans formulaire (ChampionnatTab.tsx lignes 1164-1194)** :
- Remplacer `flex-1 min-w-[60px]` par `px-3 sm:px-4` sur les boutons pour un sizing auto
- Garder `flex flex-wrap gap-2` sur le container

**Refetch immediat (Dashboard.tsx lignes 825-843)** :
```text
// Apres l'insert reussi, ajouter :
const { data: updatedChamps } = await supabase.from('championships').select('*');
if (updatedChamps) setChampionships(updatedChamps.map(mapChamp));
const { data: updatedMatches } = await supabase.from('championship_matches').select('*');
if (updatedMatches) setChampMatches(updatedMatches.map(mapMatch));
toast.success('Championnat ajouté !');
```

**Bienvenue banner (Dashboard.tsx apres ligne 1107)** :
```text
<motion.div 
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-10 pt-4 pb-1"
>
  <div className="flex items-center gap-3">
    <span className="text-xl">👋</span>
    <div>
      <h2 className="text-base sm:text-lg font-bold text-foreground">
        Bienvenue, {currentUser?.name?.split(' ')[0]}
      </h2>
      <p className="text-xs text-muted-foreground">FCO Manager — Saison 2025-2026</p>
    </div>
  </div>
</motion.div>
```

**Suppression avec confirmation (ChampionnatTab.tsx ligne 1130)** :
- Envelopper le `onDeleteChampionship` dans un `window.confirm()` ou utiliser le state `deletingTab` existant adapte aux championnats individuels

