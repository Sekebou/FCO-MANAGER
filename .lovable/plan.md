

## Plan de correction des 7 bugs

### Bug 1 : Logos manquants dans le classement equipe A

**Probleme** : Dans `ChampionnatTab.tsx` (lignes 276-294), les logos sont recuperes depuis le classement (`classement_journees`) puis en fallback depuis `/resultat`. Mais les clubs qui n'ont pas encore joue contre Oisemont n'apparaissent dans aucun de ces deux endpoints.

**Correction** : Ajouter aussi un fetch du `/calendrier` en parallele du `/resultat` (ligne 288), puis fusionner les logos des deux sources.

**Fichier** : `src/components/dashboard/ChampionnatTab.tsx` (lignes 287-294)
- Remplacer le fetch simple de resultats par un `Promise.all` resultats + calendrier
- Fusionner les logos des deux sources dans `liveLogos`

### Bug 2 : Points de presence ajoutes en double

**Probleme** : Dans `Dashboard.tsx` (lignes 463-484), la logique verifie `hadPreviousResponse` mais quand on retire sa reponse (toggle off) puis re-repond, `hadPreviousResponse` est `false` car la cle a ete supprimee, donc les 5 pts sont re-donnes. De plus, retirer sa reponse ne retire pas les points.

**Correction** : Traquer les bonus deja accordes en verifiant dans `points_transactions` si un bonus `presence` existe deja pour cet evenement et cet utilisateur. Si le joueur retire sa reponse, deduire les 5 pts.

**Fichier** : `src/pages/Dashboard.tsx` (lignes 459-485)
- Avant de donner des points, verifier avec une query `points_transactions` si une transaction `presence` pour cet `eventId` existe deja pour le user
- Si le joueur retire sa reponse (toggle off = delete), chercher la transaction et deduire 5 pts du solde
- Mettre la description a `Présence : [eventId]` pour pouvoir la retrouver

### Bug 3 : Scroll en bas quand on switch d'onglet

**Probleme** : Dans `Dashboard.tsx` ligne 1064, `<div key={activeTab}>` re-render le contenu mais le scroll de la page reste a sa position actuelle.

**Correction** : Ajouter un `window.scrollTo(0, 0)` dans le `handleTabChange` function (ligne 184).

**Fichier** : `src/pages/Dashboard.tsx` (ligne 184)
- `const handleTabChange = (tab: string) => { window.scrollTo(0, 0); setActiveTab(tab); };`

### Bug 4 : Renommer "Classement" en "Championnat"

**Probleme** : Le tab s'appelle deja "Championnat" dans le tableau `tabs` (ligne 136). Ce bug semble deja corrige. Verification necessaire dans `BottomTabBar.tsx` au cas ou le label y est different.

**Fichier** : `src/components/dashboard/BottomTabBar.tsx` - verifier et corriger si besoin

### Bug 5 : Bouton "Convoque" qui empiete sur le nom (iPhone 12)

**Probleme** : Dans `PresencesTab.tsx` (lignes 438-463), le layout `flex items-center justify-between gap-2` ne gere pas bien les noms longs sur petit ecran car les boutons convoque/non-convoque prennent trop de place.

**Correction** : 
- Ajouter `min-w-0` et `overflow-hidden` au conteneur du nom
- Reduire la taille des boutons sur mobile : `text-[10px] px-1.5 h-7` au lieu de `text-[11px] px-2.5 h-8`
- Utiliser `truncate` sur le nom pour eviter le debordement

**Fichier** : `src/components/dashboard/PresencesTab.tsx` (lignes 464-510)

### Bug 6 : Erreur lors de la creation de conversation

**Probleme** : Dans `MessagesTab.tsx` (lignes 196-226), `createConversation` insere dans `conversations` avec `created_by: currentUser.uid`. La RLS policy pour INSERT exige `auth.uid() = ANY (participants)`. Le probleme pourrait venir du fait que le user n'est pas correctement authentifie via Supabase Auth, ou que le `participants` array n'est pas correctement formate.

