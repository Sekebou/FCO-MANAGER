

## Plan : Supprimer les popups de points et limiter les points à son propre compte

### Problème
1. Les toasts "+5 pts" / "-5 pts" s'affichent à chaque action de présence → ralentit l'UX
2. Un entraîneur/admin qui modifie la présence d'un **autre joueur** gagne lui-même 5 pts à chaque modification → exploitation abusive

### Changements prévus

**Fichier : `src/pages/Dashboard.tsx`**

1. **Supprimer les 3 toasts liés aux points dans `togglePresence`** (lignes 846, 859) :
   - Retirer `toast.info('-5 pts retirés')`
   - Retirer `toast.success('+5 pts de pari ajoutés !', { icon: '🎉' })`

2. **Limiter l'attribution de points à son propre compte** : Envelopper toute la logique de points (lignes 836-862) dans une condition `if (isOwnPresence)` — les points ne sont attribués/retirés que lorsque le joueur modifie **sa propre** présence. Un entraîneur qui corrige la réponse d'un autre joueur ne gagne plus de points.

3. **Supprimer le toast de points pour les commentaires** (ligne 1138) : Retirer `toast.success('+5 pts de pari ajoutés !', { icon: '💬' })` — le système de points pour les commentaires reste fonctionnel mais sans popup.

### Résumé des changements
- La logique de points reste 100% fonctionnelle
- Plus aucun toast/popup de points ne s'affiche
- Seul un joueur répondant pour **lui-même** gagne des points
- Un manager corrigeant la réponse d'un autre joueur ne gagne rien

