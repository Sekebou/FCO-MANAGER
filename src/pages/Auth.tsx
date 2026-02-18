import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, doc, getDoc, updateDoc } from "@/lib/firebase";
import { setIdToken, isIOSCapacitor, restSendPasswordReset } from "@/lib/firestore-rest";
import { signInWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Mail, Loader2, Shield, ChevronRight, Users, TrendingUp, Calendar, ArrowLeft } from "lucide-react";
import clubLogo from "@/assets/logo.svg";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isCapacitor = !!(window as any).Capacitor;

      if (isIOS && isCapacitor) {
        // iOS Capacitor: Firebase SDK signIn hangs forever. Use REST API directly.
        console.log('[AUTH-iOS] Using REST API bypass for iOS Capacitor');
        const apiKey = 'AIzaSyAExtesWZPAEbQbGm5Rp17ek1PuWx_uceQ';
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              password,
              returnSecureToken: true,
            }),
          }
        );
        const data = await res.json();
        console.log('[AUTH-iOS] REST response status:', res.status);
        
        if (!res.ok) {
          // Map Firebase REST errors to user-friendly messages
          const errMsg = data?.error?.message || '';
          if (errMsg.includes('EMAIL_NOT_FOUND') || errMsg.includes('INVALID_PASSWORD') || errMsg.includes('INVALID_LOGIN_CREDENTIALS')) {
            throw { code: 'auth/invalid-credential' };
          } else if (errMsg.includes('TOO_MANY_ATTEMPTS')) {
            throw { code: 'auth/too-many-requests' };
          } else if (errMsg.includes('INVALID_EMAIL')) {
            throw { code: 'auth/invalid-email' };
          }
          throw new Error(errMsg || 'Erreur de connexion');
        }

        const uid = data.localId;
        const userEmail = data.email;
        console.log('[AUTH-iOS] REST auth OK, uid=', uid);

        // Firestore SDK also hangs on iOS Capacitor WebView.
        // Use Firestore REST API with the idToken from auth.
        const idToken = data.idToken;
        const projectId = 'fco-manager-caccd';
        
        // Fetch user profile via Firestore REST API
        console.log('[AUTH-iOS] Fetching user profile via REST...');
        const userDocRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
          { headers: { 'Authorization': `Bearer ${idToken}` } }
        );
        console.log('[AUTH-iOS] Firestore REST status:', userDocRes.status);
        
        if (!userDocRes.ok) {
          throw new Error("Profil utilisateur introuvable. Contactez l'administrateur.");
        }
        
        const userDocData = await userDocRes.json();
        const fields = userDocData.fields || {};
        
        // Helper to extract Firestore REST field values
        const getField = (f: any): any => {
          if (!f) return null;
          if (f.stringValue !== undefined) return f.stringValue;
          if (f.booleanValue !== undefined) return f.booleanValue;
          if (f.integerValue !== undefined) return Number(f.integerValue);
          if (f.nullValue !== undefined) return null;
          return null;
        };

        const userData = {
          role: getField(fields.role) || '',
          name: getField(fields.name) || '',
          username: getField(fields.username) || '',
          playerId: getField(fields.playerId) || null,
          photoURL: getField(fields.photoURL) || null,
          welcomeSeen: getField(fields.welcomeSeen) || false,
        };
        console.log('[AUTH-iOS] User profile loaded:', userData.name);

        // Generate session token and write via Firestore REST API (fire & forget)
        const sessionToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // Don't await — write in background
        fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=sessionToken`,
          {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { sessionToken: { stringValue: sessionToken } } }),
          }
        ).catch(err => console.warn('[AUTH-iOS] sessionToken write failed:', err));
        localStorage.setItem('sessionToken', sessionToken);
        // Store idToken for REST API calls
        setIdToken(idToken, parseInt(data.expiresIn || '3600'));

        const appUser = {
          uid,
          email: userEmail,
          role: userData.role,
          name: userData.name,
          username: userData.username,
          playerId: userData.playerId,
          photoURL: userData.photoURL,
        };
        localStorage.setItem("currentUser", JSON.stringify(appUser));
        // Update AuthContext state immediately so Dashboard doesn't redirect back
        setCurrentUser(appUser as any);

        // Store refresh token so we can re-auth the SDK on app restart
        if (data.refreshToken) {
          localStorage.setItem('firebaseRefreshToken', data.refreshToken);
        }
        // Store credentials for SDK re-auth on iOS app restart
        localStorage.setItem('iosAuthEmail', email.trim());
        localStorage.setItem('iosAuthPass', btoa(password));

        // Navigate IMMEDIATELY — everything else is fire & forget
        const displayName = userData.name || userData.username || "joueur";
        if (!userData.welcomeSeen) {
          sessionStorage.setItem('showWelcome', displayName);
        }
        navigate("/");

        // Background: welcomeSeen flag + SDK sign-in (non-blocking)
        if (!userData.welcomeSeen) {
          fetch(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=welcomeSeen`,
            {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: { welcomeSeen: { booleanValue: true } } }),
            }
          ).catch(() => {});
        }

        // Try SDK sign-in in background (non-blocking)
        (async () => {
          try {
            const { authReady: ar } = await import('@/lib/firebase');
            await Promise.race([ar, new Promise<void>(r => setTimeout(r, 2000))]);
            const credential = EmailAuthProvider.credential(email.trim(), password);
            await Promise.race([
              signInWithCredential(auth, credential),
              new Promise((_, reject) => setTimeout(() => reject(new Error('SDK timeout')), 4000)),
            ]);
            console.log('[AUTH-iOS] SDK sign-in also succeeded — listeners will work');
          } catch (sdkErr) {
            console.warn('[AUTH-iOS] SDK sign-in failed/timed out, REST session only:', sdkErr);
          }
        })();

        return; // Skip the normal SDK flow below
      }

      // Non-iOS path: use normal SDK
      console.log('[AUTH-iOS] Step 1: waiting authReady...');
      const { authReady } = await import('@/lib/firebase');
      await Promise.race([
        authReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout persistence')), 5000))
      ]).catch(() => console.warn('[AUTH-iOS] Auth persistence setup timed out, continuing anyway'));

      console.log('[AUTH-iOS] Step 2: calling signInWithEmailAndPassword...');
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('[AUTH-iOS] Step 3: signIn OK, uid=', userCredential.user.uid);
      
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      console.log('[AUTH-iOS] Step 4: getDoc OK, exists=', userDoc.exists());

      // Generate unique session token and write to Firestore (fallback for iOS WebView)
      const sessionToken = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await updateDoc(doc(db, "users", user.uid), { sessionToken });
      console.log('[AUTH-iOS] Step 5: sessionToken written');
      localStorage.setItem('sessionToken', sessionToken);

      if (!userDoc.exists()) {
        throw new Error("Profil utilisateur introuvable. Contactez l'administrateur.");
      }

      const userData = userDoc.data();
      const appUser = {
        uid: user.uid,
        email: user.email || '',
        role: userData.role,
        name: userData.name,
        username: userData.username || "",
        playerId: userData.playerId || null,
        photoURL: userData.photoURL || null,
      };
      localStorage.setItem("currentUser", JSON.stringify(appUser));
      setCurrentUser(appUser as any);

      const displayName = userData.name || userData.username || "joueur";
      // Flag first login to show welcome modal on Dashboard
      if (!userData.welcomeSeen) {
        sessionStorage.setItem('showWelcome', displayName);
        await updateDoc(doc(db, "users", user.uid), { welcomeSeen: true });
      }

      navigate("/");

    } catch (err: any) {
      let message = "Erreur de connexion";
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        message = "Email ou mot de passe incorrect";
      } else if (err.code === "auth/invalid-email") {
        message = "Email invalide";
      } else if (err.code === "auth/too-many-requests") {
        message = "Trop de tentatives. Réessayez plus tard.";
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
      if (isIOSCapacitor) {
        await restSendPasswordReset(email.trim());
      } else {
        await sendPasswordResetEmail(auth, email.trim());
      }
      toast.success("Email envoyé ! Vérifiez aussi vos spams / courriers indésirables.", { duration: 6000 });
      setForgotMode(false);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("Aucun compte associé à cet email");
      } else if (err.code === "auth/invalid-email") {
        setError("Email invalide");
      } else if (err.code === "auth/too-many-requests") {
        setError("Trop de tentatives. Réessayez plus tard.");
      } else {
        setError("Erreur lors de l'envoi. Réessayez.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
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
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 px-16 max-w-lg flex flex-col items-center text-center">
          {/* Club logo - large and prominent */}
          <div className="inline-flex items-center justify-center w-36 h-36 bg-white/15 backdrop-blur-md rounded-3xl mb-8 border border-white/25 shadow-xl shadow-black/10 animate-[fadeSlideUp_0.8s_ease-out_both] hover:scale-105 hover:bg-white/20 transition-all duration-500">
            <img src={clubLogo} alt="FCO Logo" className="w-28 h-28 object-contain drop-shadow-lg" />
          </div>

          {/* Title - single line */}
          <h1 className="text-4xl font-extrabold tracking-wide uppercase leading-tight mb-4 animate-[fadeSlideUp_0.8s_ease-out_0.1s_both]">
            <span className="inline-block text-white animate-[glowText_4s_ease-in-out_infinite]">FCO</span>
            <span className="ml-3 inline-block text-white animate-[glowText_4s_ease-in-out_infinite_2s]">Manager</span>
          </h1>

          {/* Subtitle */}
          <p className="text-white/35 text-lg leading-relaxed animate-[fadeSlideUp_0.8s_ease-out_0.2s_both]">
            Gérez votre équipe, suivez les présences et les performances de vos joueurs en un seul endroit.
          </p>

          {/* Separator line */}
          <div className="mt-8 mb-8 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[fadeSlideUp_0.8s_ease-out_0.3s_both]" />

          {/* Feature pills - 3 features + "et bien plus" */}
          <div className="space-y-3 w-full">
            {[
              { Icon: Users, text: "Gestion des présences" },
              { Icon: TrendingUp, text: "Suivi des performances" },
              { Icon: Calendar, text: "Calendrier des événements" },
            ].map((feat, i) => (
              <div
                key={feat.text}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300 cursor-default animate-[fadeSlideUp_0.6s_ease-out_both]"
                style={{ animationDelay: `${0.4 + i * 0.12}s` }}
              >
                <feat.Icon size={18} className="text-white/50 shrink-0" />
                <span className="text-sm font-medium text-white/60">{feat.text}</span>
              </div>
            ))}
            <p
              className="text-xs text-white/30 font-medium pt-1 animate-[fadeSlideUp_0.6s_ease-out_both]"
              style={{ animationDelay: "0.76s" }}
            >
              … et bien d'autres fonctionnalités
            </p>
          </div>

          {/* Bottom decorative text */}
          <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-white/20 font-semibold animate-[fadeSlideUp_0.6s_ease-out_0.8s_both]">
            Football Club Organisation
          </p>
        </div>
      </div>

      {/* Login side - white */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.03] rounded-full" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/[0.02] rounded-full" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10 animate-[fadeSlideUp_0.6s_ease-out_both]">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-4 border border-primary/20 shadow-lg shadow-primary/10">
              <img src={clubLogo} alt="FCO Logo" className="w-14 h-14 object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-foreground uppercase tracking-wide">
              FCO Manager
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8 animate-[fadeSlideUp_0.6s_ease-out_0.05s_both]">
            <h2 className="text-2xl font-bold text-foreground">Connexion</h2>
            <p className="text-muted-foreground text-sm mt-1">Accédez à votre espace de gestion</p>
          </div>

          {/* Form card */}
          <div className="bg-card rounded-2xl p-6 sm:p-8 border border-border shadow-sm animate-[fadeSlideUp_0.6s_ease-out_0.1s_both]">
            {forgotMode ? (
              /* Forgot password form */
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(""); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft size={16} />
                  Retour
                </button>

                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Mot de passe oublié</h3>
                  <p className="text-sm text-muted-foreground">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <div
                    className={`relative rounded-xl transition-all duration-300 ${focused === "email" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5" : ""}`}
                  >
                    <Mail
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === "email" ? "text-primary" : "text-muted-foreground/50"}`}
                      size={18}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full pl-11 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                      placeholder="votre@email.com"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                    <Shield size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Envoi...
                    </>
                  ) : (
                    <>
                      Envoyer le lien
                      <Mail size={18} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Login form */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <div
                    className={`relative rounded-xl transition-all duration-300 ${focused === "email" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5" : ""}`}
                  >
                    <Mail
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === "email" ? "text-primary" : "text-muted-foreground/50"}`}
                      size={18}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full pl-11 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                      placeholder="votre@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(""); }}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div
                    className={`relative rounded-xl transition-all duration-300 ${focused === "password" ? "ring-2 ring-primary/30 shadow-md shadow-primary/5" : ""}`}
                  >
                    <Lock
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused === "password" ? "text-primary" : "text-muted-foreground/50"}`}
                      size={18}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="w-full pl-11 pr-4 py-3.5 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 transition-all outline-none text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm animate-fade-in">
                    <Shield size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Se connecter
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                  {loading && "Connexion..."}
                </button>
              </form>
            )}
          </div>

          {/* Help section */}
          <div className="mt-6 p-4 rounded-xl border border-border bg-secondary/50 animate-[fadeSlideUp_0.6s_ease-out_0.2s_both]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comptes démo</p>
            <div className="space-y-2">
              {[
                { label: "Admin", email: "admin@fco-manager.local", pass: "admin123" },
                { label: "Coach", email: "coach@fco-manager.local", pass: "coach123" },
              ].map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.pass);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-card hover:bg-primary/5 border border-border hover:border-primary/20 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <span className="text-primary text-xs font-bold">{account.label[0]}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-foreground">{account.label}</p>
                      <p className="text-[10px] text-muted-foreground">{account.email}</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 flex justify-center animate-[fadeSlideUp_0.6s_ease-out_0.3s_both]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <p className="text-[11px] text-success/70 font-medium">Connecté au serveur</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
