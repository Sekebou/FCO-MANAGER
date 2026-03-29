import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Coins, Zap, Gift, MessageCircle, Heart, CalendarCheck, Trophy, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export interface BetPlacementPayload {
  userId: string;
  userName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  prediction: 'home' | 'draw' | 'away';
  odds: number;
  amount: number;
  newBalance: number;
  team?: string;
}

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBetPlaced?: (bet: BetPlacementPayload) => void;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  userId: string;
  userName: string;
  team?: string;
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

const BetModal: React.FC<BetModalProps> = ({ isOpen, onClose, onBetPlaced, homeTeam, awayTeam, matchDate, homeLogo, awayLogo, userId, userName, team }) => {
  useBodyScrollLock(isOpen);
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
      const { data, error } = await supabase.rpc('place_bet', {
        p_user_id: userId,
        p_user_name: userName,
        p_match_date: matchDate,
        p_home_team: homeTeam,
        p_away_team: awayTeam,
        p_prediction: prediction,
        p_odds: selectedOdd,
        p_amount: amount,
        p_team: team || null,
      });

      if (error) {
        // Extract user-friendly message from postgres exception
        const msg = error.message || 'Erreur lors du pari';
        if (msg.includes('déjà parié')) {
          toast.error('Tu as déjà parié sur ce match !');
        } else if (msg.includes('Solde insuffisant') || msg.includes('Insufficient')) {
          toast.error('Solde insuffisant !');
        } else if (msg.includes('Mise invalide')) {
          toast.error('Mise invalide (1-500 pts)');
        } else {
          toast.error(msg);
        }
        setLoading(false);
        return;
      }

      const newBalance = typeof data === 'object' && data !== null && 'new_balance' in data
        ? Number((data as { new_balance?: number }).new_balance ?? balance - amount)
        : balance - amount;

      onBetPlaced?.({
        userId,
        userName,
        homeTeam,
        awayTeam,
        matchDate,
        prediction,
        odds: selectedOdd,
        amount,
        newBalance,
        team,
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
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border border-border shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Trophy size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Parier sur le match</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins size={12} className="text-amber-500" /> <span className="font-semibold">{balance} pts</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Match confrontation */}
          <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-center gap-3">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                {homeLogo ? (
                  <img src={homeLogo} alt="" className="w-14 h-14 rounded-full object-contain bg-card p-1 border border-border shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center text-lg font-black text-muted-foreground shadow-sm">{homeTeam.charAt(0)}</div>
                )}
                <span className="text-[11px] font-bold text-foreground leading-tight text-center line-clamp-2">{homeTeam}</span>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <span className="text-2xl font-black text-accent">VS</span>
                <span className="text-[9px] text-muted-foreground font-medium mt-0.5">{new Date(matchDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                {awayLogo ? (
                  <img src={awayLogo} alt="" className="w-14 h-14 rounded-full object-contain bg-card p-1 border border-border shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center text-lg font-black text-muted-foreground shadow-sm">{awayTeam.charAt(0)}</div>
                )}
                <span className="text-[11px] font-bold text-foreground leading-tight text-center line-clamp-2">{awayTeam}</span>
              </div>
            </div>
          </div>

          {/* Pronostic — qui va gagner ? */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-3">Qui va gagner ?</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'home' as const, label: homeTeam, odd: odds.home },
                { key: 'draw' as const, label: 'Nul', odd: odds.draw },
                { key: 'away' as const, label: awayTeam, odd: odds.away },
              ]).map(o => {
                const selected = prediction === o.key;
                return (
                  <motion.button
                    key={o.key}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPrediction(o.key)}
                    className={`relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border-2 transition-all ${
                      selected
                        ? 'border-accent bg-gradient-to-b from-accent/15 to-accent/5 shadow-lg shadow-accent/10'
                        : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary/50'
                    }`}
                  >
                    {selected && (
                      <motion.div
                        layoutId="bet-check"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-foreground"/></svg>
                      </motion.div>
                    )}
                    <span className={`text-[9px] font-semibold uppercase tracking-wide ${selected ? 'text-accent/70' : 'text-muted-foreground/60'}`}>
                      Cote
                    </span>
                    <span className={`text-2xl font-black ${selected ? 'text-accent' : 'text-foreground'}`}>
                      {o.odd}
                    </span>
                    <span className={`text-[10px] font-semibold leading-tight text-center line-clamp-2 ${selected ? 'text-accent' : 'text-muted-foreground'}`}>
                      {o.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Amount slider */}
          {prediction && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 bg-secondary/30 rounded-2xl p-4 border border-border/50">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mise</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={Math.min(balance, 500)}
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="flex-1 accent-accent h-2"
                />
                <div className="w-16 text-center text-lg font-black text-accent bg-accent/10 rounded-xl py-1.5 border border-accent/20">
                  {amount}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-medium">Gain potentiel</span>
                <span className="font-black text-accent flex items-center gap-1 text-sm">
                  <TrendingUp size={14} /> {potentialWin} pts
                </span>
              </div>
            </motion.div>
          )}

          {/* How to earn points — collapsible */}
          <details className="group">
            <summary className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none">
              <Gift size={13} className="text-amber-400" />
              <span className="font-semibold">Comment gagner des points ?</span>
              <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 p-3 bg-secondary/40 rounded-xl border border-border/50 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <CalendarCheck size={11} className="text-emerald-400 shrink-0" />
                <span><b className="text-foreground">+5 pts</b> — Répondre à un événement</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <MessageCircle size={11} className="text-blue-400 shrink-0" />
                <span><b className="text-foreground">+5 pts</b> — Commenter une actu</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Heart size={11} className="text-pink-400 shrink-0" />
                <span><b className="text-foreground">+1 pt</b> — Liker une actu</span>
              </div>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 shrink-0">
          {activeBetsCount > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Zap size={12} className="text-accent" />
              <span><b className="text-foreground">{activeBetsCount}</b> pari{activeBetsCount > 1 ? 's' : ''} en cours sur ce match</span>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-semibold hover:bg-secondary/80 transition-all text-sm">
              Annuler
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleBet}
              disabled={!prediction || amount < 1 || amount > balance || loading}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20"
            >
              {loading ? 'En cours...' : 'Valider le pari'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BetModal;
