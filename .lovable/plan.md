

## Correction des logos du classement + affinements visuels

### Probleme identifie
L'endpoint FFF `/classement_journees` ne retourne **pas** les logos des clubs, seulement leur `cl_no`. La fonction `extractTeamLogosFromClassement` cherche un champ `logo` qui n'existe pas dans la reponse, d'ou un dictionnaire vide.

### Plan de correction

#### 1. Recuperer les logos depuis les resultats (fffApi.ts)

Creer une nouvelle fonction `extractTeamLogosFromMatches` qui extrait les logos depuis les matchs (endpoint `/resultat`) car ceux-ci contiennent `home.club.logo` et `away.club.logo`. Indexer par `cl_no` (nombre) au lieu du nom d'equipe pour un croisement fiable avec le classement.

Modifier aussi `extractTeamLogosFromClassement` pour indexer par `cl_no` en plus du nom.

#### 2. Croiser classement + resultats dans ChampionnatTab.tsx

Dans le `useEffect` qui charge le classement live (ligne ~172), apres avoir recupere le classement, faire aussi un appel a `getResultats(cpNo, phase, poule)` pour extraire les logos de tous les clubs de la poule. Fusionner les deux sources de logos (classement + resultats) dans `liveLogos`.

Modifier le type de `liveLogos` pour supporter un index par `cl_no` (number) en plus du nom d'equipe.

#### 3. Affichage du logo dans le classement

Modifier la logique de recherche du logo dans le rendu du classement : chercher d'abord par `s.clNo` dans le dictionnaire de logos, puis fallback par nom d'equipe.

#### 4. Reduire la section Bilan (V/N/D)

- Passer le chiffre de `text-2xl` a `text-lg`
- Reduire le padding des cartes de `p-4` a `p-2.5`
- Reduire les `rounded-2xl` a `rounded-xl`
- Rendre la section plus compacte et moins imposante visuellement

#### 5. Harmoniser la police de l'onglet Championnat

Verifier et aligner les tailles de texte (`text-sm`, `text-xs`) et les `font-weight` avec les autres onglets du dashboard pour une coherence globale. Supprimer les styles trop gras ou les tailles surdimensionnees specifiques a cet onglet.

---

### Details techniques

**fffApi.ts** — nouvelle fonction :
```typescript
export function extractTeamLogosFromResults(resultatsData: any): Record<number, string> {
  const logos: Record<number, string> = {};
  const members = Array.isArray(resultatsData) 
    ? resultatsData 
    : resultatsData?.['hydra:member'] || [];
  for (const match of members) {
    if (match.home?.club?.cl_no && match.home?.club?.logo) {
      logos[match.home.club.cl_no] = match.home.club.logo;
    }
    if (match.away?.club?.cl_no && match.away?.club?.logo) {
      logos[match.away.club.cl_no] = match.away.club.logo;
    }
  }
  return logos;
}
```

**ChampionnatTab.tsx** — modification du useEffect classement :
```typescript
// Apres getClassement, ajouter :
const resultatsData = await getResultats(champParams.cpNo, champParams.phase, champParams.poule);
const logosByClNo = extractTeamLogosFromResults(resultatsData);
setLiveLogos(logosByClNo); // Indexe par cl_no maintenant
```

**ChampionnatTab.tsx** — modification du rendu classement :
```typescript
// Chercher le logo par cl_no au lieu du nom
const logo = s.clNo ? liveLogos[s.clNo] : null;
```

**ChampionnatTab.tsx** — bilan reduit :
```
- text-2xl -> text-lg
- p-4 -> p-2.5
- rounded-2xl -> rounded-xl
- gap-3 -> gap-2
```

