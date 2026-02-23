

## Plan de correction - 3 bugs

### Bug 1 : Supprimer / Modifier le nom des onglets championnat

Actuellement, les onglets personnalises sont crees mais ne peuvent etre ni supprimes ni renommes. Il faut ajouter :

**Suppression d'un onglet** : Un bouton "X" visible en mode admin a cote de chaque onglet personnalise (pas A, B, C) dans le selecteur de pilules. La suppression efface aussi le championnat associe dans la base.

**Modification du nom** : Un appui long (ou bouton edit) sur un onglet personnalise ouvre un petit input inline pour renommer. Le `team` est mis a jour dans la table `championships`.

**Affichage du nom complet** : Remplacer `Eq. A` par `Equipe A`, `Eq. B` par `Equipe B`, etc. dans les pilules (ligne 551). Pour les onglets personnalises, afficher le nom complet directement.

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx`
- Ligne 551 : changer `Eq. ${team}` en `Equipe ${team}` pour les base teams
- Ajouter un state `editingTab` et `editTabName` pour le renommage inline
- Ajouter un bouton X pour supprimer les onglets personnalises (avec confirmation)
- Ajouter une prop `onUpdateChampionship` au composant pour mettre a jour le `team` dans la base

**Fichier** : `src/pages/Dashboard.tsx`
- Ajouter la fonction `updateChampionship` qui met a jour le champ `team` dans la table `championships`
- Passer cette fonction en prop a `ChampionnatTab`

### Bug 2 : Pas de classement/matchs pour les equipes personnalisees

Quand on cree un onglet personnalise (ex: U18), les `useEffect` aux lignes 234-316 et 318-362 ne fetching pas les donnees car `teamMapping` ne contient que A, B, C. Pour les equipes custom, les donnees FFF ont ete importees lors de la creation (via `handleImportCompetition`), mais le live classement/matchs ne s'affiche pas car le code les ignore.

**Correction** : Pour les equipes custom, au lieu de hardcoder le mapping `teamMapping`, chercher le `fffUrl` du championnat associe a cette equipe et utiliser ses parametres (`cpNo`, `phase`, `poule`) pour fetcher les donnees live.

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx`
- Lignes 236-250 : au lieu de retourner une erreur quand `mapping` est null, chercher dans `filteredChampionships` le championnat de l'equipe custom et decoder son `fffUrl` pour obtenir les params API
- Lignes 321-333 : meme chose pour les matchs live
- Ajouter un import de `decodeFFFApiRef` (ou parser le `fffUrl` directement) dans `fffApi.ts` si pas deja present

**Fichier** : `src/lib/fffApi.ts`
- Verifier si une fonction `decodeFFFApiRef` existe, sinon la creer pour extraire `cpNo`, `phase`, `poule` depuis l'URL encodee

### Bug 3 : Header - les points prennent trop de place sur mobile

Le badge `HeaderPoints` (ligne 1088) est affiche dans la ligne du role, ce qui compresse le nom/prenom sur petit et grand ecrans.

**Correction** : Deplacer le badge de points en dehors du bloc profil. L'afficher comme une petite icone discrete a cote des boutons d'action (NotificationBell, Lock, LogOut). Sur mobile, afficher uniquement le chiffre avec l'icone, sans le mot "pts".

**Fichier** : `src/pages/Dashboard.tsx`
- Ligne 1088 : retirer `<HeaderPoints>` du bloc role
- Ligne 1092 : inserer `<HeaderPoints>` dans le bloc des boutons d'action (entre le profil et NotificationBell)
- Simplifier le style : icone Coins + chiffre seulement, taille compacte `w-7 h-7`
- Retirer `px-2.5 py-0.5 ml-1` et les labels "pts" pour gagner de la place

### Resume des fichiers a modifier

| Fichier | Corrections |
|---------|-------------|
| `src/components/dashboard/ChampionnatTab.tsx` | Renommage/suppression onglets, nom complet, live data equipes custom |
| `src/pages/Dashboard.tsx` | Header points deplaces, prop updateChampionship |
| `src/lib/fffApi.ts` | Fonction decodeFFFApiRef si necessaire |

### Details techniques

**Affichage onglets (ChampionnatTab.tsx ligne 551)** :
```text
// Avant :
<span>{BASE_TEAMS.includes(team) ? `Éq. ${team}` : team}</span>

// Apres :
<span>{BASE_TEAMS.includes(team) ? `Équipe ${team}` : team}</span>
```

**Renommage inline** :
```text
// Double-tap ou bouton edit sur un onglet custom
const [editingTab, setEditingTab] = useState<string | null>(null);
const [editTabName, setEditTabName] = useState('');

// Dans le pill, si editingTab === team :
<input value={editTabName} onChange={...} onBlur={saveTabName} className="..." />
// Sinon afficher le nom normalement
```

**Suppression onglet** :
```text
// Bouton X a cote du nom dans le pill (seulement pour custom teams et admins)
// onClick -> confirm modal -> onDeleteChampionship(champId)
```

**Live data equipes custom (lignes 236-250)** :
```text
const mapping = teamMapping[selectedTeam];
if (!mapping) {
  // Chercher le championnat custom et son fffUrl
  const customChamp = filteredChampionships[0];
  if (customChamp?.fffUrl) {
    const params = decodeFFFApiRef(customChamp.fffUrl);
    // Utiliser params.cpNo, params.phase, params.poule pour fetcher
  } else {
    setLiveError('Pas de classement FFF');
  }
}
```

**Header points (Dashboard.tsx)** :
```text
// Deplacer HeaderPoints hors du bloc profil
// Le mettre comme un petit badge compact dans la zone des boutons
<div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
  <HeaderPoints userId={currentUser?.uid} />  // ICI, compact
  <NotificationBell />
  <button ...Lock... />
  <button ...LogOut... />
</div>
```

**HeaderPoints simplifie** :
```text
<span className="inline-flex items-center gap-0.5 bg-amber-500/15 rounded-lg px-1.5 py-1">
  <Coins size={12} className="text-amber-400" />
  <span className="text-[10px] font-bold text-amber-400">{pts}</span>
</span>
```

