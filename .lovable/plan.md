

## Optimisation de la barre de navigation mobile

### Objectif

Afficher exactement **4 onglets visibles** a la fois sur mobile, sans qu'on voie le debut ou la fin des onglets voisins. Quand on change d'onglet, le scroll se repositionne pour garder **2 onglets a gauche et 2 a droite** de la zone visible.

### Ce qui change

**Fichier : `src/components/dashboard/BottomTabBar.tsx`**

1. **Largeur fixe des onglets** : chaque onglet prendra exactement **25% de la largeur** du conteneur, ce qui garantit que 4 onglets sont visibles a la fois, ni plus ni moins.

2. **Masquer le debordement** : remplacer le scroll libre (`overflow-x-auto`) par un conteneur qui cache les onglets hors champ (`overflow: hidden` gere par JS). Aucun bout d'onglet ne depasse.

3. **Scroll intelligent au changement d'onglet** : quand on clique sur un onglet, le conteneur se repositionne pour centrer la vue autour de l'onglet actif. Concretement :
   - Si l'onglet actif est le 1er ou 2e, on montre les onglets 1-4
   - Si l'onglet actif est le 7e ou 8e, on montre les onglets 5-8
   - Sinon, on centre l'onglet actif avec 2 voisins de chaque cote (on montre un groupe de 4 parmi lequel l'actif est en position 2 ou 3)

4. **Animation fluide** : le deplacement utilise `scrollTo({ behavior: 'smooth' })` ou un `transform: translateX()` anime pour une transition naturelle entre les groupes.

5. **Pas de scroll manuel** : l'utilisateur ne peut plus scroller librement la barre, c'est le clic sur un onglet qui declenche le repositionnement.

### Comportement detaille

Avec les 8 onglets [Stats, Championnat, Actus, Presences, Calendrier, Galerie, Membres, Discussions] :

| Onglet actif | Onglets visibles |
|---|---|
| Stats (1) | Stats, Championnat, Actus, Presences |
| Championnat (2) | Stats, Championnat, Actus, Presences |
| Actus (3) | Championnat, Actus, Presences, Calendrier |
| Presences (4) | Actus, Presences, Calendrier, Galerie |
| Calendrier (5) | Presences, Calendrier, Galerie, Membres |
| Galerie (6) | Calendrier, Galerie, Membres, Discussions |
| Membres (7) | Calendrier, Galerie, Membres, Discussions |
| Discussions (8) | Calendrier, Galerie, Membres, Discussions |

Regle : l'onglet actif est toujours en position 2 ou 3 dans le groupe visible (jamais tout au bord), sauf aux extremites.

### Ce qui ne change PAS

- Taille, couleurs, icones, animations des onglets
- Le style du fond (glassmorphism, bordure)
- L'onglet "featured" (Presences) garde son style special
- La version tablette (md+) reste identique (tous les onglets visibles)

### Details techniques

- Remplacer `overflow-x-auto` par `overflow-hidden` sur le conteneur mobile
- Chaque bouton passe de `min-w-[4rem]/min-w-[5rem]` a `w-1/4 shrink-0` (25% exact)
- Calculer l'offset de scroll : `const startIndex = Math.max(0, Math.min(activeIndex - 1, totalTabs - 4))` puis `scrollTo(startIndex * tabWidth)`
- Transition smooth via CSS `scroll-behavior: smooth` ou `transform` anime

