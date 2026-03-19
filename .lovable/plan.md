

# Corrections du banc des remplaçants

## Changements prévus

### 1. Limite du drag au terrain (PitchView.tsx)
Dans `DraggablePlayer.handlePointerMove`, limiter `newY` max à ~79% quand des remplaçants existent, pour empêcher de glisser un titulaire dans la zone noire du banc.

### 2. Style du banc — compact et moderne (PitchView.tsx)
- Label "Banc" → **"Remplaçants"**
- Réduire la hauteur du banc (18.75% → ~12-13%)
- Maillots plus petits sur le banc (w-10 au lieu de w-12)
- Fond : gris anthracite plus clair avec meilleur contraste (pas bleu/noir illisible)
- Supprimer l'espace vide sous les maillots (réduire padding)
- Trier les remplaçants par numéro croissant (12, 13, 14...)

### 3. Pas de poste pour les numéros 12+ (PresencesTab.tsx)
Masquer le sélecteur de position quand le numéro assigné est ≥ 12 dans le formulaire de convocation.

## Fichiers modifiés
- `src/components/dashboard/PitchView.tsx`
- `src/components/dashboard/PresencesTab.tsx`

