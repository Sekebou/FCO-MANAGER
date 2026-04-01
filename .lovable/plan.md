
Objectif

Supprimer le “scroll au-delà de la page” sur iPhone/iPad sans changer les couleurs de fond.

Constat

J’ai vérifié le code actuel :
- `src/index.css` essaie déjà de bloquer le rebond avec `overscroll-behavior: none` sur `html` et `body`.
- `src/pages/Dashboard.tsx` utilise encore le scroll global de la page (`window.scrollY`).
- `src/components/dashboard/BottomTabBar.tsx` et `src/hooks/useBodyScrollLock.ts` verrouillent surtout `document.body`, ce qui ne suffit pas toujours dans un WebView iOS.
- En natif iOS, le WebView peut continuer à “bouncer” même si le CSS dit non. C’est probablement pour ça que tu peux tirer trop haut/trop bas et voir du noir.

Plan de correction

1. Repasser l’app sur un conteneur de scroll interne
- Dans `src/pages/Dashboard.tsx`, remplacer le scroll de la page par un shell plein écran.
- Garder la hauteur de l’écran fixe (`100dvh`) et faire scroller uniquement la zone de contenu (`main`) avec `overflow-y-auto`.
- Le header et la barre du bas resteront dans ce shell, sans laisser le document entier bouger.

2. Déplacer la logique de scroll du header
- Remplacer l’écoute actuelle sur `window.scroll` par une écoute sur le conteneur scrollable du dashboard.
- Conserver exactement le comportement actuel du header qui se masque/affiche, mais basé sur `container.scrollTop`.

3. Rendre le lock cohérent pour modales et panneaux
- Adapter `useBodyScrollLock` pour verrouiller aussi `document.documentElement` ou, mieux, le conteneur principal de scroll quand une modale est ouverte.
- Faire la même harmonisation dans `src/components/dashboard/BottomTabBar.tsx` pour le panneau “Plus”.
- But : éviter tout scroll parasite du fond, y compris sur iOS.

4. Ajouter une sécurité native iOS
- Ajouter un petit correctif natif dans `ios/App/App/` pour désactiver le bounce du `WKWebView` (`bounces = false`, et si besoin `alwaysBounceVertical = false`).
- C’est la vraie sécurité anti-rebond côté iPhone/iPad, car le CSS seul n’est pas fiable dans un WebView natif.

5. Vérifier les autres écrans plein écran
- Contrôler `Auth`, `Register`, et les vues de garde pour éviter un retour involontaire au scroll document avec `min-h-screen`.
- Ne corriger que si ces écrans reproduisent le même défaut.

Fichiers probablement concernés

- `src/pages/Dashboard.tsx`
- `src/hooks/useBodyScrollLock.ts`
- `src/components/dashboard/BottomTabBar.tsx`
- `src/index.css`
- un nouveau fichier natif iOS dans `ios/App/App/` ou ajustement équivalent du bridge iOS

Détails techniques

- Je ne toucherai pas aux couleurs de fond.
- La cause la plus probable n’est pas le thème, mais le fait que le scroll principal est encore porté par le document + le bounce natif iOS du WebView.
- Le bon fix est donc double :
  - côté web : limiter le scroll au conteneur de contenu
  - côté iOS natif : désactiver le bounce du WebView

Validation prévue

- Tirer vers le haut et vers le bas sur iPhone : plus de zone noire visible
- Vérifier le dashboard long, la barre du haut, la barre du bas, le panneau “Plus”, et les modales
- Vérifier aussi sur iPad, puisque Apple a testé sur iPad Air
- Après implémentation native : faire un nouveau build iOS, puis `git pull` + `npx cap sync` avant le test dans Xcode
