
## Remplacer la bulle flottante par un onglet "Discussions" dans la navbar

### Situation actuelle

- La `ChatBubble` est un composant flottant (`fixed`) rendu dans `Dashboard.tsx` (ligne 1073), superposé au contenu
- La `BottomTabBar` a 7 onglets (stats, classement, actus, présences, calendrier, galerie, membres)
- Le composant `ChatTab.tsx` existe déjà et contient toute la logique de messagerie — il est déjà utilisé **à l'intérieur** de `ChatBubble.tsx`

### Solution

Supprimer la bulle flottante et ajouter un 8ème onglet **"Discussions"** dans la navbar, qui affiche directement le `ChatTab` dans l'espace de contenu principal, comme les autres onglets.

### Changements à effectuer

**1. `BottomTabBar.tsx` — Ajouter l'onglet Discussions**

Ajouter `{ id: 'chat', label: 'Discussions', icon: MessageCircle }` dans le tableau `allTabs` (avec import de `MessageCircle` depuis lucide-react). Placement : après "Galerie" et avant "Membres", ou en dernier — à décider selon la logique de priorité (on le met en dernier pour ne pas perturber l'ordre existant).

**2. `Dashboard.tsx` — 3 modifications**

- **Supprimer** l'import et le rendu de `<ChatBubble>` (lignes 21 et 1073)
- **Supprimer** les états `chatOpen` et `setChatOpen` (ligne 182) qui ne servent plus
- **Ajouter** dans le bloc de rendu conditionnel des onglets (après `gallery`, avant `members`) :
  ```tsx
  {activeTab === 'chat' && <ChatTab currentUser={currentUser} />}
  ```
- **Ajouter** `'chat'` dans le tableau local `tabs` (ligne 133-141) pour la navigation desktop
- **Ajouter** l'import de `ChatTab` si pas déjà présent (il est dans `ChatBubble`, pas importé directement)

**3. `ChatTab.tsx` — Ajuster la hauteur**

Actuellement `ChatTab` est conçu pour s'afficher dans un panel de `60vh`. Quand il est dans l'espace de contenu principal, il faut qu'il prenne toute la hauteur disponible entre le header et la bottom tab bar. Adapter le conteneur principal en `min-h` calculé :
```tsx
// Avant
<div className="flex flex-col h-full overflow-hidden">

// Après (quand utilisé comme onglet plein écran)
<div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 10rem - env(safe-area-inset-bottom) - env(safe-area-inset-top))' }}>
```

### Ordre des onglets résultant

```text
Mobile (scroll horizontal) :
Stats | Classement | Actus | [Présences] | Calendrier | Galerie | Membres | Discussions
```

L'onglet Discussions en dernier est cohérent : c'est une fonctionnalité "sociale" secondaire par rapport aux données sportives principales.

### Fichiers modifiés

- `src/components/dashboard/BottomTabBar.tsx` — ajout de l'onglet Discussions
- `src/pages/Dashboard.tsx` — suppression ChatBubble + ajout rendu onglet chat + nettoyage état `chatOpen`
- `src/components/dashboard/ChatTab.tsx` — ajustement hauteur pour affichage plein écran

### Impact

- La bulle flottante disparaît complètement — plus aucun problème de z-index ou de superposition
- L'expérience de chat devient une vraie page dédiée, plus spacieuse et lisible
- Aucun changement de base de données ou de logique métier
- La `ChatBubble.tsx` peut rester dans le projet (non supprimée) ou être supprimée — on la retire du rendu mais on conserve le fichier

