
## Décaler le rappel de licence après la fin du tutoriel

### Diagnostic précis

Le `useEffect` de vérification de licence (ligne 416) s'exécute dès que `currentUser` est chargé — indépendamment du tutoriel. Si la licence n'est pas renseignée, `setShowLicenseReminder(true)` est appelé **immédiatement**, bien avant la fin des animations (reveal 1.4s + celebrate 2.5s = ~4s) et de la redirection vers l'onglet Présences.

Chronologie actuelle (problématique) :
```text
t=0s    → Montage Dashboard, currentUser chargé
t=0.1s  → checkLicense() → showLicenseReminder = true  ← TROP TÔT
t=0.5s  → Tutoriel affiché (si première connexion)
t=4.9s  → Fin du tutoriel + redirection Présences
```

Chronologie souhaitée :
```text
t=0s    → Montage Dashboard, currentUser chargé
t=0.5s  → Tutoriel affiché (si première connexion)
t=4.9s  → Fin du tutoriel + redirection Présences
t=5.5s  → SEULEMENT MAINTENANT : afficher le rappel licence  ← CORRECT
```

### Solution

Deux changements dans `src/pages/Dashboard.tsx` :

**1. Stocker le résultat du check en mémoire sans l'afficher immédiatement**

Ajouter un état `licenseNeedsReminder` (boolean) qui indique si le rappel doit être montré, mais sans déclencher la popup directement.

```tsx
const [licenseNeedsReminder, setLicenseNeedsReminder] = useState(false);
```

Dans le `useEffect` de vérification, remplacer :
```tsx
if (!(profile?.license_expiry || playerLicense)) setShowLicenseReminder(true);
```
Par :
```tsx
if (!(profile?.license_expiry || playerLicense)) setLicenseNeedsReminder(true);
```

**2. Déclencher l'affichage seulement après la fin du tutoriel**

Dans le callback `onComplete` du tutoriel (ligne 1303), enchaîner l'affichage du rappel après le délai de redirection :

```tsx
onComplete={() => {
  setShowTutorial(false);
  setTutorialMandatory(false);
  // Redirection vers Présences après 400ms
  setTimeout(() => setActiveTab('presences'), 400);
  // Rappel licence après la fin complète de l'animation (400ms redirection + 600ms marge)
  setTimeout(() => {
    if (licenseNeedsReminder) setShowLicenseReminder(true);
  }, 1000);
}}
```

**3. Pour les utilisateurs sans tutoriel (déjà connectés)**

Le `useEffect` doit afficher le rappel directement si le tutoriel n'est pas actif. Modifier la condition :

```tsx
// Si pas de tutoriel en cours → afficher directement
if (!(profile?.license_expiry || playerLicense)) {
  if (!showTutorial) {
    setShowLicenseReminder(true);
  } else {
    setLicenseNeedsReminder(true);
  }
}
```

### Fichiers modifiés

- `src/pages/Dashboard.tsx` uniquement — 3 petits changements

### Impact

- Aucune modification de base de données
- Pour les utilisateurs existants (pas de tutoriel) : comportement identique, la popup apparaît comme avant
- Pour les nouvelles connexions (tutoriel actif) : la popup attend la fin complète de l'animation + redirection avant de s'afficher
