import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Coins, TrendingUp, Clock, CheckCircle2, XCircle, Filter, Ticket, BarChart3, Flame, ChevronDown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser } from '@/contexts/AuthContext';
import type { Championship, Match } from './ChampionnatTab';
import BetModal, { generateOdds } from './BetModal';
import BetLeaderboard from './BetLeaderboard';

interface Bet {
  id: string;
  userId: string;
  userName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  prediction: string;
  odds: number;
  amount: number;
  payout: number;
  status: string;
  createdAt: string;
}

interface Props {
  currentUser: AppUser | null;
  championships: Championship[];
  matches: Match[];
}

const mapBet = (r: any): Bet => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name,
  homeTeam: r.home_team,
  awayTeam: r.away_team,
  matchDate: r.match_date,
  prediction: r.prediction,
  odds: r.odds,
  amount: r.amount,
  payout: r.payout,
  status: r.status,
  createdAt: r.created_at,
});

type TabFilter = 'upcoming' | 'my-bets' | 'leaderboard';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  pending: { icon: Clock, label: 'En cours', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  won: { icon: CheckCircle2, label: 'Gagné', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  lost: { icon: XCircle, label: 'Perdu', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const ParisTab: React.FC<Props> = ({ currentUser, championships, matches }) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [balance, setBalance] = useState(100);
  const [activeFilter, setActiveFilter] = useState<TabFilter>('upcoming');
  const [betModal, setBetModal] = useState<{ home: string; away: string; date: string; homeLogo?: string; awayLogo?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      const [{ data: betsData }, { data: pointsData }] = await Promise.all([
        supabase.from('bets').select('*').order('created_at', { ascending: false }),
        supabase.from('user_points').select('balance').eq('user_id', currentUser.uid).maybeSingle(),
      ]);
      if (betsData) setBets(betsData.map(mapBet));
      if (pointsData) setBalance(pointsData.balance);
      else setBalance(100);
      setLoading(false);
    };
    fetchData();

    const channel = supabase.channel('paris-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        supabase.from('bets').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setBets(data.map(mapBet)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_points', filter: `user_id=eq.${currentUser.uid}` }, (payload: any) => {
        if (typeof payload.new?.balance === 'number') setBalance(payload.new.balance);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Upcoming matches that can be bet on (string comparison to avoid timezone issues)
  const upcomingMatches = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    return matches
      .filter(m => !m.played && m.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20);
  }, [matches]);

  // Get team logo from championship data
  const getTeamLogo = (teamName: string) => {
    for (const champ of championships) {
      const logos = champ.teamLogos as Record<string, string> | undefined;
      if (logos?.[teamName]) return logos[teamName];
    }
    return null;
  };

  const myBets = useMemo(() => bets.filter(b => b.userId === currentUser?.uid), [bets, currentUser]);
  const myPendingBets = myBets.filter(b => b.status === 'pending');
  const myWonBets = myBets.filter(b => b.status === 'won');
  const myLostBets = myBets.filter(b => b.status === 'lost');

  // Check if user already bet on a match
  const hasBetOnMatch = (homeTeam: string, awayTeam: string, matchDate: string) =>
    myBets.some(b => b.homeTeam === homeTeam && b.awayTeam === awayTeam && b.matchDate === matchDate);

  const filters: { id: TabFilter; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'upcoming', label: 'Matchs', icon: Flame },
    { id: 'my-bets', label: 'Mes Paris', icon: Ticket, count: myPendingBets.length },
    { id: 'leaderboard', label: 'Classement', icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <Ticket className="text-accent" size={18} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Paris</h2>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          <Coins size={16} className="text-amber-500" />
          <span className="text-sm font-black text-amber-500">{balance}</span>
          <span className="text-[10px] text-amber-500/70 font-medium">pts</span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-lg font-black text-foreground">{myBets.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Total Paris</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-lg font-black text-emerald-500">{myWonBets.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Gagnés</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="text-lg font-black text-destructive">{myLostBets.length}</div>
          <div className="text-[10px] text-muted-foreground font-medium">Perdus</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-secondary/50 rounded-xl p-1 border border-border/50">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === f.id
                ? 'bg-card text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <f.icon size={14} />
            <span>{f.label}</span>
            {f.count !== undefined && f.count > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeFilter === 'upcoming' && (
          <motion.div key="upcoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
            {upcomingMatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flame size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun match à venir</p>
                <p className="text-xs mt-1">Les matchs du championnat apparaîtront ici</p>
              </div>
            ) : (
              upcomingMatches.map(match => {
                const alreadyBet = hasBetOnMatch(match.homeTeam, match.awayTeam, match.date);
                const homeLogo = getTeamLogo(match.homeTeam);
                const awayLogo = getTeamLogo(match.awayTeam);
                const odds = generateOdds(match.homeTeam, match.awayTeam, match.date);
                const matchDate = new Date(match.date);
                
                return (
                  <motion.div
                    key={match.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => !alreadyBet && currentUser && setBetModal({ home: match.homeTeam, away: match.awayTeam, date: match.date, homeLogo: homeLogo || undefined, awayLogo: awayLogo || undefined })}
                    className={`bg-card rounded-xl border border-border p-4 transition-all ${
                      alreadyBet ? 'opacity-60' : 'hover:border-accent/30 cursor-pointer active:bg-secondary/30'
                    }`}
                  >
                    {/* Date */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        J{match.journee} • {matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                      {alreadyBet && (
                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">✓ Parié</span>
                      )}
                    </div>

                    {/* Teams + odds */}
                    <div className="flex items-center gap-3">
                      {/* Home */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        {homeLogo ? (
                          <img src={homeLogo} alt="" className="w-8 h-8 rounded-full object-contain bg-secondary p-0.5 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                            {match.homeTeam.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-foreground truncate">{match.homeTeam}</span>
                      </div>

                      {/* Odds row */}
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="bg-secondary/60 rounded-lg px-2 py-1.5 text-center min-w-[40px]">
                          <div className="text-[9px] text-muted-foreground/60 font-medium">1</div>
                          <div className="text-xs font-black text-foreground">{odds.home}</div>
                        </div>
                        <div className="bg-secondary/60 rounded-lg px-2 py-1.5 text-center min-w-[40px]">
                          <div className="text-[9px] text-muted-foreground/60 font-medium">N</div>
                          <div className="text-xs font-black text-foreground">{odds.draw}</div>
                        </div>
                        <div className="bg-secondary/60 rounded-lg px-2 py-1.5 text-center min-w-[40px]">
                          <div className="text-[9px] text-muted-foreground/60 font-medium">2</div>
                          <div className="text-xs font-black text-foreground">{odds.away}</div>
                        </div>
                      </div>

                      {/* Away */}
                      <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                        <span className="text-xs font-semibold text-foreground truncate text-right">{match.awayTeam}</span>
                        {awayLogo ? (
                          <img src={awayLogo} alt="" className="w-8 h-8 rounded-full object-contain bg-secondary p-0.5 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                            {match.awayTeam.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {activeFilter === 'my-bets' && (
          <motion.div key="my-bets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
            {myBets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun pari</p>
                <p className="text-xs mt-1">Place ton premier pari sur un match !</p>
              </div>
            ) : (
              myBets.map(bet => {
                const config = STATUS_CONFIG[bet.status] || STATUS_CONFIG.pending;
                const StatusIcon = config.icon;
                const predLabel = bet.prediction === 'home' ? bet.homeTeam : bet.prediction === 'away' ? bet.awayTeam : 'Nul';

                return (
                  <div key={bet.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {new Date(bet.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        <StatusIcon size={10} />
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{bet.homeTeam} vs {bet.awayTeam}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Prono : <span className="font-semibold text-foreground">{predLabel}</span> • Cote {bet.odds}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-xs font-medium text-muted-foreground">Mise: {bet.amount}</div>
                        <div className={`text-sm font-black ${bet.status === 'won' ? 'text-emerald-500' : bet.status === 'lost' ? 'text-destructive' : 'text-foreground'}`}>
                          {bet.status === 'won' ? `+${bet.payout}` : bet.status === 'lost' ? `-${bet.amount}` : `→ ${Math.round(bet.amount * bet.odds)}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {activeFilter === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BetLeaderboard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bet Modal */}
      {betModal && currentUser && (
        <BetModal
          isOpen={!!betModal}
          onClose={() => setBetModal(null)}
          homeTeam={betModal.home}
          awayTeam={betModal.away}
          matchDate={betModal.date}
          homeLogo={betModal.homeLogo}
          awayLogo={betModal.awayLogo}
          userId={currentUser.uid}
          userName={currentUser.name}
        />
      )}
    </div>
  );
};

export default ParisTab;
