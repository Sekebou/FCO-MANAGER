import { useEffect, useRef, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import Hls from "hls.js";
import {
  Tv as TvIcon, Lock, Mail, Loader2, LogOut, Pencil, Trash2, X,
  Maximize2, Radio, Plus, Search, Calendar,
} from "lucide-react";
import clubLogo from "@/assets/logo.png";
import { toast } from "sonner";

type SourceType = "cloudflare" | "iframe" | "m3u8";

interface Channel {
  id: string;
  name: string;
  category: string | null;
  source_type: SourceType;
  url: string;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number | null;
  home_team: string | null;
  away_team: string | null;
  home_logo: string | null;
  away_logo: string | null;
  match_date: string | null;
}

function toCloudflareIframe(input: string): string {
  const v = input.trim();
  if (/\/iframe(\?|$)/i.test(v)) return v;
  const cust = v.match(/https?:\/\/(customer-[^/]+)\.cloudflarestream\.com\/([^/?#]+)/i);
  if (cust) return `https://${cust[1]}.cloudflarestream.com/${cust[2]}/iframe`;
  const generic = v.match(/https?:\/\/(?:iframe|watch|videodelivery\.net|[^.]+\.cloudflarestream\.com)\/([^/?#]+)/i);
  if (generic) return `https://iframe.cloudflarestream.com/${generic[1]}`;
  if (/^[a-f0-9]{20,}$/i.test(v)) return `https://iframe.cloudflarestream.com/${v}`;
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)) {
    return `https://iframe.cloudflarestream.com/${v}`;
  }
  return v;
}

function buildPlayerUrl(c: Channel, signedToken?: string | null): string {
  if (c.source_type === "cloudflare") {
    let base: string;
    if (signedToken) {
      base = `https://iframe.cloudflarestream.com/${signedToken}`;
    } else {
      base = toCloudflareIframe(c.url);
    }
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}autoplay=true&muted=false&preload=true&letterboxColor=transparent`;
  }
  return c.url;
}

const Tv = () => {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [signedToken, setSignedToken] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);

  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setChannel(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    void loadAll();
  }, [session?.user?.id]);

  // Fetch signed token once per channel; no periodic refresh to avoid iframe reload (freeze)
  useEffect(() => {
    if (!channel) {
      setSignedToken(null);
      setPlayerUrl(null);
      return;
    }
    if (channel.source_type !== "cloudflare") {
      setSignedToken(null);
      setPlayerUrl(buildPlayerUrl(channel, null));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sign-stream-url", {
          body: { url: channel.url },
        });
        if (cancelled) return;
        const tok = !error && data?.token ? data.token : null;
        setSignedToken(tok);
        setPlayerUrl(buildPlayerUrl(channel, tok));
      } catch (e) {
        console.error("sign-stream-url invoke error", e);
        if (!cancelled) {
          setSignedToken(null);
          setPlayerUrl(buildPlayerUrl(channel, null));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [channel?.id]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: ch }, { data: isAdminRpc }, { data: isAdminPlusRpc }] = await Promise.all([
      supabase.from("tv_channels").select("*").eq("is_active", true)
        .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(1),
      supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" as any }),
      supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin_plus" as any }),
    ]);
    setChannel(((ch as any) || [])[0] || null);
    setIsAdmin(Boolean(isAdminRpc) || Boolean(isAdminPlusRpc));
    setLoading(false);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthError("Identifiants incorrects");
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const goFullscreen = () => {
    const el = playerRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  };

  // ============== AUTH GATE ==============
  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={clubLogo} alt="FCO-Manager" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
              <Radio className="w-3 h-3" /> FCO TV
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Connexion requise</h1>
            <p className="text-muted-foreground mt-2 text-sm">Accès réservé aux membres FCO-Manager</p>
          </div>
          <form onSubmit={handleLogin} className="bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" required placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors" />
            </div>
            {authError && <p className="text-destructive text-sm text-center">{authError}</p>}
            <button type="submit" disabled={authLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50">
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Se connecter</>}
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-6">© FCO-Manager · TV</p>
        </div>
      </div>
    );
  }

  // ============== APP — single immersive stream ==============
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/60" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TvIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-none">FCO TV</h1>
            <p className="text-xs text-muted-foreground leading-none mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> En direct
              </span>
            </p>
          </div>
          {isAdmin && channel && (
            <button onClick={() => setShowForm(true)}
              className="h-9 px-3 rounded-full bg-secondary text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-secondary/70 active:scale-95 transition">
              <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Modifier</span>
            </button>
          )}
          {isAdmin && !channel && (
            <button onClick={() => setShowForm(true)}
              className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          )}
          <button onClick={handleLogout}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 active:scale-95 transition" aria-label="Se déconnecter">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {loading ? (
          <div className="flex justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : !channel ? (
          <div className="text-center py-32">
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-secondary flex items-center justify-center">
              <TvIcon className="w-9 h-9 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">Aucun stream en direct</p>
            <p className="text-sm text-muted-foreground mt-1">Reviens un peu plus tard.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Match poster */}
            {(channel.home_team || channel.away_team) && (
              <div className="bg-gradient-to-br from-primary/10 via-card to-primary/5 border border-border rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    {channel.home_logo ? (
                      <img src={channel.home_logo} alt={channel.home_team || ""} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
                    ) : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary" />}
                    <p className="text-xs sm:text-sm font-bold text-center truncate w-full">{channel.home_team || "—"}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">VS</span>
                    {channel.match_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {channel.match_date}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    {channel.away_logo ? (
                      <img src={channel.away_logo} alt={channel.away_team || ""} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
                    ) : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary" />}
                    <p className="text-xs sm:text-sm font-bold text-center truncate w-full">{channel.away_team || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Player */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 rounded-3xl blur-2xl opacity-60 pointer-events-none" />
              <div ref={playerRef} className="relative aspect-video w-full bg-black rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                {playerUrl && (
                  <iframe
                    key={channel.id}
                    src={playerUrl}
                    title={channel.name}
                    className="w-full h-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    loading="eager"
                  />
                )}
                <button onClick={goFullscreen}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/75 active:scale-95 transition"
                  aria-label="Plein écran">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold tracking-wide shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{channel.name}</h2>
                  {channel.category && (
                    <p className="text-sm text-muted-foreground mt-0.5">{channel.category}</p>
                  )}
                </div>
              </div>
              {channel.description && (
                <p className="mt-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{channel.description}</p>
              )}
            </div>
          </div>
        )}
      </main>

      {showForm && isAdmin && (
        <ChannelForm
          channel={channel}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void loadAll(); }}
          onDeleted={() => { setShowForm(false); void loadAll(); }}
        />
      )}
    </div>
  );
};

// ================= ADMIN FORM =================
const ChannelForm = ({ channel, onClose, onSaved, onDeleted }: {
  channel: Channel | null; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) => {
  const [name, setName] = useState(channel?.name || "FCO TV — Direct");
  const [category, setCategory] = useState(channel?.category || "");
  const [sourceType, setSourceType] = useState<SourceType>(channel?.source_type || "cloudflare");
  const [url, setUrl] = useState(channel?.url || "");
  const [description, setDescription] = useState(channel?.description || "");
  const [homeTeam, setHomeTeam] = useState(channel?.home_team || "");
  const [awayTeam, setAwayTeam] = useState(channel?.away_team || "");
  const [homeLogo, setHomeLogo] = useState(channel?.home_logo || "");
  const [awayLogo, setAwayLogo] = useState(channel?.away_logo || "");
  const [matchDate, setMatchDate] = useState(channel?.match_date || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      source_type: sourceType,
      url: url.trim(),
      description: description.trim() || null,
      home_team: homeTeam.trim() || null,
      away_team: awayTeam.trim() || null,
      home_logo: homeLogo.trim() || null,
      away_logo: awayLogo.trim() || null,
      match_date: matchDate.trim() || null,
      is_active: true,
    };
    let error;
    if (channel) {
      ({ error } = await supabase.from("tv_channels").update(payload).eq("id", channel.id));
    } else {
      ({ error } = await supabase.from("tv_channels").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erreur : " + error.message); return; }
    toast.success(channel ? "Stream mis à jour" : "Stream ajouté");
    onSaved();
  };

  const remove = async () => {
    if (!channel) return;
    if (!confirm(`Supprimer le stream "${channel.name}" ?`)) return;
    const { error } = await supabase.from("tv_channels").delete().eq("id", channel.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stream supprimé");
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150">
      <form onSubmit={save}
        className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center gap-3">
          <h2 className="font-bold text-lg flex-1">{channel ? "Modifier le stream" : "Nouveau stream"}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Titre *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Sous-titre">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Ex: Match du dimanche" />
          </Field>
          <Field label="Type de source">
            <div className="grid grid-cols-3 gap-2">
              {(["cloudflare", "iframe", "m3u8"] as SourceType[]).map((t) => (
                <button key={t} type="button" onClick={() => setSourceType(t)}
                  className={`h-11 rounded-xl text-sm font-medium transition ${
                    sourceType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}>
                  {t === "cloudflare" ? "Cloudflare" : t === "iframe" ? "Iframe" : "HLS"}
                </button>
              ))}
            </div>
          </Field>
          <Field label={sourceType === "cloudflare" ? "URL / UID / Token Cloudflare *" : "URL *"}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} required className={inputCls}
              placeholder={sourceType === "cloudflare" ? "UID, token signé, ou URL customer-xxx" : "https://…"} />
            {sourceType === "cloudflare" && (
              <p className="text-xs text-muted-foreground mt-1.5">Accepte UID, token signé (JWT), URL customer-xxx ou /iframe.</p>
            )}
          </Field>
          <div className="pt-2 border-t border-border" />
          <div className="grid grid-cols-2 gap-3">
            <TeamPicker label="Équipe domicile" team={homeTeam} logo={homeLogo}
              onPick={(n, l) => { setHomeTeam(n); setHomeLogo(l); }} />
            <TeamPicker label="Équipe extérieur" team={awayTeam} logo={awayLogo}
              onPick={(n, l) => { setAwayTeam(n); setAwayLogo(l); }} />
          </div>
          <Field label="Date du match (optionnel)">
            <input value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className={inputCls}
              placeholder="Ex: Dim 5 mai · 21h00" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className={`${inputCls} resize-none py-3`} placeholder="Optionnel" />
          </Field>
        </div>
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border px-5 py-4 flex gap-2"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {channel && (
            <button type="button" onClick={remove}
              className="h-11 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center gap-1.5 hover:bg-destructive/15 active:scale-95 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-secondary font-medium hover:bg-secondary/70 active:scale-[0.98] transition">
            Annuler
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : channel ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
};

const inputCls = "w-full h-11 px-4 rounded-xl bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base transition-colors";

const Field = ({ label, children }: { label: string; children: any }) => (
  <div>
    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

// ================= TEAM PICKER =================
const TeamPicker = ({ label, team, logo, onPick }: {
  label: string; team: string; logo: string;
  onPick: (name: string, logo: string) => void;
}) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ id: number; name: string; country: string; logo: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.functions.invoke("search-team-logo", { body: { search: q.trim() } });
      setSearching(false);
      if (error) { toast.error("Erreur recherche"); return; }
      setResults((data?.teams as any[]) || []);
    }, 350);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="bg-secondary/60 border border-transparent rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          {logo ? (
            <img src={logo} alt="" className="w-10 h-10 object-contain bg-background rounded-lg p-1" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-background/60 flex items-center justify-center text-muted-foreground text-xs">?</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{team || "Aucune équipe"}</p>
            <button type="button" onClick={() => { setOpen((v) => !v); setQ(""); }}
              className="text-xs text-primary font-medium hover:underline">
              {open ? "Annuler" : team ? "Changer" : "Rechercher…"}
            </button>
          </div>
          {team && (
            <button type="button" onClick={() => onPick("", "")}
              className="w-7 h-7 rounded-full hover:bg-background flex items-center justify-center text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {open && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Ex: PSG, Real Madrid…"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" />
            </div>
            {searching && <p className="text-xs text-muted-foreground text-center py-2">Recherche…</p>}
            {!searching && results.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-1">
                {results.map((r) => (
                  <button key={r.id} type="button"
                    onClick={() => { onPick(r.name, r.logo); setOpen(false); }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-background text-left transition">
                    <img src={r.logo} alt="" className="w-8 h-8 object-contain shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.country}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!searching && q.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Aucun résultat</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tv;
