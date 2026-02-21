import React, { useEffect, useState } from 'react';
import { Trophy, Coins, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  balance: number;
  total_won: number;
  total_bet: number;
}

const BetLeaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Get top bettors by total_won
      const { data: points } = await supabase.from('user_points').select('user_id, balance, total_won, total_bet').order('total_won', { ascending: false }).limit(10);
      if (!points || points.length === 0) { setLoading(false); return; }

      // Get names from bets table
      const userIds = points.map(p => p.user_id);
      const { data: bets } = await supabase.from('bets').select('user_id, user_name').in('user_id', userIds);
      const nameMap: Record<string, string> = {};
      bets?.forEach(b => { if (!nameMap[b.user_id]) nameMap[b.user_id] = b.user_name; });

      setEntries(points.map(p => ({
        ...p,
        user_name: nameMap[p.user_id] || 'Joueur',
      })));
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading || entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
        <div className="w-9 h-9 bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 rounded-xl flex items-center justify-center">
          <Trophy size={17} className="text-yellow-600" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm">Classement Parieurs</h3>
          <p className="text-[11px] text-muted-foreground">Top 10 meilleurs parieurs</p>
        </div>
      </div>
      <div className="divide-y divide-border/20">
        {entries.map((e, i) => (
          <div key={e.user_id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
            <span className={`text-sm font-black w-6 text-center ${i < 3 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <span className="text-xs font-semibold text-foreground flex-1 truncate">{e.user_name}</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Coins size={11} /> {e.balance}
              </span>
              <span className="flex items-center gap-1 font-bold text-emerald-600">
                <TrendingUp size={11} /> +{e.total_won}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default BetLeaderboard;
