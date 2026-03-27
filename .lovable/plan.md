
Objectif

Rendre la publication des convocations fiable sur iPhone et éviter qu’un clic sur “Publier & Notifier” ne fasse rien.

Ce que j’ai vérifié

- Dans la base, aucun match actuel n’a `convocations_published = true`.
- Les seules feuilles de match présentes sont 2 anciennes lignes importées, sans lien avec les matchs actuels.
- Je n’ai trouvé aucun log récent d’envoi push au moment de cette action, donc le flux ne va même pas jusqu’aux notifications.
- Le code actuel fait tout côté app mobile, en plusieurs appels séparés :
  1. mise à jour du match,
  2. création de la feuille de match,
  3. récupération des tokens,
  4. envoi des pushs.
- Ce flux est fragile : si une étape bloque sur mobile ou en permissions, l’utilisateur peut avoir l’impression que “rien ne se passe”.
- J’ai aussi trouvé une incohérence de rôles existante : au moins un compte `admin+` est stocké comme `admin` dans `user_roles`. Ce n’est probablement pas la cause directe ici, mais c’est un vrai risque de permissions à corriger.

Diagnostic probable

Le problème n’est pas dans le choix des 14 joueurs ni dans le fait de mettre les autres en non convoqués.

Le vrai point faible est le flux de publication lui-même :
- il dépend de plusieurs opérations client non transactionnelles,
- il n’est pas assez traçable,
- une partie des erreurs est avalée ou trop générique,
- la création de feuille de match n’est pas protégée contre les doublons,
- le push n’est lancé qu’après les écritures, donc si la publication échoue avant, rien ne part.

Plan de correction

1. Centraliser la publication côté backend
- Créer une fonction backend dédiée du type `publish-convocations`.
- Elle fera en une seule action sécurisée :
  - validation du rôle,
  - validation des données reçues,
  - sauvegarde des convocations sur l’événement,
  - marquage `convocations_published = true`,
  - création ou mise à jour de la feuille de match liée,
  - récupération des appareils des joueurs convoqués,
  - déclenchement du push,
  - retour d’un résultat clair (`published`, `matchSheetCreated`, `notifiedCount`).

2. Fiabiliser la feuille de match
- Empêcher plusieurs feuilles pour un même match actuel.
- Ajouter une contrainte/index unique sur `match_sheets.event_id` quand `event_id` est renseigné.
- Passer la logique en “upsert/update” au lieu d’un simple insert toléré.

3. Corriger les permissions et incohérences de rôles
- Réaligner les lignes `user_roles` avec `profiles.role` pour les comptes staff existants.
- Vérifier spécialement les comptes `admin+`, `admin`, `entraineur`.
- Garder la logique de contrôle d’accès côté backend uniquement.

4. Améliorer l’UX côté app
- Remplacer le flux actuel par un seul appel backend.
- Afficher un vrai état de chargement pendant la publication.
- Afficher un message précis en cas d’échec :
  - publication refusée,
  - feuille déjà existante,
  - aucun joueur convoqué,
  - notification impossible,
  - erreur réseau.
- Fermer le mode convocation seulement si la publication backend confirme le succès.

5. Ajouter du diagnostic durable
- Journaliser côté backend :
  - l’utilisateur qui publie,
  - l’event concerné,
  - le nombre de convoqués,
  - le nombre de tokens trouvés,
  - le résultat final.
- Comme ça, si ça se reproduit, on saura immédiatement où ça casse.

6. Vérification complète après correction
- Rejouer exactement ton scénario :
  - iPhone,
  - 14 joueurs avec postes et numéros,
  - clic sur “Publier & Notifier”.
- Vérifier ensuite :
  - l’événement passe bien en publié,
  - la feuille de match apparaît,
  - les joueurs convoqués reçoivent la notification,
  - un second clic ne crée pas de doublon,
  - le cas “re-notifier” fonctionne aussi.

Détails techniques

Fichiers concernés :
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/PresencesTab.tsx`
- nouveau backend function pour la publication
- migration base de données pour sécuriser `match_sheets.event_id`
- éventuelle correction de données de rôles existants

Résultat attendu

Après correction, un clic sur “Publier & Notifier” devra toujours produire l’un de ces 2 comportements clairs :
- succès : publication + feuille de match + push,
- échec explicite : message d’erreur compréhensible, sans faux silence.

En bonus, la correction rendra aussi le système plus robuste pour tous les prochains matchs, pas seulement celui montré dans la vidéo.
