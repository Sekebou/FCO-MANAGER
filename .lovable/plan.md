
## Trois améliorations dans l'onglet Présences / header événement

### 1. Bandeau info convocation — une seule ligne, compact natif

**Problème actuel** : Le bandeau prend deux lignes sur mobile car le texte est trop long.

**Solution** : Reformuler en version courte et percutante, sur une seule ligne :

```
ℹ  Uniquement les joueurs ayant répondu Présent
```

Version ultra-courte retenue :
> « Affichage limité aux joueurs présents »

Avec l'icône `UserCheck` à gauche et le style existant (`bg-muted/40`, `text-[11px]`). Une seule ligne garantie sur tout mobile ≥ 320px.

---

### 2. Localisation de l'événement — cliquable Waze/Maps + tronquée proprement

**Problème actuel** (ligne 148) :
```tsx
<p className="text-[11px] text-muted-foreground/70 mt-0.5">📍 {event.location}</p>
```
- Longue adresse affichée entièrement → déborde ou prend plusieurs lignes
- Non cliquable

**Solution** : Remplacer par un `<a>` tronqué sur 1 ligne, ouvrant Waze en priorité (fallback Google Maps) :

```tsx
{event.location && (
  <a
    href={`https://waze.com/ul?q=${encodeURIComponent(event.location)}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 mt-1 group max-w-full"
  >
    <MapPin size={11} className="shrink-0 text-accent/70" />
    <span className="text-[11px] text-accent/80 underline underline-offset-2 truncate group-active:text-accent transition-colors">
      {event.location}
    </span>
    <ExternalLink size={9} className="shrink-0 text-accent/50" />
  </a>
)}
```

- L'adresse est tronquée avec `truncate` (ellipsis `…`) si trop longue
- En cliquant → ouvre Waze directement avec l'adresse pré-remplie
- Sur desktop (pas de Waze) → Waze redirige vers son site web qui propose Google Maps en fallback
- Style discret mais identifiable : couleur accent + underline

---

### 3. Remplacer "remote" par "Lieu du match" mis en avant

En inspectant le code, il n'y a pas de champ `remote` dans l'interface `Event`. La demande concerne le **label de localisation** dans le header de l'événement :

Actuellement : `📍 {event.location}` — discret, `text-[11px] text-muted-foreground/70`

**Pour les matchs** : afficher le lieu de façon plus visible avec un libellé explicite :

```tsx
{event.location && (
  <div className="mt-1.5">
    {event.type === 'match' && (
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
        Lieu du match
      </span>
    )}
    <a href={...Waze...} className="flex items-center gap-1 group max-w-full">
      <MapPin size={11} className="shrink-0 text-accent/70" />
      <span className="text-[11px] text-accent/80 underline truncate">
        {event.location}
      </span>
      <ExternalLink size={9} className="shrink-0 text-accent/50" />
    </a>
  </div>
)}
```

Pour les matchs → label "Lieu du match" affiché au-dessus du lien
Pour entraînement/autre → juste l'icône + adresse tronquée cliquable

---

### Fichier modifié

`src/components/dashboard/PresencesTab.tsx` — deux zones :
- Ligne ~148 : bloc `event.location`
- Ligne ~382–389 : bandeau info convocation

### Imports à ajouter
`MapPin`, `ExternalLink`, `UserCheck` depuis `lucide-react` (en remplacement/ajout dans l'import ligne 6)

### Impact
- Aucune logique métier modifiée
- Aucun champ de base de données nécessaire
- Compatible iOS natif (lien `<a>` standard, Waze s'ouvre via l'app installée)
- Bandeau info tient en une ligne sur tout écran ≥ 320px
