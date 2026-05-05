import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins } from "lucide-react";

interface Props {
  channelId: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
}

type TvBet = {
  id: string;
  user_id: string;
  user_name: string;
  bet_type: "match" | "exact_score" | "scorer";
  prediction: string | null;
  predicted_score_home: number | null;
  predicted_score_away: number | null;
  scorer_name: string | null;
  amount: number;
  odds: number;
};

function describe(b: TvBet, home?: string | null, away?: string | null) {
  if (b.bet_type === "match") {
    const lbl = b.prediction === "home" ? (home || "Dom.") : b.prediction === "away" ? (away || "Ext.") : "Nul";
    return `${lbl}`;
  }
  if (b.bet_type === "exact_score") return `${b.predicted_score_home}-${b.predicted_score_away}`;
  return b.scorer_name || "Buteur";
}

export default function TvBettorsCard({ channelId, homeTeam, awayTeam }: Props) {
  const [bets, setBets] = useState<TvBet[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("tv_bets")
        .select("id,user_id,user_name,bet_type,prediction,predicted_score_home,predicted_score_away,scorer_name,amount,odds")
        .eq("channel_id", channelId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (mounted) setBets((data as any) || []);
    };
    void load();

    const ch = supabase
      .channel(`tv-bettors:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_bets", filter: `channel_id=eq.${channelId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [channelId]);

  if (bets.length === 0) return null;

  const total = bets.reduce((s, b) => s + b.amount, 0);
  const visible = showAll ? bets : bets.slice(0, 5);

  return (
    <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="relative flex items-center justify-center">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card animate-pulse" />
        </span>
        <p className="text-sm font-bold leading-none">{bets.length}</p>
        <p className="text-xs text-muted-foreground leading-none">
          {bets.length > 1 ? "paris en cours" : "pari en cours"} · {total} pts
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {visible.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] font-medium"
          >
            <span className="font-semibold truncate max-w-[110px]">{b.user_name}</span>
            <span className="text-muted-foreground">a parié</span>
            <span className="font-bold text-amber-600">{b.amount}</span>
            <span className="text-muted-foreground">sur</span>
            <span className="font-semibold truncate max-w-[90px]">{describe(b, homeTeam, awayTeam)}</span>
          </span>
        ))}
        {bets.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition"
          >
            {showAll ? "Voir moins" : `+${bets.length - 5} voir plus`}
          </button>
        )}
      </div>
    </div>
  );
}
