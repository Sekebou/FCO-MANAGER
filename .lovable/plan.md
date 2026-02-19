
# Rendre la bulle de conversation déplaçable

## Problème actuel
La bulle de chat (fermée ET ouverte) est fixée dans le coin bas-droit de l'écran (`fixed bottom-[calc(4.5rem+...)] right-4`). Quand elle est ouverte, elle prend beaucoup de place et bloque certains éléments de l'interface. L'utilisateur ne peut pas la déplacer.

## Solution
Utiliser **Framer Motion** (déjà installé dans le projet) pour rendre l'ensemble de la bulle déplaçable librement sur l'écran, aussi bien à l'état fermé (bouton rond) qu'à l'état ouvert (panneau de chat).

## Comportement attendu

- **Bulle fermée** : le bouton rond peut être glissé partout sur l'écran
- **Panneau ouvert** : une poignée de drag (en haut du panneau) permet de repositionner l'ensemble
- La position est mémorisée pendant la session (si on ouvre/ferme le chat, il reste au même endroit)
- Sur mobile, le drag fonctionne bien avec le touch
- La bulle ne sort pas des bords de l'écran (contrainte `dragConstraints` liée aux dimensions de l'écran)

## Détails techniques

### Fichier modifié : `src/components/dashboard/ChatBubble.tsx`

1. **Ajouter le state de position** avec `useRef` pour le conteneur drag :
   ```tsx
   const dragRef = useRef(null);
   ```

2. **Remplacer le conteneur `fixed`** par un `motion.div` avec les props Framer Motion :
   ```tsx
   <motion.div
     drag
     dragMomentum={false}
     dragConstraints={{ top: -500, left: -300, right: 0, bottom: 0 }}
     className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-50"
   >
     ...
   </motion.div>
   ```

3. **Ajouter une poignée de drag** sur le panneau ouvert (une barre discrète tout en haut du panneau) :
   ```tsx
   <div className="flex justify-center py-1.5 cursor-grab active:cursor-grabbing bg-primary/10">
     <div className="w-10 h-1 bg-primary/30 rounded-full" />
   </div>
   ```
   Cette poignée sera utilisée avec `dragControls` pour ne pas interférer avec les actions internes (boutons, scroll, input).

4. **Gestion du conflit scroll vs drag** : utiliser `dragListener={false}` sur le contenu scrollable pour que le scroll interne des messages ne déclenche pas le drag.

### Contraintes de drag
Les `dragConstraints` seront calculées dynamiquement selon la taille de l'écran via `window.innerWidth` / `window.innerHeight` pour éviter que la bulle sorte de l'écran.

## Ce qui ne change pas
- Le design et les fonctionnalités du chat restent identiques
- La position de départ reste en bas à droite
- Le z-index et les autres comportements sont conservés
