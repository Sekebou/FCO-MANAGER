

## Optimisation Cloud + Admin Actions en haut

### Probleme actuel de performance

Le championnat est **tres gourmand** en requetes. A chaque changement d'equipe, voici ce qui se passe :

- **useEffect 1** (classement) : `getEquipes()` + `getClassement()` + `getResultats()` + `getCalendrier()` = **4 appels**
- **useEffect 2** (matchs) : `getEquipes()` **encore** (doublon !) + `getTousMatchsAvenir()` (1 appel par mois jusqu'en juin = ~4-5 appels) + `getTousResultats()` (1 appel par mois depuis septembre = ~5-6 appels)
- **Total par changement d'equipe : ~15-20+ appels edge function**

Chaque appel edge function = 1 invocation cloud facturee.

---

### 1. Cache en memoire pour les appels FFF API

**Fichier : `src/lib/fffApi.ts`**

Ajouter un cache simple en memoire avec TTL de 5 minutes dans `callFFF()` :

```text
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function callFFF(endpoint: string) {
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const { data, error } = await supabase.functions.invoke(...);
  if (error) throw error;
  cache.set(endpoint, { data, ts: Date.now() });
  return data;
}
```

Cela reduit drastiquement les appels : si on revient sur Equipe A apres avoir regarde B, tout est en cache.

### 2. Fusionner les deux useEffect et dedupliquer getEquipes

**Fichier : `src/components/dashboard/ChampionnatTab.tsx`**

Fusionner les deux `useEffect` (lignes 242-336 et 338-394) qui se declenchent tous les deux sur `[selectedTeam]` en un seul. L'appel `getEquipes()` ne sera fait qu'une seule fois au lieu de deux.

Resultat : **-1 appel getEquipes par changement d'equipe** (economie directe).

### 3. Deplacer les actions admin en haut du classement (icones)

**Fichier : `src/components/dashboard/ChampionnatTab.tsx`**

Deplacer les boutons admin dans le header du classement (ligne 642-653), a droite du titre, sous forme d'icones compactes sans texte :

- `RefreshCw` (actualiser) - uniquement si fffUrl existe
- `Pencil` (renommer) - uniquement pour les equipes custom
- `Trash2` (supprimer)

Supprimer le bloc admin actions en bas (lignes 1093-1146).

Le header du classement passera de :

```text
[BarChart3 icon] Classement          [loader si loading]
                 Equipe A - Live FFF
```

a :

```text
[BarChart3 icon] Classement          [RefreshCw] [Pencil] [Trash2]
                 Equipe A - Live FFF
```

Les icones seront petites (14px), discretes (text-muted-foreground), avec hover colore.

---

### Resume des fichiers

| Fichier | Modification |
|---------|-------------|
| `src/lib/fffApi.ts` | Ajout cache memoire TTL 5min dans callFFF |
| `src/components/dashboard/ChampionnatTab.tsx` | Fusion des 2 useEffect + admin icons dans header classement |

### Details techniques

**Cache (fffApi.ts)** :
- Map simple `endpoint -> { data, ts }`
- TTL 5 minutes, pas de persistence (reset au rechargement de page)
- Aucun impact sur le refresh manuel (le bouton RefreshCw pourra appeler une fonction `clearFFFCache()` exportee avant de re-fetcher)

**Fusion useEffect (ChampionnatTab.tsx)** :
- Un seul `useEffect` sur `[selectedTeam]` qui fait :
  1. Resoudre `champParams` (via mapping ou decodeFFFApiRef) - 1 seul appel getEquipes
  2. En parallele : getClassement + getTousMatchsAvenir + getTousResultats + getResultats/getCalendrier pour logos
- Les logos supplementaires restent en `catch(() => null)` pour ne pas bloquer

**Admin icons (ChampionnatTab.tsx)** :
- Dans le header du bloc classement (ligne 642-653), ajouter les icones a droite
- RefreshCw : `text-accent hover:text-accent/80`, spin pendant le refresh
- Pencil : `text-muted-foreground hover:text-foreground`
- Trash2 : `text-muted-foreground hover:text-destructive`
- Supprimer le bloc `{/* Admin actions inside content */}` (lignes 1093-1146)
- Garder le bloc rename inline et delete confirmation tels quels

