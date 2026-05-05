import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Trophy, Target, User, Loader2, Lock, CheckCircle2, XCircle, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  channel: {
    id: string;
    home_team: string | null;
    away_team: string | null;
    home_logo: string | null;
    away_logo: string | null;
    api_fixture_id?: string | null;
    lineup_cache?: { name: string; team: string; number?: number }[] | null;
    bets_open?: boolean;
    bets_settled?: boolean;
  };
  isAdmin: boolean;
  userId: string;
}

type TvBet = {
  id: string; user_id: string; user_name: string;
  bet_type: "match" | "exact_score" | "scorer";
  prediction: string | null;
  predicted_score_home: number | null; predicted_score_away: number | null;
  scorer_name: string | null;
  odds: number; amount: number; payout: number; status: string;
};

const ODDS = { home: 2.0, draw: 3.0, away: 2.5, exact: 8.0, scorer: 5.0 } as const;

export default function TvBettingPanel({ channel, isAdmin, userId }: Props) {
  const [tab, setTab] = useState<"match" | "exact_score">("match");
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [prediction, setPrediction] = useState<"home" | "draw" | "away">("home");
  const [scoreH, setScoreH] = useState(1); const [scoreA, setScoreA] = useState(0);
  const [scorer, setScorer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bets, setBets] = useState<TvBet[]>([]);
  const [loadingLineup, setLoadingLineup] = useState(false);

  // Admin settle
  const [settleOpen, setSettleOpen] = useState(false);
  const [sH, setSH] = useState(0); const [sA, setSA] = useState(0);
  const [sScorers, setSScorers] = useState("");
  const [settling, setSettling] = useState(false);

  const home = channel.home_team || "Domicile";
  const away = channel.away_team || "Extérieur";
  const closed = channel.bets_settled || channel.bets_open === false;

  const refresh = async () => {
    const [{ data: pts }, { data: bs }] = await Promise.all([
      supabase.from("user_points").select("balance").eq("user_id", userId).maybeSingle(),
      supabase.from("tv_bets").select("*").eq("channel_id", channel.id).order("created_at", { ascending: false }),
    ]);
    setBalance((pts as any)?.balance ?? 100);
    setBets((bs as any) || []);
  };

  useEffect(() => { void refresh(); }, [channel.id]);

  const fetchLineup = async () => {
    if (!channel.api_fixture_id) {
      toast.error("Aucun ID match API configuré"); return;
    }
    setLoadingLineup(true);
    const { data, error } = await supabase.functions.invoke("tv-fixture-lineup", {
      body: { fixture_id: channel.api_fixture_id, channel_id: channel.id },
    });
    setLoadingLineup(false);
    if (error || !data?.count) { toast.error("Compo non disponible"); return; }
    toast.success(`${data.count} joueurs chargés`);
    // reload channel cache
    const { data: ch } = await supabase.from("tv_channels").select("lineup_cache").eq("id", channel.id).maybeSingle();
    if (ch) (channel as any).lineup_cache = (ch as any).lineup_cache;
  };

  const placeBet = async () => {
    if (closed) { toast.error("Paris fermés"); return; }
    if (amount < 1 || amount > 500) { toast.error("Mise 1-500"); return; }
    setSubmitting(true);
    const payload: any = { p_channel_id: channel.id, p_bet_type: tab, p_amount: amount,
      p_prediction: null, p_predicted_score_home: null, p_predicted_score_away: null, p_scorer_name: null };
    if (tab === "match") payload.p_prediction = prediction;
    else if (tab === "exact_score") { payload.p_predicted_score_home = scoreH; payload.p_predicted_score_away = scoreA; }
    const { data, error } = await supabase.rpc("place_tv_bet", payload);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pari placé ! Cote ${(data as any)?.odds}`);
    setScorer("");
    void refresh();
  };

  const settle = async () => {
    setSettling(true);
    const scorers = sScorers.split(",").map(s => s.trim()).filter(Boolean);
    const { data, error } = await supabase.rpc("settle_tv_bets", {
      p_channel_id: channel.id, p_home_score: sH, p_away_score: sA, p_scorer_names: scorers,
    });
    setSettling(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${(data as any)?.settled || 0} paris réglés`);
    setSettleOpen(false);
    void refresh();
  };

  const myBets = bets.filter(b => b.user_id === userId);
  const lineup = (channel.lineup_cache || []) as { name: string; team: string; number?: number }[];

  return (
    <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-none">Paris FCO TV</p>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">
            {closed ? "Paris fermés" : "Place ton pari live"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
          <Coins className="w-3.5 h-3.5" />
          {balance ?? "—"}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-secondary/30">
        {([
          { k: "match", label: "Vainqueur", icon: Trophy },
          { k: "exact_score", label: "Score", icon: Target },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition ${
              tab === t.k ? "text-primary border-b-2 border-primary bg-background" : "text-muted-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {closed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5" /> {channel.bets_settled ? "Paris réglés" : "Paris fermés par l'admin"}
          </div>
        )}

        {/* MATCH */}
        {tab === "match" && (
          <div className="grid grid-cols-3 gap-2">
            {([
              { k: "home", label: home, odd: ODDS.home },
              { k: "draw", label: "Nul", odd: ODDS.draw },
              { k: "away", label: away, odd: ODDS.away },
            ] as const).map(o => (
              <button key={o.k} type="button" disabled={closed}
                onClick={() => setPrediction(o.k)}
                className={`rounded-xl border px-2 py-3 text-center transition ${
                  prediction === o.k ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-secondary/50"
                } disabled:opacity-50`}>
                <p className="text-[11px] font-medium truncate">{o.label}</p>
                <p className="text-base font-bold text-primary mt-0.5">{o.odd.toFixed(2)}</p>
              </button>
            ))}
          </div>
        )}

        {/* SCORE EXACT */}
        {tab === "exact_score" && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3">
              <NumStepper value={scoreH} onChange={setScoreH} disabled={closed} label={home} />
              <span className="text-2xl font-black text-muted-foreground">–</span>
              <NumStepper value={scoreA} onChange={setScoreA} disabled={closed} label={away} />
            </div>
            <p className="text-center text-xs text-muted-foreground">Cote fixe : <span className="font-bold text-primary">{ODDS.exact.toFixed(2)}</span></p>
          </div>
        )}


        {/* MISE */}
        {!closed && (
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 h-11">
              <Coins className="w-4 h-4 text-amber-500" />
              <input type="number" min={1} max={500} value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="flex-1 bg-transparent outline-none text-base font-semibold" inputMode="numeric" />
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
            <button onClick={placeBet} disabled={submitting || amount < 1}
              className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Parier"}
            </button>
          </div>
        )}

        {/* MES PARIS */}
        {myBets.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mes paris</p>
            {myBets.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2 text-xs bg-secondary/40 rounded-lg px-2.5 py-1.5">
                <span className="truncate">{describeBet(b)}</span>
                <span className={`font-bold ${b.status === "won" ? "text-emerald-600" : b.status === "lost" ? "text-red-500" : "text-muted-foreground"}`}>
                  {b.status === "won" ? `+${b.payout}` : b.status === "lost" ? "Perdu" : `${b.amount}×${b.odds}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ADMIN */}
        {isAdmin && (
          <div className="pt-2 border-t border-border">
            {!settleOpen ? (
              <button onClick={() => setSettleOpen(true)}
                className="w-full h-9 rounded-xl bg-amber-500/15 text-amber-600 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-500/25 transition">
                <Settings2 className="w-3.5 h-3.5" /> {channel.bets_settled ? "Déjà réglé" : "Régler manuellement"}
              </button>
            ) : (
              <div className="space-y-2 bg-secondary/40 rounded-xl p-3">
                <p className="text-xs font-bold">Score final</p>
                <div className="flex items-center justify-center gap-2">
                  <NumStepper value={sH} onChange={setSH} label={home} />
                  <span className="text-xl font-black">–</span>
                  <NumStepper value={sA} onChange={setSA} label={away} />
                </div>
                <p className="text-xs font-bold mt-2">Buteurs (séparés par virgule)</p>
                <input value={sScorers} onChange={(e) => setSScorers(e.target.value)}
                  placeholder="ex: Mbappé, Dembélé"
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary" />
                <div className="flex gap-2">
                  <button onClick={() => setSettleOpen(false)} className="flex-1 h-9 rounded-lg bg-background text-xs font-medium border border-border">Annuler</button>
                  <button onClick={settle} disabled={settling}
                    className="flex-1 h-9 rounded-lg bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {settling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Régler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function describeBet(b: TvBet): string {
  if (b.bet_type === "match") return `Vainqueur → ${b.prediction === "home" ? "Dom." : b.prediction === "away" ? "Ext." : "Nul"}`;
  if (b.bet_type === "exact_score") return `Score ${b.predicted_score_home}-${b.predicted_score_away}`;
  return `Buteur: ${b.scorer_name}`;
}

function NumStepper({ value, onChange, disabled, label }: { value: number; onChange: (n: number) => void; disabled?: boolean; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center bg-background border border-border rounded-xl overflow-hidden">
        <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-10 text-lg font-bold text-muted-foreground hover:bg-secondary disabled:opacity-30">−</button>
        <span className="w-10 text-center text-lg font-black">{value}</span>
        <button type="button" disabled={disabled || value >= 9} onClick={() => onChange(Math.min(9, value + 1))}
          className="w-9 h-10 text-lg font-bold text-muted-foreground hover:bg-secondary disabled:opacity-30">+</button>
      </div>
      {label && <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{label}</p>}
    </div>
  );
}
