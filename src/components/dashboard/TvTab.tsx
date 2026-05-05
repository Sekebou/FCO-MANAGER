import { useEffect, useRef, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import Hls from "hls.js";
import {
  Tv as TvIcon, Loader2, Pencil, Trash2, X,
  Maximize2, Plus, Search, Settings, Eye, Send, MessageCircle,
  Power, PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import TvBettingPanel from "@/components/tv/TvBettingPanel";

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
  api_fixture_id?: string | null;
  lineup_cache?: any;
  bets_open?: boolean;
  bets_settled?: boolean;
}

function extractCustomerSubdomain(input: string): string | null {
  const m = input.match(/(customer-[^.\/]+)\.cloudflarestream\.com/i);
  return m ? m[1] : null;
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
function buildHlsUrl(c: Channel, signedToken: string): string | null {
  const sub = extractCustomerSubdomain(c.url);
  if (sub) return `https://${sub}.cloudflarestream.com/${signedToken}/manifest/video.m3u8`;
  return `https://videodelivery.net/${signedToken}/manifest/video.m3u8`;
}
function buildPlayerUrl(c: Channel, signedToken?: string | null): string {
  if (c.source_type === "cloudflare") {
    let base: string;
    if (signedToken) base = `https://iframe.cloudflarestream.com/${signedToken}`;
    else base = toCloudflareIframe(c.url);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}autoplay=true&muted=false&preload=true&letterboxColor=transparent`;
  }
  return c.url;
}

interface TvTabProps {
  currentUser: { uid: string; name: string; role?: string } | null;
}

const TvTab = ({ currentUser }: TvTabProps) => {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [signedToken, setSignedToken] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [viewers, setViewers] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ height: number; bitrate: number; index: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQuality, setShowQuality] = useState(false);
  const [messages, setMessages] = useState<{ id: string; user_id: string; name: string; text: string; ts: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showAllViewers, setShowAllViewers] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const myName = currentUser?.name || "Anonyme";
  const userId = currentUser?.uid || "";
  const isAdminRole = currentUser?.role === "admin" || currentUser?.role === "admin+";

  useEffect(() => {
    if (!userId) return;
    void loadAll();
  }, [userId]);

  // Poll latest channel every 20s so viewers see open/close (creation/deletion) live
  useEffect(() => {
    if (!userId) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("tv_channels").select("*")
        .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(1);
      const next = ((data as any) || [])[0] || null;
      setChannel((c) => {
        if (!c && !next) return c;
        if (c && next && c.id === next.id) return c;
        return next;
      });
    }, 20000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    if (!channel) {
      setSignedToken(null); setPlayerUrl(null); setHlsUrl(null); return;
    }
    if (channel.source_type !== "cloudflare") {
      setSignedToken(null);
      setPlayerUrl(buildPlayerUrl(channel, null));
      setHlsUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sign-stream-url", { body: { url: channel.url } });
        if (cancelled) return;
        const tok = !error && data?.token ? data.token : null;
        setSignedToken(tok);
        setPlayerUrl(buildPlayerUrl(channel, tok));
        setHlsUrl(tok ? buildHlsUrl(channel, tok) : null);
      } catch {
        if (!cancelled) {
          setSignedToken(null);
          setPlayerUrl(buildPlayerUrl(channel, null));
          setHlsUrl(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [channel?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 60, maxMaxBufferLength: 120,
        maxBufferSize: 120 * 1000 * 1000, backBufferLength: 30,
        lowLatencyMode: false, enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!hls) return;
        const lv = hls.levels.map((l, i) => ({ height: l.height || 0, bitrate: l.bitrate || 0, index: i }));
        lv.sort((a, b) => (b.height - a.height) || (b.bitrate - a.bitrate));
        setLevels(lv); setCurrentLevel(-1);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        if (hls && hls.autoLevelEnabled) setCurrentLevel(-1);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    }
    video.play().catch(() => {});
    return () => {
      if (hls) hls.destroy();
      hlsRef.current = null;
      setLevels([]); setCurrentLevel(-1);
      video.removeAttribute("src"); video.load();
    };
  }, [hlsUrl]);

  const selectQuality = (idx: number) => {
    const hls = hlsRef.current; if (!hls) return;
    hls.currentLevel = idx; setCurrentLevel(idx); setShowQuality(false);
  };

  const loadAll = async () => {
    setLoading(true);
    const [{ data: isAdminRpc }, { data: isAdminPlusRpc }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" as any }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin_plus" as any }),
    ]);
    const admin = Boolean(isAdminRpc) || Boolean(isAdminPlusRpc) || isAdminRole;
    const { data: ch } = await supabase.from("tv_channels").select("*")
      .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(1);
    setChannel(((ch as any) || [])[0] || null);
    setIsAdmin(admin);
    setLoading(false);
  };

  const closeTv = async () => {
    if (!channel || !isAdmin) return;
    if (!confirm(`Fermer la FCO TV ?\n\nLe stream « ${channel.name} » sera supprimé. Tu pourras en créer un nouveau quand tu veux.`)) return;
    setTogglingActive(true);
    const { error } = await supabase.from("tv_channels").delete().eq("id", channel.id);
    setTogglingActive(false);
    if (error) { toast.error(error.message); return; }
    toast.success("FCO TV fermée — stream supprimé");
    setChannel(null);
  };

  useEffect(() => {
    if (!channel || !userId || !myName) return;
    const ch = supabase.channel(`tv-viewers:${channel.id}`, {
      config: { presence: { key: userId }, broadcast: { self: true } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ name: string }>>;
      const list: { id: string; name: string }[] = [];
      Object.entries(state).forEach(([uid, metas]) => {
        const meta = metas[0];
        if (meta?.name) list.push({ id: uid, name: meta.name });
      });
      setViewers(list);
    });
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      setMessages((prev) => [...prev.slice(-199), payload as any]);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ name: myName });
    });
    presenceChannelRef.current = ch;
    return () => {
      presenceChannelRef.current = null;
      void supabase.removeChannel(ch);
      setMessages([]);
    };
  }, [channel?.id, userId, myName]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !presenceChannelRef.current || !userId) return;
    setChatInput("");
    await presenceChannelRef.current.send({
      type: "broadcast", event: "chat",
      payload: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId, name: myName, text: text.slice(0, 500), ts: Date.now(),
      },
    });
  };

  const goFullscreen = async () => {
    const video = videoRef.current as any;
    if (video?.webkitEnterFullscreen) {
      try { await video.play?.(); } catch {}
      try { video.webkitEnterFullscreen(); return; } catch {}
    }
    const el = playerRef.current as any;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (video?.requestFullscreen) await video.requestFullscreen();
    } catch {}
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  // No channel = TV closed. Admin sees an "Open" CTA, others see a friendly closed screen.
  if (!channel) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative max-w-md w-full text-center bg-card/70 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-lg overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-red-500/10 flex items-center justify-center">
              <PowerOff className="w-9 h-9 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">La FCO TV est actuellement fermée</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Aucun direct n'est diffusé pour le moment.<br />Reviens un peu plus tard pour ne rien manquer 📺
            </p>
            {isAdmin && (
              <button onClick={() => setShowForm(true)}
                className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition shadow-lg">
                <Power className="w-4 h-4" /> Ouvrir la FCO TV
              </button>
            )}
          </div>
        </div>
        {showForm && isAdmin && (
          <ChannelForm channel={null} onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); void loadAll(); }}
            onDeleted={() => { setShowForm(false); void loadAll(); }} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => setShowForm(true)}
            className="h-9 px-3 rounded-full bg-secondary text-foreground text-sm font-medium flex items-center gap-1.5 hover:bg-secondary/70 active:scale-95 transition">
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
          <button onClick={closeTv} disabled={togglingActive}
            className="h-9 px-3 rounded-full text-sm font-medium flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 bg-red-600/15 text-red-600 hover:bg-red-600/25">
            {togglingActive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5" />}
            <span>Fermer la TV</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
        <div className="lg:col-span-2 space-y-3 lg:space-y-4">
          {(channel.home_team || channel.away_team) && (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-primary/5 px-4 py-3 sm:px-5 sm:py-4 shadow-sm">
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                  <p className="text-xs sm:text-sm font-bold truncate text-right">{channel.home_team || "—"}</p>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-background/70 backdrop-blur flex items-center justify-center p-1 shadow-sm shrink-0">
                    {channel.home_logo ? <img src={channel.home_logo} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full rounded-lg bg-secondary" />}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5 shrink-0 px-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
                  </div>
                  <span className="text-base sm:text-lg font-black text-primary tracking-tight leading-none mt-1">VS</span>
                  {channel.match_date && <span className="text-[9px] text-muted-foreground whitespace-nowrap mt-0.5">{channel.match_date}</span>}
                </div>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-background/70 backdrop-blur flex items-center justify-center p-1 shadow-sm shrink-0">
                    {channel.away_logo ? <img src={channel.away_logo} alt="" className="w-full h-full object-contain" /> : <div className="w-full h-full rounded-lg bg-secondary" />}
                  </div>
                  <p className="text-xs sm:text-sm font-bold truncate">{channel.away_team || "—"}</p>
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 rounded-3xl blur-2xl opacity-60 pointer-events-none" />
            <div ref={playerRef} className="relative aspect-video w-full bg-black rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl [&:fullscreen]:rounded-none [&:fullscreen]:aspect-auto [&:fullscreen]:h-screen [&:-webkit-full-screen]:rounded-none [&:-webkit-full-screen]:aspect-auto [&:-webkit-full-screen]:h-screen">
              {hlsUrl ? (
                <video ref={videoRef} key={channel.id + ":" + hlsUrl} className="w-full h-full bg-black" controls playsInline autoPlay />
              ) : playerUrl ? (
                <iframe key={channel.id} src={playerUrl} title={channel.name} className="w-full h-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="eager" />
              ) : null}
              {hlsUrl && levels.length > 0 && (
                <div className="absolute top-3 left-3">
                  <button onClick={() => setShowQuality((v) => !v)}
                    className="h-9 px-3 rounded-full bg-black/55 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-black/75 active:scale-95 transition">
                    <Settings className="w-3.5 h-3.5" />
                    <span>{currentLevel === -1 ? "Auto" : `${levels.find((l) => l.index === currentLevel)?.height || ""}p`}</span>
                  </button>
                  {showQuality && (
                    <div className="mt-2 min-w-[140px] rounded-xl bg-black/80 backdrop-blur-xl text-white p-1 shadow-2xl ring-1 ring-white/10">
                      <button onClick={() => selectQuality(-1)} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 ${currentLevel === -1 ? "bg-white/10 font-semibold" : ""}`}>Auto</button>
                      {levels.map((l) => (
                        <button key={l.index} onClick={() => selectQuality(l.index)} className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 ${currentLevel === l.index ? "bg-white/10 font-semibold" : ""}`}>
                          {l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={goFullscreen}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/75 active:scale-95 transition" aria-label="Plein écran">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="relative flex items-center justify-center">
                <Eye className="w-4 h-4 text-red-600" />
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-card animate-pulse" />
              </span>
              <p className="text-sm font-bold leading-none">{viewers.length}</p>
              <p className="text-xs text-muted-foreground leading-none">
                {viewers.length > 1 ? "personnes regardent" : "personne regarde"} en direct
              </p>
            </div>
            {viewers.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {(showAllViewers ? viewers : viewers.slice(0, 5)).map((v) => (
                  <span key={v.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {v.name}
                  </span>
                ))}
                {viewers.length > 5 && (
                  <button type="button" onClick={() => setShowAllViewers((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition">
                    {showAllViewers ? "Voir moins" : `+${viewers.length - 5} voir plus`}
                  </button>
                )}
              </div>
            )}
          </div>

          <TvBettingPanel channel={channel as any} isAdmin={isAdmin} userId={userId} />

          {/* Mobile chat toggle */}
          <button onClick={() => setShowChat((v) => !v)}
            className="lg:hidden w-full h-11 rounded-2xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/70 active:scale-[0.98] transition">
            <MessageCircle className="w-4 h-4" />
            {showChat ? "Masquer le chat" : `Chat live${viewers.length ? ` · ${viewers.length} en ligne` : ""}`}
          </button>
          {showChat && (
            <div className="lg:hidden bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm flex flex-col h-[420px] overflow-hidden">
              <ChatPanel
                viewers={viewers} messages={messages} userId={userId}
                chatInput={chatInput} setChatInput={setChatInput}
                sendMessage={sendMessage} chatScrollRef={chatScrollRef}
              />
            </div>
          )}

          {channel.description && (
            <div className="hidden sm:block bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line line-clamp-3">{channel.description}</p>
            </div>
          )}
        </div>

        <aside className="hidden lg:block lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <div className="flex bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm flex-col max-h-[640px] h-[calc(100vh-12rem)] overflow-hidden">
              <ChatPanel
                viewers={viewers} messages={messages} userId={userId}
                chatInput={chatInput} setChatInput={setChatInput}
                sendMessage={sendMessage} chatScrollRef={chatScrollRef}
              />
            </div>
          </div>
        </aside>
      </div>

      {showForm && isAdmin && (
        <ChannelForm channel={channel} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void loadAll(); }}
          onDeleted={() => { setShowForm(false); void loadAll(); }} />
      )}
    </div>
  );
};

const ChatPanel = ({ viewers, messages, userId, chatInput, setChatInput, sendMessage, chatScrollRef }: any) => (
  <>
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
        <MessageCircle className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-none">Chat live</p>
        <p className="text-[11px] text-muted-foreground mt-1">{viewers.length} en ligne</p>
      </div>
    </div>
    <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
          <MessageCircle className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-xs">Sois le premier à écrire 👋</p>
        </div>
      ) : (
        messages.map((m: any) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.name}</p>}
                <p className="text-sm whitespace-pre-wrap break-words leading-snug">{m.text}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
    <form onSubmit={sendMessage} className="border-t border-border p-2 flex items-center gap-2">
      <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Écris un message…" maxLength={500}
        className="flex-1 h-11 px-4 rounded-full bg-secondary/60 border border-transparent focus:border-primary focus:bg-background outline-none text-base" />
      <button type="submit" disabled={!chatInput.trim()}
        className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition disabled:opacity-40" aria-label="Envoyer">
        <Send className="w-4 h-4" />
      </button>
    </form>
  </>
);

// ================= ADMIN FORM =================
const ChannelForm = ({ channel, onClose, onSaved, onDeleted }: {
  channel: Channel | null; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) => {
  const [name, setName] = useState(channel?.name || "FCO TV — Direct");
  const [category, setCategory] = useState(channel?.category || "");
  const FIXED_URL = "https://customer-4dsyxvu2o8gbxjxn.cloudflarestream.com/9254205cd2fbb537ed52c54b7e411082/manifest/video.m3u8?protocol=llhlsbeta";
  const sourceType: SourceType = "cloudflare";
  const url = FIXED_URL;
  const [description, setDescription] = useState(channel?.description || "");
  const [homeTeam, setHomeTeam] = useState(channel?.home_team || "");
  const [awayTeam, setAwayTeam] = useState(channel?.away_team || "");
  const [homeLogo, setHomeLogo] = useState(channel?.home_logo || "");
  const [awayLogo, setAwayLogo] = useState(channel?.away_logo || "");
  const [matchDate, setMatchDate] = useState(channel?.match_date || "");
  const [apiFixtureId, setApiFixtureId] = useState(channel?.api_fixture_id || "");
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
      name: name.trim(), category: category.trim() || null,
      source_type: sourceType, url: url.trim(),
      description: description.trim() || null,
      home_team: homeTeam.trim() || null, away_team: awayTeam.trim() || null,
      home_logo: homeLogo.trim() || null, away_logo: awayLogo.trim() || null,
      match_date: matchDate.trim() || null, api_fixture_id: apiFixtureId.trim() || null,
      is_active: channel?.is_active ?? true,
    };
    let error;
    if (channel) ({ error } = await supabase.from("tv_channels").update(payload).eq("id", channel.id));
    else ({ error } = await supabase.from("tv_channels").insert(payload));
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
    toast.success("Stream supprimé"); onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150">
      <form onSubmit={save} className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center gap-3">
          <h2 className="font-bold text-lg flex-1">{channel ? "Modifier le stream" : "Nouveau stream"}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Titre *"><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></Field>
          <Field label="Sous-titre"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Ex: Match du dimanche" /></Field>
          <div className="pt-2 border-t border-border" />
          <div className="grid grid-cols-2 gap-3">
            <TeamPicker label="Équipe domicile" team={homeTeam} logo={homeLogo} onPick={(n, l) => { setHomeTeam(n); setHomeLogo(l); }} />
            <TeamPicker label="Équipe extérieur" team={awayTeam} logo={awayLogo} onPick={(n, l) => { setAwayTeam(n); setAwayLogo(l); }} />
          </div>
          <Field label="Date du match (optionnel)">
            <input value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className={inputCls} placeholder="Ex: Dim 5 mai · 21h00" />
          </Field>
          <Field label="ID match API-Football (optionnel — pour buteurs)">
            <input value={apiFixtureId} onChange={(e) => setApiFixtureId(e.target.value)} className={inputCls} placeholder="Ex: 1234567" inputMode="numeric" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none py-3`} placeholder="Optionnel" />
          </Field>
        </div>
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border px-5 py-4 flex gap-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {channel && (
            <button type="button" onClick={remove} className="h-11 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center gap-1.5 hover:bg-destructive/15 active:scale-95 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-secondary font-medium hover:bg-secondary/70 active:scale-[0.98] transition">Annuler</button>
          <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50">
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

const TeamPicker = ({ label, team, logo, onPick }: {
  label: string; team: string; logo: string; onPick: (name: string, logo: string) => void;
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
          {logo ? <img src={logo} alt="" className="w-10 h-10 object-contain bg-background rounded-lg p-1" />
            : <div className="w-10 h-10 rounded-lg bg-background/60 flex items-center justify-center text-muted-foreground text-xs">?</div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{team || "Aucune équipe"}</p>
            <button type="button" onClick={() => { setOpen((v) => !v); setQ(""); }} className="text-xs text-primary font-medium hover:underline">
              {open ? "Annuler" : team ? "Changer" : "Rechercher…"}
            </button>
          </div>
          {team && (
            <button type="button" onClick={() => onPick("", "")} className="w-7 h-7 rounded-full hover:bg-background flex items-center justify-center text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {open && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: PSG, Real Madrid…"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" />
            </div>
            {searching && <p className="text-xs text-muted-foreground text-center py-2">Recherche…</p>}
            {!searching && results.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-1">
                {results.map((r) => (
                  <button key={r.id} type="button" onClick={() => { onPick(r.name, r.logo); setOpen(false); }}
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

export default TvTab;
