import React, { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, Coins, Zap, Gift, MessageCircle, Heart, CalendarCheck, Trophy, ChevronRight, Target, Hash, User, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { cn } from '@/lib/utils';

export type BetType = 'match' | 'scorer' | 'exact_score';

export interface BetPlacementPayload {
  userId: string;
  userName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  prediction: string;
  odds: number;
  amount: number;
  newBalance: number;
  team?: string;
  betType?: BetType;
  scorerPlayerId?: string;
  scorerPlayerName?: string;
  predictedScoreHome?: number;
  predictedScoreAway?: number;
}

interface ConvocatedPlayer {
  id: string;
  name: string;
  position: string;
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
  convocatedPlayers?: ConvocatedPlayer[];
}

/** Generate odds based on standings positions. */
function generateOdds(homeTeam: string, awayTeam: string, matchDate: string, homeRank?: number, awayRank?: number, totalTeams?: number): { home: number; draw: number; away: number } {
  const total = totalTeams || 12;
  
  if (homeRank && awayRank) {
    const homeStrength = 1 - ((homeRank - 1) / (total - 1));
    const awayStrength = 1 - ((awayRank - 1) / (total - 1));
    const homePower = homeStrength + 0.1;
    const awayPower = awayStrength;
    const totalPower = homePower + awayPower;
    const drawBase = 0.22;
    const homeProb = (homePower / totalPower) * (1 - drawBase);
    const awayProb = (awayPower / totalPower) * (1 - drawBase);
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

/** Generate scorer odds based on position */
function getScorerOdds(position: string): number {
  const pos = (position || '').toLowerCase();
  if (pos.includes('gardien') || pos.includes('goal')) return 20;
  if (pos.includes('défenseur') || pos.includes('def') || pos.includes('arrière') || pos.includes('latéral') || pos.includes('libero') || pos.includes('central')) return 5;
  if (pos.includes('milieu') || pos.includes('mil')) return 3;
  if (pos.includes('attaquant') || pos.includes('att') || pos.includes('avant') || pos.includes('ailier') || pos.includes('buteur')) return 2;
  return 3; // default
}

/** Generate exact score odds */
function getExactScoreOdds(home: number, away: number): number {
  const total = home + away;
  const diff = Math.abs(home - away);
  // Common scores
  if (total <= 2 && diff <= 1) return 5;    // 1-0, 0-1, 1-1, 0-0, 2-0, 0-2
  if (total <= 3 && diff <= 2) return 7;    // 2-1, 1-2, 3-0, 0-3
  if (total <= 4) return 10;                // 2-2, 3-1, 1-3, 4-0
  return 15;                                // 5-0, 4-3, etc.
}

const POSITION_ORDER: Record<string, number> = {
  'gardien': 0, 'goal': 0,
  'défenseur': 1, 'arrière': 1, 'latéral': 1, 'central': 1, 'libero': 1,
  'milieu': 2,
  'attaquant': 3, 'ailier': 3, 'avant': 3, 'buteur': 3,
};

function getPositionSort(position: string): number {
  const pos = (position || '').toLowerCase();
  for (const [key, val] of Object.entries(POSITION_ORDER)) {
    if (pos.includes(key)) return val;
  }
  return 2;
}

const BetModal: React.FC<BetModalProps> = ({ isOpen, onClose, onBetPlaced, homeTeam, awayTeam, matchDate, homeLogo, awayLogo, userId, userName, team, convocatedPlayers }) => {
  useBodyScrollLock(isOpen);
  const [betType, setBetType] = useState<BetType>('match');
  const [prediction, setPrediction] = useState<'home' | 'draw' | 'away' | null>(null);
  const [amount, setAmount] = useState(10);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeBetsCount, setActiveBetsCount] = useState(0);
  const [userScorerCount, setUserScorerCount] = useState(0);
  const [scorerInfoOpen, setScorerInfoOpen] = useState(false);
  const [scorerLimitOpen, setScorerLimitOpen] = useState(false);
  const [duplicateBetOpen, setDuplicateBetOpen] = useState<null | { title: string; message: string }>(null);

  // Clamp amount to balance whenever balance changes (prevents grey "Valider" if balance < default 10)
  useEffect(() => {
    if (balance > 0 && amount > balance) {
      setAmount(Math.max(1, balance));
    }
  }, [balance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scorer state
  const [selectedScorer, setSelectedScorer] = useState<ConvocatedPlayer | null>(null);
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string>>({});

  // Exact score state
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);

  const odds = generateOdds(homeTeam, awayTeam, matchDate);

  const sortedPlayers = useMemo(() => {
    if (!convocatedPlayers) return [];
    return [...convocatedPlayers].sort((a, b) => getPositionSort(a.position) - getPositionSort(b.position));
  }, [convocatedPlayers]);

  const hasConvocations = !!convocatedPlayers && convocatedPlayers.length > 0;

  useEffect(() => {
    if (!isOpen || !userId) return;
    const fetchData = async () => {
      const normalizedDate = (matchDate || '').slice(0, 10);
      const [{ data: pointsData }, { data: betsData }, { data: userScorerBets }] = await Promise.all([
        supabase.from('user_points').select('balance').eq('user_id', userId).maybeSingle(),
        supabase.from('bets').select('id').eq('home_team', homeTeam).eq('away_team', awayTeam).eq('match_date', matchDate).eq('status', 'pending'),
        supabase.from('bets').select('id').eq('user_id', userId).eq('home_team', homeTeam).eq('away_team', awayTeam).eq('bet_type', 'scorer').eq('status', 'pending'),
      ]);
      if (pointsData) {
        setBalance(pointsData.balance);
      } else {
        await supabase.from('user_points').insert({ user_id: userId, balance: 100 });
        setBalance(100);
      }
      setActiveBetsCount(betsData?.length || 0);
      setUserScorerCount(userScorerBets?.length || 0);
    };
    fetchData();
  }, [isOpen, userId, homeTeam, awayTeam, matchDate]);

  // Load photos for convocated players (via profiles.player_id)
  useEffect(() => {
    if (!isOpen || !convocatedPlayers || convocatedPlayers.length === 0) return;
    const ids = convocatedPlayers.map(p => p.id);
    supabase.from('profiles').select('player_id, photo_url').in('player_id', ids).then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      for (const row of data) {
        if (row.player_id && row.photo_url) map[row.player_id] = row.photo_url;
      }
      setPlayerPhotos(map);
    });
  }, [isOpen, convocatedPlayers]);

  // Reset sub-selections when switching bet type
  useEffect(() => {
    setPrediction(null);
    setSelectedScorer(null);
    setScoreHome(0);
    setScoreAway(0);
  }, [betType]);

  const currentOdd = useMemo(() => {
    if (betType === 'match') {
      return prediction === 'home' ? odds.home : prediction === 'draw' ? odds.draw : prediction === 'away' ? odds.away : 0;
    }
    if (betType === 'scorer' && selectedScorer) {
      return getScorerOdds(selectedScorer.position);
    }
    if (betType === 'exact_score') {
      return getExactScoreOdds(scoreHome, scoreAway);
    }
    return 0;
  }, [betType, prediction, odds, selectedScorer, scoreHome, scoreAway]);

  const potentialWin = Math.round(amount * currentOdd);

  const canPlace = useMemo(() => {
    if (amount < 1 || amount > balance) return false;
    if (betType === 'match') return !!prediction;
    if (betType === 'scorer') return !!selectedScorer;
    if (betType === 'exact_score') return true; // 0-0 is valid
    return false;
  }, [betType, prediction, selectedScorer, amount, balance]);

  const handleBet = async () => {
    if (!canPlace) return;
    setLoading(true);
    try {
      const predictionValue = betType === 'match' ? prediction!
        : betType === 'scorer' ? 'scorer'
        : `${scoreHome}-${scoreAway}`;

      const { data, error } = await supabase.rpc('place_bet', {
        p_user_id: userId,
        p_user_name: userName,
        p_match_date: matchDate,
        p_home_team: homeTeam,
        p_away_team: awayTeam,
        p_prediction: predictionValue,
        p_odds: currentOdd,
        p_amount: amount,
        p_team: team || null,
        p_bet_type: betType,
        p_scorer_player_id: selectedScorer?.id || null,
        p_scorer_player_name: selectedScorer?.name || null,
        p_predicted_score_home: betType === 'exact_score' ? scoreHome : null,
        p_predicted_score_away: betType === 'exact_score' ? scoreAway : null,
      } as any);

      if (error) {
        const msg = error.message || 'Erreur lors du pari';
        if (msg.includes('Limite atteinte') || msg.toLowerCase().includes('3 paris buteur')) {
          setScorerLimitOpen(true);
        }
        else if (msg.includes('déjà')) {
          if (betType === 'scorer' && selectedScorer) {
            setDuplicateBetOpen({
              title: 'Pari buteur déjà placé',
              message: `Tu as déjà parié sur ${selectedScorer.name} comme buteur sur ce match. Choisis un autre joueur.`,
            });
          } else if (betType === 'exact_score') {
            setDuplicateBetOpen({
              title: 'Pari déjà placé',
              message: 'Tu as déjà un pari "Score exact" sur ce match. Tu ne peux en placer qu\'un seul par match.',
            });
          } else if (betType === 'match') {
            setDuplicateBetOpen({
              title: 'Pari déjà placé',
              message: 'Tu as déjà un pari "Résultat" sur ce match. Tu ne peux en placer qu\'un seul par match.',
            });
          } else {
            setDuplicateBetOpen({
              title: 'Pari déjà placé',
              message: 'Tu as déjà ce pari sur ce match.',
            });
          }
        }
        else if (msg.includes('Solde')) toast.error('Solde insuffisant !');
        else toast.error(msg);
        setLoading(false);
        return;
      }

      const newBalance = typeof data === 'object' && data !== null && 'new_balance' in data
        ? Number((data as any).new_balance ?? balance - amount)
        : balance - amount;

      onBetPlaced?.({
        userId, userName, homeTeam, awayTeam, matchDate,
        prediction: predictionValue,
        odds: currentOdd, amount, newBalance, team,
        betType,
        scorerPlayerId: selectedScorer?.id,
        scorerPlayerName: selectedScorer?.name,
        predictedScoreHome: betType === 'exact_score' ? scoreHome : undefined,
        predictedScoreAway: betType === 'exact_score' ? scoreAway : undefined,
      });

      const typeLabel = betType === 'scorer' ? 'Pari buteur' : betType === 'exact_score' ? 'Pari score exact' : 'Pari';
      toast.success(`${typeLabel} de ${amount} pts placé ! Gain potentiel: ${potentialWin} pts`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du pari');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const betTypes: { id: BetType; label: string; icon: React.ElementType; disabled?: boolean; disabledReason?: string }[] = [
    { id: 'match', label: 'Résultat', icon: Trophy },
    { id: 'scorer', label: 'Buteur', icon: Target, disabled: !hasConvocations, disabledReason: 'Disponible après la convocation' },
    { id: 'exact_score', label: 'Score exact', icon: Hash },
  ];

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-end sm:items-center justify-center z-[70]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border border-border shadow-2xl max-h-[90vh] flex flex-col"
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

          {/* Bet type selector */}
          <div className="flex bg-secondary/50 rounded-xl p-1 border border-border/50">
            {betTypes.map(bt => {
              const Icon = bt.icon;
              return (
                <button
                  key={bt.id}
                  onClick={() => {
                    if (bt.disabled) {
                      if (bt.id === 'scorer') setScorerInfoOpen(true);
                      return;
                    }
                    if (bt.id === 'scorer' && userScorerCount >= 3) {
                      setScorerLimitOpen(true);
                      return;
                    }
                    setBetType(bt.id);
                  }}
                  title={bt.disabled ? bt.disabledReason : undefined}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[10px] font-semibold transition-all",
                    betType === bt.id
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : bt.disabled
                        ? "text-muted-foreground/40 cursor-pointer"
                        : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Icon size={14} />
                  {bt.label}
                </button>
              );
            })}
          </div>

          {/* ═══ MATCH BET ═══ */}
          <AnimatePresence mode="wait">
            {betType === 'match' && (
              <motion.div key="match" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
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
                        <span className={`text-[9px] font-semibold uppercase tracking-wide ${selected ? 'text-accent/70' : 'text-muted-foreground/60'}`}>Cote</span>
                        <span className={`text-2xl font-black ${selected ? 'text-accent' : 'text-foreground'}`}>{o.odd}</span>
                        <span className={`text-[10px] font-semibold leading-tight text-center line-clamp-2 ${selected ? 'text-accent' : 'text-muted-foreground'}`}>{o.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═══ SCORER BET ═══ */}
            {betType === 'scorer' && (
              <motion.div key="scorer" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <AnimatePresence mode="wait">
                  {selectedScorer ? (
                    /* === FOCUSED PLAYER CARD === */
                    (() => {
                      const photo = playerPhotos[selectedScorer.id];
                      const initials = selectedScorer.name.split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
                      const firstName = selectedScorer.name.split(' ')[0];
                      const lastName = selectedScorer.name.split(' ').slice(1).join(' ');
                      const playerOdd = getScorerOdds(selectedScorer.position);
                      return (
                        <motion.div
                          key="focused"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                          className="relative flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 border-accent bg-gradient-to-br from-accent/15 via-accent/5 to-transparent shadow-md shadow-accent/10"
                        >
                          {/* Avatar compact */}
                          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-accent/40 shadow-sm flex items-center justify-center bg-secondary shrink-0">
                            {photo ? (
                              <img src={photo} alt={selectedScorer.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-black text-muted-foreground">{initials}</span>
                            )}
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none mb-0.5">Buteur sélectionné</p>
                            <p className="text-sm font-black text-foreground leading-tight truncate">
                              {firstName} <span className="font-bold uppercase">{lastName}</span>
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent text-accent-foreground leading-none">
                                x{playerOdd}
                              </span>
                              <button
                                onClick={() => setSelectedScorer(null)}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-accent bg-accent/10 hover:bg-accent/20 active:scale-95 transition-all leading-none"
                              >
                                <ChevronRight size={10} className="rotate-180" />
                                Changer
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()
                  ) : (
                    /* === GRID OF PLAYERS === */
                    <motion.div
                      key="grid"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-foreground">Qui va marquer ?</label>
                        <span className="text-[10px] font-semibold text-muted-foreground">{sortedPlayers.length} joueur{sortedPlayers.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 max-h-[280px] overflow-y-auto pr-1 -mr-1 pb-1">
                        {sortedPlayers.map(player => {
                          const playerOdd = getScorerOdds(player.position);
                          const photo = playerPhotos[player.id];
                          const initials = player.name.split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
                          const firstName = player.name.split(' ')[0];
                          const lastName = player.name.split(' ').slice(1).join(' ');
                          return (
                            <motion.button
                              key={player.id}
                              whileTap={{ scale: 0.94 }}
                              onClick={() => setSelectedScorer(player)}
                              className="relative flex flex-col items-center gap-1 px-1 pt-2 pb-1.5 rounded-xl border border-border bg-card hover:border-accent/40 transition-all text-center overflow-hidden"
                            >
                              <div className="absolute top-1 right-1 px-1 py-px rounded text-[9px] font-black leading-none bg-secondary text-foreground">
                                x{playerOdd}
                              </div>
                              <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-border bg-secondary shrink-0 flex items-center justify-center">
                                {photo ? (
                                  <img src={photo} alt={player.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-black text-muted-foreground">{initials}</span>
                                )}
                              </div>
                              <div className="w-full min-w-0 leading-tight">
                                <p className="text-[10px] font-black truncate text-foreground leading-tight">{firstName}</p>
                                {lastName && (
                                  <p className="text-[9px] font-semibold text-muted-foreground uppercase truncate leading-tight">{lastName}</p>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}


            {/* ═══ EXACT SCORE BET ═══ */}
            {betType === 'exact_score' && (
              <motion.div key="exact_score" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                <label className="block text-xs font-bold text-foreground mb-3">Score exact</label>
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[80px] text-center">{homeTeam}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScoreHome(Math.max(0, scoreHome - 1))}
                        className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg font-black text-foreground hover:bg-secondary/80 active:scale-95 transition-all"
                      >−</button>
                      <div className="w-12 h-12 rounded-xl bg-card border-2 border-accent/40 flex items-center justify-center text-xl font-black text-accent">
                        {scoreHome}
                      </div>
                      <button
                        onClick={() => setScoreHome(Math.min(9, scoreHome + 1))}
                        className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg font-black text-foreground hover:bg-secondary/80 active:scale-95 transition-all"
                      >+</button>
                    </div>
                  </div>
                  <span className="text-xl font-black text-muted-foreground mt-4">-</span>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[80px] text-center">{awayTeam}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScoreAway(Math.max(0, scoreAway - 1))}
                        className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg font-black text-foreground hover:bg-secondary/80 active:scale-95 transition-all"
                      >−</button>
                      <div className="w-12 h-12 rounded-xl bg-card border-2 border-accent/40 flex items-center justify-center text-xl font-black text-accent">
                        {scoreAway}
                      </div>
                      <button
                        onClick={() => setScoreAway(Math.min(9, scoreAway + 1))}
                        className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg font-black text-foreground hover:bg-secondary/80 active:scale-95 transition-all"
                      >+</button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center mt-3">
                  <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-2 text-center">
                    <span className="text-[10px] text-muted-foreground font-medium">Cote </span>
                    <span className="text-lg font-black text-accent">x{getExactScoreOdds(scoreHome, scoreAway)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Amount slider */}
          {(canPlace || (betType === 'exact_score')) && currentOdd > 0 && (
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

          {/* How to earn points */}
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
              disabled={!canPlace || loading}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm shadow-lg shadow-accent/20"
            >
              {loading ? 'En cours...' : 'Valider le pari'}
            </motion.button>
          </div>
        </div>

        {/* Sub-modal: info paris buteur indisponible */}
        <AnimatePresence>
          {scorerInfoOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
              onClick={() => setScorerInfoOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 10 }}
                transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden"
              >
                <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/15 px-5 pt-5 pb-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 mb-3">
                    <Target size={22} className="text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-[15px] font-black text-foreground leading-tight">
                    Paris buteur pas encore dispo
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                    Les paris sur le buteur du match seront ouverts dès que la convocation officielle sera publiée par le staff.
                  </p>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => setScorerInfoOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Compris
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-modal: limite 3 paris buteur atteinte */}
        <AnimatePresence>
          {scorerLimitOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
              onClick={() => setScorerLimitOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 10 }}
                transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs rounded-2xl border border-amber-500/30 bg-card shadow-2xl overflow-hidden"
              >
                <div className="bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-500/15 px-5 pt-5 pb-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-3">
                    <AlertTriangle size={22} className="text-white" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-[15px] font-black text-foreground leading-tight">
                    Limite atteinte
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                    Il est impossible de parier sur plus de <span className="font-bold text-foreground">3 buteurs</span> par match. Tu as atteint la limite pour cette rencontre.
                  </p>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => setScorerLimitOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-[13px] font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Compris
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-modal: pari déjà placé (résultat / score exact / buteur) */}
        <AnimatePresence>
          {duplicateBetOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
              onClick={() => setDuplicateBetOpen(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 10 }}
                transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden"
              >
                <div className="bg-gradient-to-br from-primary/15 via-primary/10 to-primary/15 px-5 pt-5 pb-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 mb-3">
                    <AlertTriangle size={22} className="text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-[15px] font-black text-foreground leading-tight">
                    {duplicateBetOpen.title}
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                    {duplicateBetOpen.message}
                  </p>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => setDuplicateBetOpen(null)}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Compris
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default BetModal;
