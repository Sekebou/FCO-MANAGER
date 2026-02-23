import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Coins, Zap, Gift, MessageCircle, Heart, CalendarCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  userId: string;
  userName: string;
}

/** Generate odds based on standings positions.
 * homeRank / awayRank: position in standings (1 = first). 
 * If not provided, falls back to deterministic hash. 
 * Lower rank = stronger team = lower odds for their win. */
function generateOdds(homeTeam: string, awayTeam: string, matchDate: string, homeRank?: number, awayRank?: number, totalTeams?: number): { home: number; draw: number; away: number } {
  const total = totalTeams || 12;
  
  if (homeRank && awayRank) {
    // Normalize ranks: 0 = best, 1 = worst
    const homeStrength = 1 - ((homeRank - 1) / (total - 1));
    const awayStrength = 1 - ((awayRank - 1) / (total - 1));
    
    // Home advantage + strength difference
    const homePower = homeStrength + 0.1; // slight home advantage
    const awayPower = awayStrength;
    const totalPower = homePower + awayPower;
    
    // Convert to probabilities (with draw share)
    const drawBase = 0.22;
    const homeProb = (homePower / totalPower) * (1 - drawBase);
    const awayProb = (awayPower / totalPower) * (1 - drawBase);
    
    // Convert probabilities to odds (with ~10% margin)
    const margin = 1.10;
    const homeOdd = Math.max(1.15, Math.min(8.0, margin / homeProb));
    const drawOdd = Math.max(2.5, Math.min(6.0, margin / drawBase));
    const awayOdd = Math.max(1.15, Math.min(8.0, margin / awayProb));
    
    return {
      home: Math.round(homeOdd * 100) / 100,
      draw: Math.round(drawOdd * 100) / 100,
      away: Math.round(awayOdd * 100) / 100,
    };
  }
  
  // Fallback: deterministic hash
  let hash = 0;
  const str = `${homeTeam}-${awayTeam}-${matchDate}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const homeOdd = 1.5 + ((abs % 35) / 10);
  const drawOdd = 2.0 + (((abs >> 8) % 30) / 10);
  const awayOdd = 1.5 + (((abs >> 16) % 35) / 10);
  return {
    home: Math.round(homeOdd * 100) / 100,
    draw: Math.round(drawOdd * 100) / 100,
    away: Math.round(awayOdd * 100) / 100,
  };
}

export { generateOdds };

const BetModal: React.FC<BetModalProps> = ({ isOpen, onClose, homeTeam, awayTeam, matchDate, homeLogo, awayLogo, userId, userName }) => {
  const [prediction, setPrediction] = useState<'home' | 'draw' | 'away' | null>(null);
  const [amount, setAmount] = useState(10);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeBetsCount, setActiveBetsCount] = useState(0);

  const odds = generateOdds(homeTeam, awayTeam, matchDate);

  useEffect(() => {
    if (!isOpen || !userId) return;
    const fetchData = async () => {
      const [{ data: pointsData }, { data: betsData }] = await Promise.all([
        supabase.from('user_points').select('balance').eq('user_id', userId).maybeSingle(),
        supabase.from('bets').select('id').eq('home_team', homeTeam).eq('away_team', awayTeam).eq('match_date', matchDate).eq('status', 'pending'),
      ]);
      if (pointsData) {
        setBalance(pointsData.balance);
      } else {
        await supabase.from('user_points').insert({ user_id: userId, balance: 100 });
        setBalance(100);
      }
      setActiveBetsCount(betsData?.length || 0);
    };
    fetchData();
  }, [isOpen, userId, homeTeam, awayTeam, matchDate]);

  const selectedOdd = prediction === 'home' ? odds.home : prediction === 'draw' ? odds.draw : prediction === 'away' ? odds.away : 0;
  const potentialWin = Math.round(amount * selectedOdd);

  const handleBet = async () => {
    if (!prediction || amount < 1 || amount > balance) return;
    setLoading(true);
    try {
      // Check existing bet on same match
      const { data: existing } = await supabase.from('bets')
        .select('id')
        .eq('user_id', userId)
        .eq('match_date', matchDate)
        .eq('home_team', homeTeam)
        .eq('away_team', awayTeam)
        .maybeSingle();
      
      if (existing) {
        toast.error('Tu as déjà parié sur ce match !');
        setLoading(false);
        return;
      }

      // Insert bet
      const { error: betError } = await supabase.from('bets').insert({
        user_id: userId,
        user_name: userName,
        match_date: matchDate,
        home_team: homeTeam,
        away_team: awayTeam,
        prediction,
        odds: selectedOdd,
        amount,
      });
      if (betError) throw betError;

      // Deduct points
      const newBalance = balance - amount;
      const { error: pointsError } = await supabase.from('user_points')
        .update({ balance: newBalance, total_bet: balance - newBalance + amount, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (pointsError) throw pointsError;

      // Log transaction
      await supabase.from('points_transactions').insert({
        user_id: userId,
        amount: -amount,
        type: 'bet',
        description: `Pari: ${homeTeam} vs ${awayTeam} — ${prediction === 'home' ? '1' : prediction === 'draw' ? 'N' : '2'} (cote ${selectedOdd})`,
      });

      toast.success(`Pari de ${amount} pts placé ! Gain potentiel: ${potentialWin} pts`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du pari');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border border-border shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Parier</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins size={12} /> <span>{balance} pts disponibles</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Match */}
          <div className="flex items-center justify-center gap-3">
            {homeLogo ? <img src={homeLogo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{homeTeam.charAt(0)}</div>}
            <span className="text-xs font-black text-muted-foreground">VS</span>
            {awayLogo ? <img src={awayLogo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{awayTeam.charAt(0)}</div>}
          </div>

          {/* Odds buttons */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'home' as const, label: '1', sublabel: homeTeam, odd: odds.home },
              { key: 'draw' as const, label: 'N', sublabel: 'Nul', odd: odds.draw },
              { key: 'away' as const, label: '2', sublabel: awayTeam, odd: odds.away },
            ]).map(o => (
              <button
                key={o.key}
                onClick={() => setPrediction(o.key)}
                className={`py-3 px-2 rounded-xl border-2 transition-all text-center ${
                  prediction === o.key
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-border hover:border-accent/30 bg-secondary/50'
                }`}
              >
                <div className="text-lg font-black text-foreground">{o.odd}</div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-accent/60 mb-0.5">Cote</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">{o.sublabel}</div>
              </button>
            ))}
          </div>

          {/* Amount */}
          {prediction && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mise (pts)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={Math.min(balance, 500)}
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <div className="w-16 text-center text-lg font-black text-accent bg-accent/10 rounded-xl py-1">
                  {amount}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gain potentiel</span>
                <span className="font-black text-accent flex items-center gap-1">
                  <TrendingUp size={12} /> {potentialWin} pts
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* How to earn points */}
        <div className="mx-5 mb-3 p-3 bg-secondary/60 rounded-xl border border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Gift size={13} className="text-amber-400" />
            <span className="text-[11px] font-bold text-foreground">Gagner des points</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <CalendarCheck size={11} className="text-emerald-400 shrink-0" />
              <span><b className="text-foreground">+5 pts</b> — Répondre présent ou absent à un événement</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <MessageCircle size={11} className="text-blue-400 shrink-0" />
              <span><b className="text-foreground">+5 pts</b> — Commenter une actualité</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Heart size={11} className="text-pink-400 shrink-0" />
              <span><b className="text-foreground">+1 pt</b> — Liker une actualité</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Sparkles size={11} className="text-amber-400 shrink-0" />
              <span><b className="text-foreground">+1 pt/jour</b> — Bonus quotidien automatique (30/mois)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3">
          {activeBetsCount > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Zap size={12} className="text-accent" />
              <span><b className="text-foreground">{activeBetsCount}</b> pari{activeBetsCount > 1 ? 's' : ''} en cours sur ce match</span>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">
              Annuler
            </button>
            <button
              onClick={handleBet}
              disabled={!prediction || amount < 1 || amount > balance || loading}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20"
            >
              {loading ? 'En cours...' : 'Valider le pari'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BetModal;