**Correction** : 
- Ajouter un meilleur log d'erreur pour identifier la cause exacte
- S'assurer que `allParticipants` est un array de strings UUID valides
- Ajouter un catch plus explicite avec le message d'erreur Supabase

**Fichier** : `src/components/dashboard/MessagesTab.tsx` (lignes 215-225)
- Remplacer `if (error) throw error;` par un log detaille de l'erreur
- Verifier que `error.message` contient des infos RLS et ajuster le toast

### Bug 7 : Visibilite des points dans le profil

**Probleme** : Le `HeaderPoints` (lignes 158-172) affiche juste un petit chiffre `Coins size={9}` qui n'est pas comprehensible.

**Correction** : 
- Agrandir l'affichage : icone plus grande, label "Points" explicite
- Ajouter un fond discret pour que ca ressemble a un badge lisible
- Format : `[Coins icon] 105 pts`

**Fichier** : `src/pages/Dashboard.tsx` (lignes 167-171)

### Resume des fichiers modifies

| Fichier | Bug |
|---------|-----|
| `src/components/dashboard/ChampionnatTab.tsx` | #1 Logos manquants |
| `src/pages/Dashboard.tsx` | #2 Points en double, #3 Scroll, #7 Visibilite points |
| `src/components/dashboard/PresencesTab.tsx` | #5 Bouton convoque iPhone |
| `src/components/dashboard/MessagesTab.tsx` | #6 Erreur creation conversation |
| `src/components/dashboard/BottomTabBar.tsx` | #4 Verification renommage |

### Details techniques

**Fix logos (ChampionnatTab.tsx)** :

```text
// Lignes 287-294 : remplacer le try/catch resultats par :
try {
  const [resultatsData, calendrierData] = await Promise.all([
    getResultats(champParams.cpNo, champParams.phase, champParams.poule),
    getCalendrier(champParams.cpNo, champParams.phase, champParams.poule),
  ]);
  const logosResultats = extractTeamLogosFromResults(resultatsData);
  const logosCalendrier = extractTeamLogosFromResults(calendrierData);
  setLiveLogos(prev => ({ ...prev, ...logosResultats, ...logosCalendrier }));
} catch {}
```

**Fix points presence (Dashboard.tsx)** :

```text
togglePresence():
  // Quand on RETIRE sa reponse (toggle off) :
  if (currentPresences[playerId] === status) {
    delete currentPresences[playerId];
    // Verifier si on avait donne des points pour cet event
    const { data: existingTx } = await supabase
      .from('points_transactions')
      .select('id')
      .eq('user_id', currentUser.uid)
      .eq('type', 'presence')
      .like('description', `%${eventId}%`)
      .maybeSingle();
    if (existingTx) {
      // Retirer les 5 pts
      const { data: pts } = await supabase.from('user_points')
        .select('id, balance').eq('user_id', currentUser.uid).maybeSingle();
      if (pts) await supabase.from('user_points')
        .update({ balance: pts.balance - 5 }).eq('id', pts.id);
      await supabase.from('points_transactions')
        .delete().eq('id', existingTx.id);  // Besoin de RLS DELETE
      toast.info('-5 pts retirés');
    }
  } else {
    // Quand on AJOUTE une reponse :
    // Verifier si deja recompense pour cet event
    const { data: alreadyRewarded } = await supabase
      .from('points_transactions')
      .select('id')
      .eq('user_id', currentUser.uid)
      .eq('type', 'presence')
      .like('description', `%${eventId}%`)
      .maybeSingle();
    if (!alreadyRewarded) {
      // Donner 5 pts (logique existante)
    }
  }
```

**Note** : Il faudra ajouter une RLS policy DELETE sur `points_transactions` pour permettre aux users de supprimer leurs propres transactions, sinon utiliser un update a amount=-5 comme alternative.

**Migration SQL necessaire** :
```sql
CREATE POLICY "Users can delete own transactions"
  ON public.points_transactions FOR DELETE
  USING (auth.uid() = user_id);
```

