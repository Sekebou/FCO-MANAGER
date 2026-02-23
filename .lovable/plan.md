

## Plan de correction - 6 bugs

### Bug 1 : Zoom automatique sur les champs de saisie (iOS/Android)

Le viewport meta est deja configure avec `maximum-scale=1.0, user-scalable=no` et le CSS force `font-size: 16px !important` sur les inputs. Cependant, certains navigateurs mobiles (Safari iOS 16+) ignorent `maximum-scale` dans certains cas.

**Correction** :
- Ajouter dans `index.css` une regle CSS supplementaire pour empecher le zoom sur focus avec `@supports` et un meta viewport renforce
- Ajouter `touch-action: manipulation` sur tous les elements interactifs (boutons, liens)
- Forcer `transform: scale(1)` sur les inputs au focus pour contrer le zoom Safari

**Fichier** : `src/index.css`

### Bug 2 : Header qui deborde sur grands ecrans mobiles (iPhone 16 Pro Max, S24 Ultra)

Sur la capture, on voit que les icones (cadenas, deconnexion) sont poussees a droite hors ecran. Le probleme vient du fait que le header n'a pas de `overflow-hidden` et que le contenu (nom + role + badge points + icones) depasse la largeur.

**Correction** :
- Ajouter `overflow-hidden` sur le header container
- Ajouter `min-w-0` et `shrink` sur le bloc profil pour qu'il se compresse
- Limiter la largeur du badge HeaderPoints avec `max-w-fit shrink-0`
- S'assurer que le bloc right-side a `shrink-0` sur les icones et `min-w-0` sur le texte

**Fichier** : `src/pages/Dashboard.tsx` (lignes 1054-1099)

### Bug 3 : Griser/fermer les presences pour les evenements passes

Actuellement, `PresencesTab.tsx` filtre les evenements ou `date >= new Date()` (ligne 50), donc les evenements passes ne s'affichent pas du tout. Mais le filtre compare la date sans heure, donc un evenement du jour passe peut rester visible.

**Correction** :
- Ajouter une condition `isPastEvent` basee sur la date de l'evenement
- Si l'evenement est passe, afficher les boutons present/absent en mode desactive (grises) avec un label "Evenement passe"
- Garder l'affichage des reponses deja enregistrees mais empecher de nouvelles modifications

**Fichier** : `src/components/dashboard/PresencesTab.tsx`

### Bug 4 : Erreur lors de la creation de conversation privee

La RLS policy INSERT a `with_check: (auth.uid() = ANY (participants))`. Le code met `currentUser.uid` dans `allParticipants`. Le probleme peut venir de :
1. L'utilisateur n'est pas authentifie via Supabase Auth (utilise localStorage uniquement)
2. Le type `participants` est un array de `uuid` mais on envoie des strings

**Correction** :
- Verifier que la session Supabase est active avant de creer la conversation
- Ajouter un `await supabase.auth.getUser()` pour confirmer l'authentification
- Si pas de session, afficher un message d'erreur plus clair
- Logger l'erreur exacte pour diagnostic

**Fichier** : `src/components/dashboard/MessagesTab.tsx` (lignes 196-237)

### Bug 5 : Onglets dynamiques dans Championnat (au-dela de A, B, C)

Actuellement `TEAM_OPTIONS` est `['A', 'B', 'C']` en dur (ligne 93). L'utilisateur veut pouvoir creer des onglets supplementaires (ex: U18, Veterans).

**Correction** :
- Rendre `TEAM_OPTIONS` dynamique : combiner les valeurs par defaut `['A', 'B', 'C']` avec les valeurs `team` uniques presentes dans les championnats existants
- Dans le formulaire d'ajout, ajouter un champ "Nouvelle equipe" qui permet de saisir un nom d'equipe personnalise (ex: "U18")
- Quand l'utilisateur choisit "Nouveau", afficher un input texte pour le nom de l'onglet
- Le nouvel onglet apparait automatiquement dans le selecteur de pilules
- Pour les equipes personnalisees, ne pas faire de mapping vers l'API FFF (pas de `teamMapping`) : elles utiliseront uniquement les donnees importees manuellement ou via URL FFF

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx` (lignes 93, 316-320, 402-420, 518-546)

### Bug 6 : Visibilite du zoom CSS renforcee

Ajout de regles supplementaires dans le CSS pour bloquer tout zoom residuel sur iOS.

**Fichier** : `src/index.css`

---

### Resume des fichiers a modifier

| Fichier | Corrections |
|---------|-------------|
| `src/index.css` | Anti-zoom renforce |
| `src/pages/Dashboard.tsx` | Header overflow, layout large screens |
| `src/components/dashboard/PresencesTab.tsx` | Griser evenements passes |
| `src/components/dashboard/MessagesTab.tsx` | Fix creation conversation |
| `src/components/dashboard/ChampionnatTab.tsx` | Onglets dynamiques |

### Details techniques

**Header fix (Dashboard.tsx)** :
```text
// Le container header doit etre overflow-hidden
<div className="flex justify-between items-center h-16 lg:h-20 overflow-hidden">
  // Le bloc gauche doit shrink
  <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
  // Le bloc droit doit aussi ne pas deborder
  <div className="flex items-center gap-1 shrink-0">
  // Le profil doit avoir min-w-0
  <div className="hidden min-[414px]:block text-left min-w-0 max-w-[140px]">
```

**Onglets dynamiques (ChampionnatTab.tsx)** :
```text
// Remplacer const TEAM_OPTIONS = ['A', 'B', 'C'] par :
const baseTeams = ['A', 'B', 'C'];
const customTeams = [...new Set(championships.map(c => c.team || 'A').filter(t => !baseTeams.includes(t)))];
const allTeamOptions = [...baseTeams, ...customTeams];

// Dans le formulaire, ajouter un input pour "Nouvelle equipe" :
// Si champTeam === '__new__', afficher un input texte
// Le teamMapping dans useEffect ne fait rien pour les equipes non-ABC
```

**Presences passees (PresencesTab.tsx)** :
```text
// Changer le filtre pour inclure les evenements passes recents (7 jours)
const now = new Date();
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const allRelevantEvents = events
  .filter(e => new Date(e.date) >= sevenDaysAgo)
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

// Pour chaque event, ajouter isPast
const isPastEvent = new Date(event.date) < now;
// Si isPast, griser les boutons et afficher "Evenement termine"
```

**Conversation fix (MessagesTab.tsx)** :
```text
// Avant l'insert, verifier la session
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  toast.error('Session expirée, veuillez vous reconnecter');
  return;
}
// Utiliser session.user.id au lieu de currentUser.uid
const allParticipants = [session.user.id, ...selectedMembers];
```
