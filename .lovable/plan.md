
## Refonte de l'onglet Discussions

### Changements demandés

1. **Supprimer le fond bleu (`bg-primary`)** dans tous les headers de l'onglet → utiliser `bg-card border-b border-border` comme les autres onglets du dashboard
2. **Supprimer le logo** à côté du titre "Discussions" dans le header d'accueil et le header du chat global
3. **Indicateur de présence en ligne** (point vert pulsé / rouge) dans la liste des conversations et dans l'en-tête du chat privé
4. **Système "Vu par"** sur les messages privés — affichage de l'avatar de l'autre utilisateur sous le dernier message qu'il a lu, comme Facebook Messenger ou iMessage

---

### Détails techniques

#### 1. Suppression du fond bleu + logo

Tous les headers (`bg-primary text-primary-foreground`) deviennent `bg-card border-b border-border text-foreground`. Les textes s'adaptent. Les boutons `hover:bg-white/15` deviennent `hover:bg-secondary`. Les `ArrowLeft` et icônes restent visibles en `text-foreground`.

Concernant le logo :
- Vue `tabs` : supprimer `<img src={clubLogo} ...>` dans le header
- Vue `global` : supprimer `<img src={clubLogo} ...>` dans le header du chat global
- L'import `clubLogo` reste utile pour l'avatar de la discussion globale dans la liste → on le garde

#### 2. Présence en ligne — nouveau système

**Base de données :** Ajouter une colonne `last_seen_at` à la table `profiles` (timestamp, nullable). Une migration SQL sera créée.

**Logique frontend :**
- À l'ouverture de l'onglet Discussions, mettre à jour `last_seen_at` toutes les **30 secondes** via un `setInterval`
- Un utilisateur est considéré **en ligne** (🟢) si son `last_seen_at` est dans les **2 dernières minutes**
- Un utilisateur est considéré **hors ligne** (🔴) si son `last_seen_at` est plus ancien ou absent
- Charger les `last_seen_at` de tous les membres via `profiles` en temps réel (realtime channel)
- Afficher le point dans :
  - La liste des conversations privées (sur l'avatar)
  - L'en-tête du chat privé ouvert (avec texte "En ligne" ou "Hors ligne")
  - La liste de sélection de membres (vue `new-convo`)

**Apparence :**
```
🟢 point vert pulsé → en ligne (last_seen < 2 min)
🔴 point rouge fixe → hors ligne
```

#### 3. Système "Vu par" — style Facebook/iMessage

**Base de données :** Ajouter une colonne `read_by` de type `jsonb` (objet `{ userId: lastReadMessageId }`) à la table `conversations`. Quand un utilisateur ouvre une conversation, on enregistre l'ID du dernier message qu'il a vu.

**Logique :**
- Quand l'utilisateur ouvre un chat privé → `read_by[userId] = lastMessageId`
- Affichage : sous le **dernier message envoyé par l'utilisateur courant**, afficher les petits avatars des participants qui ont vu jusqu'à ce message (hors soi-même)
- Si plusieurs personnes ont vu → afficher leurs avatars empilés (max 3)
- Style : petits avatars circulaires de 14px, alignés à droite sous la bulle

**Exemple visuel :**
```
[Mon message ici              ]
                         Vu ✓✓ 👤
```

---

### Fichiers modifiés

- `src/components/dashboard/ChatTab.tsx` — suppression fond bleu + logo + présence + "vu par"
- **Migration SQL** — ajout de `last_seen_at` à `profiles` et `read_by` à `conversations`

### Impact

- Aucune logique métier touchée
- Les messages existants ne sont pas affectés
- La présence en ligne est passive (mise à jour auto toutes les 30 sec)
- Rétrocompatible : `read_by` est nullable, `last_seen_at` est nullable
