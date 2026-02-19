
## Masquer la bulle de chat derrière les modaux

### Diagnostic

Actuellement les z-index sont répartis ainsi :

| Élément | Z-index actuel |
|---|---|
| BottomTabBar | z-50 (50) |
| Modaux standards (AddEventForm, AddPlayerForm…) | z-50 (50) |
| Modaux Championnat | z-[60] (60) |
| Bulle de chat | z-[60] (60) |

La bulle est au même niveau que les modaux Championnat et **au-dessus** des modaux standards → elle passe par-dessus tout.

### Solution — Hiérarchie claire en 3 niveaux

```text
z-[70]  → Modaux (backdrop + contenu) — toujours au premier plan
z-[55]  → Bulle de chat — au-dessus de la navbar, sous les modaux
z-50    → BottomTabBar
```

**Changements :**

1. `ChatBubble.tsx` — passer `z-[60]` à `z-[55]` (2 occurrences : bulle fermée + panel ouvert)

2. Tous les modaux à `z-50` → `z-[70]` pour être au-dessus de la bulle :
   - `src/components/modals/AddEventForm.tsx`
   - `src/components/modals/AddPlayerForm.tsx`
   - `src/components/modals/AddNewsForm.tsx`
   - `src/components/modals/AddCardForm.tsx`
   - `src/components/modals/ConfirmModal.tsx`
   - `src/components/modals/InvitePlayerForm.tsx`
   - `src/components/modals/ChangePasswordForm.tsx`
   - `src/components/modals/AdminResetPasswordForm.tsx`
   - `src/components/modals/AvatarModal.tsx`

3. Modaux Championnat dans `ChampionnatTab.tsx` → `z-[60]` à `z-[70]`

### Résultat

Quand un modal s'ouvre, son backdrop (fond foncé) couvre toute la page y compris la bulle de chat, qui disparaît visuellement derrière l'overlay. La bulle reste néanmoins au-dessus de la navbar en toute circonstance.

### Fichiers modifiés

- `src/components/dashboard/ChatBubble.tsx` — z-[60] → z-[55]
- `src/components/modals/AddEventForm.tsx` — z-50 → z-[70]
- `src/components/modals/AddPlayerForm.tsx` — z-50 → z-[70]
- `src/components/modals/AddNewsForm.tsx` — z-50 → z-[70]
- `src/components/modals/AddCardForm.tsx` — z-50 → z-[70]
- `src/components/modals/ConfirmModal.tsx` — z-50 → z-[70]
- `src/components/modals/InvitePlayerForm.tsx` — z-50 → z-[70]
- `src/components/modals/ChangePasswordForm.tsx` — z-50 → z-[70]
- `src/components/modals/AdminResetPasswordForm.tsx` — z-50 → z-[70]
- `src/components/modals/AvatarModal.tsx` — z-50 → z-[70]
- `src/components/dashboard/ChampionnatTab.tsx` — z-[60] → z-[70]

### Impact

- Aucune logique métier modifiée
- Aucune base de données touchée
- Changement purement CSS
- Comportement cohérent sur toutes les pages et tous les modaux
