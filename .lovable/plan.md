

# Formulaire d'assistance publique — Page /support

## Objectif
Créer une page `/support` publique, responsive (mobile/tablette/desktop), accessible sans authentification, pour répondre aux exigences Apple App Store. Les demandes seront envoyées à `support@fco-manager.fr` via l'Edge Function `send-email` existante.

## Changements

### 1. Créer `src/pages/Support.tsx`
- Formulaire avec champs : Nom, Email, Sujet, Message
- Validation avec zod
- Design responsive, branding FCO Manager (logo)
- Envoi via l'Edge Function `send-email` existante vers `support@fco-manager.fr`
- Messages de confirmation/erreur avec toast

### 2. Modifier `src/App.tsx`
- Ajouter la route `/support` en dehors de `AuthProvider` et `MobileOnlyGuard` (comme `/register` et `/dl-app-x7k9`)

### 3. Modifier `supabase/functions/send-email/index.ts`
- Ajouter un template "support" pour formater l'email de demande d'assistance envoyé à `support@fco-manager.fr`

**URL finale** : `https://fco-manager.fr/support`

