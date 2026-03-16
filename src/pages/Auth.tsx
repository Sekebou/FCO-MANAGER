import React, { useState, useEffect } from "react";
import { getWebOrigin } from "@/lib/getWebOrigin";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Mail, Loader2, Shield, ChevronRight, Users, TrendingUp, Calendar, ArrowLeft, Check, UserPlus, Hash, User } from "lucide-react";
import clubLogo from "@/assets/logo.png";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'expired' | 'used'>('idle');
  const [validatedInvitation, setValidatedInvitation] = useState<any>(null);
  const codeCheckTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect recovery session from email link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setRecoveryMode(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          throw { code: 'auth/invalid-credential' };
        }
        throw signInError;
      }

      const user = data.user;
      if (!user) throw new Error('Erreur de connexion');

      const { data: profile, error: profileError } = await supabase.
      from('profiles').
      select('*').
      eq('id', user.id).
      single();

      if (profileError || !profile) {
        throw new Error("Profil utilisateur introuvable. Contactez l'administrateur.");
      }

      // Session token — stored in separate secure table
      const sessionToken = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await supabase.from('user_sessions').upsert({ user_id: user.id, session_token: sessionToken, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      localStorage.setItem('sessionToken', sessionToken);

      const appUser = {
        uid: user.id,
        email: user.email || '',
        role: profile.role,
        name: profile.name,
        username: profile.username || '',
        playerId: profile.player_id || undefined,
        photoURL: profile.photo_url || null,
        team: profile.team || undefined
      };
      localStorage.setItem('currentUser', JSON.stringify(appUser));
      setCurrentUser(appUser as any);

      // Show welcome + tutorial only on first login (welcome_seen = false/null)
      if (!profile.welcome_seen) {
        const fullName = profile.name || profile.username || "joueur";
        const firstName = fullName.split(' ')[0];
        sessionStorage.setItem('showWelcome', firstName);
        await supabase.from('profiles').update({ welcome_seen: true }).eq('id', user.id);
      }

      navigate("/");
    } catch (err: any) {
      let message = "Erreur de connexion";
      if (err.code === "auth/invalid-credential") {
        message = "Email ou mot de passe incorrect";
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Veuillez entrer votre adresse email");
      return;
    }
    setError("");
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getWebOrigin()}/auth`
      });
      if (error) throw error;
      toast.success("Email envoyé ! Vérifiez aussi vos spams / courriers indésirables.", { duration: 6000 });
      setForgotMode(false);
    } catch (err: any) {
      setError("Erreur lors de l'envoi. Réessayez.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message.includes("weak") || error.message.includes("pwned")) {
          throw new Error("Ce mot de passe est trop courant. Choisissez-en un plus sécurisé.");
        }
        throw error;
      }
      setRecoverySuccess(true);
      toast.success("Mot de passe modifié avec succès !");
      // Sign out to force re-login with new password
      await supabase.auth.signOut();
      setTimeout(() => {
        setRecoveryMode(false);
        setRecoverySuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la modification");
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Live invite code validation
  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase();
    setInviteCode(upper);
    setError("");
    setValidatedInvitation(null);
    if (codeCheckTimeout.current) clearTimeout(codeCheckTimeout.current);
    if (upper.length < 4) { setCodeStatus('idle'); return; }
    setCodeStatus('checking');
    codeCheckTimeout.current = setTimeout(async () => {
      try {
        const { data: inv, error: invError } = await supabase
          .from('invitations')
          .select('*')
          .eq('invite_code', upper.trim())
          .single();
        if (invError || !inv) { setCodeStatus('invalid'); return; }
        if (inv.status === 'used' || (inv.max_uses && inv.use_count >= inv.max_uses)) { setCodeStatus('used'); return; }
        if (new Date(inv.expires_at) < new Date()) { setCodeStatus('expired'); return; }
        setCodeStatus('valid');
        setValidatedInvitation(inv);
      } catch { setCodeStatus('invalid'); }
    }, 500);
  };

  const handleRegisterWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (codeStatus !== 'valid' || !validatedInvitation) { setError("Veuillez entrer un code d'invitation valide"); return; }
    if (!regFirstName.trim() || !regLastName.trim()) { setError("Veuillez remplir tous les champs"); return; }
    if (!regEmail.trim()) { setError("Veuillez entrer votre email"); return; }
    if (regPassword.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    if (regPassword !== regConfirmPassword) { setError("Les mots de passe ne correspondent pas"); return; }

    setRegLoading(true);
    const inv = validatedInvitation;
    try {
      const fullName = `${regFirstName.trim()} ${regLastName.trim()}`;

      // Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
      });
      if (authError) {
        if (authError.message.includes('already registered')) throw new Error("Un compte avec cet email existe déjà");
        if (authError.message.includes('weak') || authError.message.includes('easy to guess') || authError.message.includes('pwned')) throw new Error("Ce mot de passe est trop courant ou trop faible. Choisissez-en un autre.");
        throw authError;
      }
      const userId = authData.user?.id;
      if (!userId) throw new Error("Erreur de création de compte");

      // Register profile via RPC
      const { data: regResult, error: regError } = await supabase.rpc('register_user', {
        p_user_id: userId,
        p_email: regEmail.trim(),
        p_name: fullName,
        p_role: inv.role,
        p_position: inv.position || 'Attaquant',
        p_license_expiry: inv.license_expiry || null,
        p_invitation_id: inv.id,
      });
      if (regError) throw regError;

      // Auto-login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: regEmail.trim(),
        password: regPassword,
      });
      if (loginError) throw loginError;
      const user = loginData.user;
      if (!user) throw new Error("Erreur de connexion automatique");

      // Fetch profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!profile) throw new Error("Profil introuvable");

      // Session token
      const sessionToken = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await supabase.from('user_sessions').upsert({ user_id: user.id, session_token: sessionToken, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      localStorage.setItem('sessionToken', sessionToken);

      const appUser = {
        uid: user.id,
        email: user.email || '',
        role: profile.role,
        name: profile.name,
        username: profile.username || '',
        playerId: profile.player_id || undefined,
        photoURL: profile.photo_url || null,
        team: profile.team || undefined
      };
      localStorage.setItem('currentUser', JSON.stringify(appUser));
      setCurrentUser(appUser as any);

      // Show welcome
      const firstName = fullName.split(' ')[0];
      sessionStorage.setItem('showWelcome', firstName);

      toast.success("Bienvenue au club ! 🎉");
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex relative overflow-hidden">
      {/* Decorative side - blue club */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-primary overflow-hidden">
        {/* Animated gradient blobs */}
        <div className="absolute w-[500px] h-[500px] bg-white/[0.07] rounded-full blur-[100px] -top-20 -left-20 animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute w-[350px] h-[350px] bg-white/[0.05] rounded-full blur-[80px] bottom-10 right-10 animate-[pulse_6s_ease-in-out_infinite_1s]" />
        <div className="absolute w-[200px] h-[200px] bg-white/[0.04] rounded-full blur-[60px] top-1/2 left-1/4 animate-[pulse_7s_ease-in-out_infinite_2s]" />

        {/* Floating ring decorations */}
        <div className="absolute top-16 right-20 w-32 h-32 rounded-full border border-white/[0.08] animate-[floatSlow_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-24 left-16 w-20 h-20 rounded-full border border-white/[0.06] animate-[floatSlow_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-1/2 right-12 w-12 h-12 rounded-full border border-white/[0.05] animate-[floatSlow_8s_ease-in-out_infinite_4s]" />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: "32px 32px"
          }} />


        <div className="relative z-10 px-16 max-w-lg flex flex-col items-center text-center">
          <div className="inline-flex items-center justify-center w-36 h-36 bg-white/15 backdrop-blur-md rounded-3xl mb-8 border border-white/25 shadow-xl shadow-black/10 animate-[fadeSlideUp_0.8s_ease-out_both] hover:scale-105 hover:bg-white/20 transition-all duration-500">
            <img src={clubLogo} alt="FCO Logo" className="w-28 h-28 object-contain drop-shadow-lg" />
          </div>

          <h1 className="text-4xl font-extrabold tracking-wide uppercase leading-tight mb-4 animate-[fadeSlideUp_0.8s_ease-out_0.1s_both]">
            <span className="inline-block text-white animate-[glowText_4s_ease-in-out_infinite]">FCO</span>
            <span className="ml-3 inline-block text-white animate-[glowText_4s_ease-in-out_infinite_2s]">Manager</span>
          </h1>

          <p className="text-white/35 text-lg leading-relaxed animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
            Votre espace dédié à la gestion et au suivi de votre club. Effectifs, calendrier, résultats et communication en un seul endroit.
          </p>

          <div className="mt-8 mb-8 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[fadeSlideUp_0.8s_ease-out_0.3s_both]" />

          <div className="space-y-3 w-full">
            {[
            { Icon: Users, text: "Gestion des effectifs et convocations" },
            { Icon: TrendingUp, text: "Résultats et classements en temps réel" },
            { Icon: Calendar, text: "Calendrier et événements du club" }].
            map((feat, i) =>
            <div
              key={feat.text}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300 cursor-default animate-[fadeSlideUp_0.6s_ease-out_both]"
              style={{ animationDelay: `${0.4 + i * 0.12}s` }}>

                <feat.Icon size={18} className="text-white/50 shrink-0" />
                <span className="text-sm font-medium text-white/60">{feat.text}</span>
              </div>
            )}


          </div>

          <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-white/20 font-semibold animate-[fadeSlideUp_0.6s_ease-out_0.8s_both]">
            Football Club d'Oisemont
          </p>
        </div>
      </div>

      {/* Login side */}
      <div className={`w-full lg:w-1/2 flex ${registerMode ? 'items-start overflow-y-auto' : 'items-center overflow-hidden'} justify-center p-4 sm:p-12 bg-background relative h-[100dvh]`} style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)', paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.03] rounded-full" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/[0.02] rounded-full" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className={`lg:hidden text-center ${registerMode ? 'mb-2' : 'mb-4'} animate-[fadeSlideUp_0.6s_ease-out_both]`}>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-2 border border-primary/20 shadow-lg shadow-primary/10">
              <img src={clubLogo} alt="FCO Logo" className="w-[70px] h-[70px] object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">FCO Manager</h1>
          </div>

          {/* Header */}
          <div className={`${registerMode ? 'mb-2' : 'mb-4'} animate-[fadeSlideUp_0.6s_ease-out_0.05s_both]`}>
            <h2 className="text-xl font-bold text-foreground">
              {recoveryMode ? "Nouveau mot de passe" : registerMode ? "Créer un compte" : "Connexion"}
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5">
              {recoveryMode ? "Choisissez votre nouveau mot de passe" : registerMode ? "Entrez votre code d'invitation pour vous inscrire" : "Application officielle du Football Club d'Oisemont"}
            </p>
          </div>

          {/* Form card */}
          <div className={`bg-card rounded-2xl ${registerMode ? 'p-4' : 'p-5'} sm:p-8 border border-border shadow-sm animate-[fadeSlideUp_0.6s_ease-out_0.1s_both]`}>
            {recoveryMode ? (
              recoverySuccess ? (
                <div className="text-center py-6 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full border border-success/20">
                    <Check size={32} className="text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Mot de passe modifié !</h3>
                    <p className="text-sm text-muted-foreground mt-1">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRecoverySubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nouveau mot de passe</label>
                    <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3.5 ${focused === "newpw" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                      <Lock className={`shrink-0 transition-colors duration-200 ${focused === "newpw" ? "text-primary" : "text-muted-foreground/50"}`} size={18} />
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onFocus={() => setFocused("newpw")} onBlur={() => setFocused(null)}
                        className="w-full py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                        placeholder="Min. 8 caractères" required minLength={8} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confirmer le mot de passe</label>
                    <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3.5 ${focused === "confirmpw" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                      <Lock className={`shrink-0 transition-colors duration-200 ${focused === "confirmpw" ? "text-primary" : "text-muted-foreground/50"}`} size={18} />
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setFocused("confirmpw")} onBlur={() => setFocused(null)}
                        className="w-full py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                        placeholder="Répéter le mot de passe" required minLength={8} />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                      <Shield size={16} className="shrink-0" /> {error}
                    </div>
                  )}
                  <button type="submit" disabled={recoveryLoading}
                    className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {recoveryLoading ? <><Loader2 className="animate-spin" size={20} /> Modification...</> : <>Modifier le mot de passe <ChevronRight size={18} /></>}
                  </button>
                </form>
              )
            ) : forgotMode ?
            <form onSubmit={handleForgotPassword} className="space-y-5">
                <button type="button" onClick={() => {setForgotMode(false);setError("");}}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
                  <ArrowLeft size={16} /> Retour
                </button>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Mot de passe oublié</h3>
                  <p className="text-sm text-muted-foreground">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email</label>
                  <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3.5 ${focused === "email" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                    <Mail className={`shrink-0 transition-colors duration-200 ${focused === "email" ? "text-primary" : "text-muted-foreground/50"}`} size={18} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                  className="w-full py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                  placeholder="votre@email.com" required />
                  </div>
                </div>
                {error &&
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                    <Shield size={16} className="shrink-0" /> {error}
                  </div>
              }
                <button type="submit" disabled={resetLoading}
              className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {resetLoading ? <><Loader2 className="animate-spin" size={20} /> Envoi...</> : <>Envoyer le lien <Mail size={18} /></>}
                </button>
              </form> : registerMode ?
            (regSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 rounded-full border border-accent/20">
                  <Check size={32} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Compte créé ! 🎉</h3>
                  <p className="text-sm text-muted-foreground mt-1">Connexion en cours...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterWithCode} className="space-y-3">
                <button type="button" onClick={() => { setRegisterMode(false); setError(""); setCodeStatus('idle'); setValidatedInvitation(null); setInviteCode(""); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft size={16} /> Retour
                </button>
                {/* Code field with live validation */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Code d'invitation</label>
                  <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border px-3 ${
                    codeStatus === 'valid' ? 'border-green-500/50 ring-2 ring-green-500/20' :
                    codeStatus === 'invalid' || codeStatus === 'expired' || codeStatus === 'used' ? 'border-destructive/50 ring-2 ring-destructive/20' :
                    focused === "code" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : "border-border"
                  }`}>
                    <Hash className={`shrink-0 transition-colors duration-200 ${
                      codeStatus === 'valid' ? 'text-green-500' :
                      codeStatus === 'invalid' || codeStatus === 'expired' || codeStatus === 'used' ? 'text-destructive' :
                      focused === "code" ? "text-primary" : "text-muted-foreground/50"
                    }`} size={18} />
                    <input type="text" value={inviteCode} onChange={(e) => handleCodeChange(e.target.value)} onFocus={() => setFocused("code")} onBlur={() => setFocused(null)}
                      className="w-full py-3 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm font-mono tracking-wider uppercase"
                      placeholder="FCO-XXXX" required maxLength={10} autoComplete="off" />
                    <div className="shrink-0">
                      {codeStatus === 'checking' && <Loader2 size={18} className="animate-spin text-muted-foreground" />}
                      {codeStatus === 'valid' && (
                        <div className="relative flex items-center justify-center">
                          <div className="absolute w-6 h-6 bg-green-500/30 rounded-full animate-ping" />
                          <div className="w-4 h-4 bg-green-500 rounded-full relative z-10 flex items-center justify-center">
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                      {(codeStatus === 'invalid' || codeStatus === 'expired' || codeStatus === 'used') && (
                        <div className="w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">✕</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {codeStatus === 'valid' && validatedInvitation && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1 animate-fade-in">
                      <Shield size={12} /> Code valide — Rôle : <span className="font-semibold">{validatedInvitation.role}</span>
                    </p>
                  )}
                  {codeStatus === 'invalid' && <p className="text-xs text-destructive mt-1 animate-fade-in">Code d'invitation invalide</p>}
                  {codeStatus === 'expired' && <p className="text-xs text-destructive mt-1 animate-fade-in">Ce code a expiré</p>}
                  {codeStatus === 'used' && <p className="text-xs text-destructive mt-1 animate-fade-in">Ce code a déjà été utilisé</p>}
                </div>

                {/* Rest of form - only enabled when code is valid */}
                <fieldset disabled={codeStatus !== 'valid'} className={`space-y-3 transition-opacity duration-300 ${codeStatus !== 'valid' ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Prénom</label>
                      <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3 ${focused === "regfirst" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                        <User className={`shrink-0 transition-colors duration-200 ${focused === "regfirst" ? "text-primary" : "text-muted-foreground/50"}`} size={16} />
                        <input type="text" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} onFocus={() => setFocused("regfirst")} onBlur={() => setFocused(null)}
                          className="w-full py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                          placeholder="Prénom" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Nom</label>
                      <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3 ${focused === "reglast" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                        <User className={`shrink-0 transition-colors duration-200 ${focused === "reglast" ? "text-primary" : "text-muted-foreground/50"}`} size={16} />
                        <input type="text" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} onFocus={() => setFocused("reglast")} onBlur={() => setFocused(null)}
                          className="w-full py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                          placeholder="Nom" required />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
                    <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3 ${focused === "regemail" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                      <Mail className={`shrink-0 transition-colors duration-200 ${focused === "regemail" ? "text-primary" : "text-muted-foreground/50"}`} size={18} />
                      <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} onFocus={() => setFocused("regemail")} onBlur={() => setFocused(null)}
                        className="w-full py-3 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                        placeholder="votre@email.com" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Mot de passe</label>
                      <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3 ${focused === "regpw" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                        <Lock className={`shrink-0 transition-colors duration-200 ${focused === "regpw" ? "text-primary" : "text-muted-foreground/50"}`} size={16} />
                        <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} onFocus={() => setFocused("regpw")} onBlur={() => setFocused(null)}
                          className="w-full py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                          placeholder="Min. 8 car." required minLength={8} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Confirmer</label>
                      <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3 ${focused === "regconfirm" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                        <Lock className={`shrink-0 transition-colors duration-200 ${focused === "regconfirm" ? "text-primary" : "text-muted-foreground/50"}`} size={16} />
                        <input type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} onFocus={() => setFocused("regconfirm")} onBlur={() => setFocused(null)}
                          className="w-full py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                          placeholder="Confirmer" required minLength={8} />
                      </div>
                    </div>
                  </div>
                </fieldset>
                {error &&
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2.5 rounded-xl text-sm animate-fade-in">
                    <Shield size={16} className="shrink-0" /> {error}
                  </div>
                }
                <button type="submit" disabled={regLoading || codeStatus !== 'valid'}
                  className="group w-full bg-accent text-accent-foreground py-3 rounded-xl font-semibold hover:bg-accent/90 hover:shadow-xl hover:shadow-accent/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {regLoading ? <><Loader2 className="animate-spin" size={20} /> Création...</> : <>Créer mon compte <ChevronRight size={18} /></>}
                </button>
                {/* Bottom spacer for safe area */}
                <div className="h-4" />
              </form>
            )) :

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email</label>
                  <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3.5 ${focused === "email" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                    <Mail className={`shrink-0 transition-colors duration-200 ${focused === "email" ? "text-primary" : "text-muted-foreground/50"}`} size={18} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                  className="w-full py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                  placeholder="votre@email.com" required />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mot de passe</label>
                    <button type="button" onClick={() => {setForgotMode(true);setError("");}}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">Mot de passe oublié ?</button>
                  </div>
                  <div className={`flex items-center gap-2 rounded-xl transition-all duration-300 bg-secondary border border-border px-3.5 ${focused === "password" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5 border-primary/50" : ""}`}>
                    <Lock className={`shrink-0 transition-colors duration-200 ${focused === "password" ? "text-primary" : "text-muted-foreground/50"}`} size={18} />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)}
                  className="w-full py-3.5 bg-transparent text-foreground placeholder:text-muted-foreground/50 transition-all outline-none text-sm"
                  placeholder="••••••••" required />
                  </div>
                </div>
                {error &&
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                    <Shield size={16} className="shrink-0" /> {error}
                  </div>
              }
                <button type="submit" disabled={loading}
              className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <>Se connecter <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" /></>}
                  {loading && "Connexion..."}
                </button>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou</span></div>
                </div>
                <button type="button" onClick={() => { setRegisterMode(true); setError(""); }}
                  className="group w-full bg-secondary text-foreground py-3 rounded-xl font-medium hover:bg-secondary/80 transition-all flex items-center justify-center gap-2 text-sm">
                  <UserPlus size={18} className="text-primary" /> Créer un compte
                </button>
              </form>
            }
          </div>

          {/* Features description (mobile) - hidden in register mode */}
          {!registerMode && (
            <div className="lg:hidden mt-3 space-y-1.5 animate-[fadeSlideUp_0.6s_ease-out_0.2s_both]">
              {[
              { Icon: Users, text: "Gestion des effectifs et convocations" },
              { Icon: TrendingUp, text: "Résultats et classements en temps réel" },
              { Icon: Calendar, text: "Calendrier et événements du club" }].
              map((feat) =>
              <div
                key={feat.text}
                className="items-center gap-2.5 py-2 rounded-lg bg-secondary/60 border border-border/50 flex flex-row px-[12px]">
                  <feat.Icon size={14} className="text-primary/60 shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{feat.text}</span>
                </div>
              )}
            </div>
          )}

          {/* Club name + Status */}
          <div className="mt-3 flex flex-col items-center gap-2 animate-[fadeSlideUp_0.6s_ease-out_0.3s_both]">
            <p className="lg:hidden text-[10px] text-muted-foreground/50 font-medium">Football Club d'Oisemont</p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-success/20 bg-success/5">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <p className="text-[10px] text-success/70 font-medium">Connecté au serveur local </p>
            </div>
          </div>
        </div>
      </div>
    </div>);

};

export default Auth;