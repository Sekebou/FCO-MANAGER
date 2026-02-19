
## Masquer les boutons Présent/Absent après publication des convocations

### Contexte et logique métier

Une fois que l'entraîneur clique sur "Publier" les convocations, le flux de travail est terminé du côté des présences. Afficher encore les boutons "Présent / Absent" à côté de chaque joueur n'a plus de sens — les convocations officielles prennent le relais.

**Comportement actuel** : Les boutons Présent/Absent restent visibles pour tous les joueurs, même après publication des convocations, ce qui crée une confusion entre "réponse de disponibilité" et "sélection officielle".

**Comportement cible** :
- Si `event.convocationsPublished === false` → liste présences normale avec boutons Présent/Absent
- Si `event.convocationsPublished === true` → liste présences masquée, seule la section convocations publiées est visible

---

### Ce qui change dans `PresencesTab.tsx`

**Une seule condition à modifier** — ligne 197, le bloc de la liste des présences :

```tsx
// Avant
{!isConvocationMode && (
  <div className="space-y-1.5"> ... </div>
)}

// Après
{!isConvocationMode && !event.convocationsPublished && (
  <div className="space-y-1.5"> ... </div>
)}
```

Cela suffit à masquer toute la liste des boutons Présent/Absent dès que les convocations sont publiées.

---

### Cas par cas — ce que voit chaque profil

| Situation | Liste présences | Section convocations |
|---|---|---|
| Avant publication | ✅ Visible (boutons Présent/Absent) | ❌ Cachée (ou bouton "Gérer") |
| Après publication (joueur) | ❌ Masquée | ✅ Convocations publiées |
| Après publication (coach/admin) | ❌ Masquée | ✅ Convocations + boutons Modifier/Notifier |

---

### Fichier modifié

`src/components/dashboard/PresencesTab.tsx` — **ligne 197 uniquement** :
```tsx
// condition étendue de :
{!isConvocationMode && (
// à :
{!isConvocationMode && !event.convocationsPublished && (
```

### Impact

- Modification d'une seule ligne
- Aucune logique métier ni base de données modifiée
- Les présences restent enregistrées en base, elles sont juste masquées visuellement après publication
- Si le coach modifie les convocations (bouton "Modifier"), il repasse en mode convocation — la liste présences reste cachée (déjà géré par `!isConvocationMode`)
