
## Reconstruire l'onglet Discussions avec toutes les vues

### Diagnostic

La migration de la bulle vers l'onglet a remplacé `ChatBubble.tsx` par un `ChatTab.tsx` simplifié qui n'a que le chat global. Toute la logique multi-vues de `ChatBubble.tsx` a été perdue :

- Vue "tabs" : écran d'accueil avec choix Discussion Globale / Messages Privés
- Vue "global" : chat global du club
- Vue "conversations" : liste des conversations privées/groupes
- Vue "new-convo" : création d'une nouvelle conversation ou groupe
- Vue "private-chat" : chat privé ou de groupe

Le "leader" (header de navigation en haut) qui disparaissait était lié au fait que le `ChatBubble` avait un bouton de fermeture (`setChatOpen(false)`) — désormais inutile dans un onglet, mais il faut remplacer ce comportement par une navigation entre vues.

### Solution

Réécrire `ChatTab.tsx` en portant toute la logique de `ChatBubble.tsx` dans une version adaptée pour un affichage plein écran en tant qu'onglet :

1. Supprimer les props `chatOpen` / `setChatOpen` (plus besoin)
2. Ajouter la prop `members` (nécessaire pour les conversations privées)
3. Garder les 5 vues : `tabs` → `global` | `conversations` → `new-convo` → `private-chat`
4. Remplacer le bouton "fermer (X)" par un bouton "retour (←)" qui ramène à la vue `tabs`
5. Adapter les hauteurs pour un affichage plein écran (pas un panel flottant)

### Changements

**`src/components/dashboard/ChatTab.tsx`** — réécriture complète en portant le code de `ChatBubble.tsx` et en :
- Supprimant toute référence à `chatOpen` / `setChatOpen`
- Remplaçant le bouton X par un bouton ← (retour à l'accueil `tabs`)
- Adaptant la hauteur du conteneur pour `100dvh` moins header + navbar
- Ajoutant la prop `members: Member[]`

**`src/pages/Dashboard.tsx`** — modifier la ligne 1047 pour passer `members` :
```tsx
// Avant
{activeTab === 'chat' && <ChatTab currentUser={currentUser} />}
// Après
{activeTab === 'chat' && <ChatTab currentUser={currentUser} members={members} />}
```

### Architecture des vues dans le nouvel onglet

```text
Onglet "Discussions"
│
├── Vue "tabs" (accueil — par défaut)
│   ├── [💬 Discussion Globale du Club] → vue "global"
│   └── [🔒 Messages Privés]           → vue "conversations"
│
├── Vue "global" (chat global)
│   └── [← retour] → vue "tabs"
│
├── Vue "conversations" (liste des convos)
│   ├── [← retour] → vue "tabs"
│   └── [+ Nouvelle] → vue "new-convo"
│       └── [← retour] → vue "conversations"
│
└── Vue "private-chat" (chat privé/groupe)
    └── [← retour] → vue "conversations"
```

### Fichiers modifiés

- `src/components/dashboard/ChatTab.tsx` — réécriture complète
- `src/pages/Dashboard.tsx` — ajout de `members` dans le rendu de `<ChatTab>`

### Impact

- Aucune modification de base de données
- Toutes les fonctionnalités existantes (messages privés, groupes, photos) sont restaurées
- La bulle flottante reste supprimée — l'onglet devient la seule interface de chat
