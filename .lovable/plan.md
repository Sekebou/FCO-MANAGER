

## Plan : Assistant de convocations en 3 étapes

Refonte du modal de convocations actuel (mono-écran) en un wizard guidé en 3 étapes dans un seul modal plein écran, avec navigation par stepper visuel.

### Vue d'ensemble

```text
┌─────────────────────────────────┐
│  Stepper:  ① ── ② ── ③         │
├─────────────────────────────────┤
│                                 │
│  Étape 1: Sélection joueurs    │
│  Étape 2: Attribution numéros  │
│  Étape 3: Récapitulatif        │
│                                 │
├─────────────────────────────────┤
│  [Annuler]    [Suivant / Pub.] │
└─────────────────────────────────┘
```

### Étape 1 — Sélectionner les joueurs

- Grille de cartes joueurs (photo + nom + poste) avec toggle tap pour sélectionner/désélectionner
- Visuel clair : carte sélectionnée = bordure accent + check vert, non sélectionné = grisé
- Barre de recherche en haut
- Compteur de sélectionnés en temps réel dans le header
- Bouton « Suivant » actif dès qu'au moins 1 joueur sélectionné

### Étape 2 — Attribuer les numéros

- Liste uniquement des joueurs sélectionnés à l'étape 1
- Chaque ligne : photo + nom + input numéro de maillot (pré-rempli si existant)
- Design épuré, inputs bien espacés, clavier numérique natif
- Possibilité de passer sans numéro (optionnel)
- Bouton « Suivant »

### Étape 3 — Récapitulatif & validation

- Résumé visuel : nombre de convoqués, liste avec noms + numéros
- Liste des non-convoqués en section repliée
- Infos match (titre, date, heure, lieu)
- Rappel de ce qui va se passer : « Notification push aux joueurs + Création feuille de match »
- Bouton « Publier & Notifier » (accent, proéminent)

### Détails techniques

**Fichier principal modifié** : `src/components/dashboard/PresencesTab.tsx`
- Nouveau state `convocationStep: 1 | 2 | 3` pour gérer la navigation
- Remplacement du contenu du modal `AnimatePresence` existant par le wizard 3 étapes
- Réutilisation de `draftConvocations`, `updateDraft`, `publishConvocations` existants
- L'étape 1 utilise un statut simplifié (sélectionné = `convoque`, non sélectionné = pas dans le draft)
- L'étape 2 ne montre que les joueurs dont `status === 'convoque'`
- L'étape 3 appelle `publishConvocations()` existant sans changement backend

**Optionnel — Composant séparé** : Si le code devient trop long, extraction dans `src/components/dashboard/ConvocationWizard.tsx` recevant les mêmes props.

Aucune modification base de données ou edge function nécessaire — le flux backend reste identique.

