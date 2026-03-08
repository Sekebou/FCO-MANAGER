import React, { useState, useMemo } from 'react';
import type { Player, Event, Card, AttendanceRecord, Member } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import type { Championship, Match } from '@/components/dashboard/ChampionnatTab';
import { Plus, Minus, Trash2, Activity, Target, Trophy, Check, Crown, Medal, Award, Shield, AlertTriangle, Calendar, TrendingUp, Zap, HelpCircle, ChevronDown, BarChart3, X, ArrowLeft, Users, CircleDot, ChartNoAxesCombined, Download } from 'lucide-react';
import { exportPlayerCard, exportSeasonReport, exportAttendanceReport } from '@/lib/pdfExport';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import RoleBadge from '@/components/ui/role-badge';
import PlayerRadarChart from './PlayerRadarChart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  players: Player[];
  events: Event[];
  cards: Card[];
  attendanceRecords: AttendanceRecord[];
  members: Member[];
  championships?: Championship[];
  champMatches?: Match[];
  currentUser: AppUser | null;
  canManage: () => boolean | null;
  updatePlayerStats: (playerId: string, field: string, value: string) => void;
  deletePlayer: (playerId: string) => void;
  getPlayerCards: (playerId: string) => Card[];
  deleteCard: (cardId: string) => void;
  onAddCard: (playerId: string) => void;
}

const PlayerAvatar: React.FC<{ player: Player; members: Member[]; size?: number; className?: string }> = ({ player, members, size = 44, className = '' }) => {
  const member = members.find(m => m.playerId === player.id);
  const photoURL = member?.photoURL;
  const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={player.name}
        className={`rounded-xl object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`rounded-xl bg-primary flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <span className="text-primary-foreground font-bold" style={{ fontSize: size * 0.3 }}>{initials}</span>
    </div>
  );
};

type PeriodFilter = 'all' | 'season' | 'month';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'Toutes périodes',
  season: 'Cette saison',
  month: 'Ce mois',
};

const StatsTab = ({ players, events, cards, attendanceRecords, members, championships, champMatches, currentUser, canManage, updatePlayerStats, deletePlayer, getPlayerCards, deleteCard, onAddCard }: Props) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [expandedRadar, setExpandedRadar] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Period filtering helpers
  const now = new Date();
  const seasonStart = useMemo(() => {
    const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(y, 7, 1); // Aug 1
  }, []);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), []);

  const isInPeriod = (dateStr: string) => {
    if (periodFilter === 'all') return true;
    const d = new Date(dateStr);
    if (periodFilter === 'season') return d >= seasonStart;
    return d >= monthStart;
  };

  const filteredEvents = useMemo(() => events.filter(e => isInPeriod(e.date)), [events, periodFilter]);
  const filteredCards = useMemo(() => cards.filter(c => isInPeriod(c.date)), [cards, periodFilter]);
  const filteredAttendance = useMemo(() => attendanceRecords.filter(r => isInPeriod(r.eventDate)), [attendanceRecords, periodFilter]);

  const calculateAttendanceRate = (playerId: string) => {
    const trainingEvents = filteredEvents.filter(e => e.type === 'training');
    const activeEventIds = new Set(trainingEvents.map(e => e.id));

    // Build a unified set of all training event IDs (active + archived)
    const archivedRecords = filteredAttendance.filter(
      r => r.playerId === playerId && r.eventType === 'training' && !activeEventIds.has(r.eventId)
    );
    // Deduplicate archived event IDs
    const archivedEventIds = new Set(archivedRecords.map(r => r.eventId));

    // Also count archived events from ALL players (not just this one) to get true total
    const allArchivedEventIds = new Set(
      filteredAttendance
        .filter(r => r.eventType === 'training' && !activeEventIds.has(r.eventId))
        .map(r => r.eventId)
    );

    let present = 0;

    // Count from active events
    trainingEvents.forEach(t => {
      const p = t.presences || {};
      if (p[playerId] === 'present') present++;
    });

    // Count from archived records for this player
    archivedRecords.forEach(r => {
      if (r.status === 'present') present++;
    });

    const total = activeEventIds.size + allArchivedEventIds.size;
    if (total === 0) return null;
    return { rate: (present / total) * 100, present, total };
  };

  const getDisciplineScore = (playerId: string) => {
    const playerCards = filteredCards.filter(c => c.playerId === playerId);
    let penalty = 0;
    playerCards.forEach(c => { penalty += c.type === 'yellow' ? 10 : 30; });
    return Math.max(0, 100 - penalty);
  };

  const attendanceStats = players
    .map(p => ({ player: p, attendance: calculateAttendanceRate(p.id) }))
    .filter(i => i.attendance !== null)
    .sort((a, b) => {
      // Primary sort: number of presences (descending)
      const presenceDiff = (b.attendance?.present ?? 0) - (a.attendance?.present ?? 0);
      if (presenceDiff !== 0) return presenceDiff;
      // Secondary: attendance rate
      const rateDiff = (b.attendance?.rate ?? 0) - (a.attendance?.rate ?? 0);
      if (rateDiff !== 0) return rateDiff;
      // Tertiary: stable alphabetical tiebreaker
      return a.player.name.localeCompare(b.player.name);
    });

  // KPI cards data
  const topScorer = [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
  const topAssister = [...players].sort((a, b) => (b.assists || 0) - (a.assists || 0))[0];
  const topAttendance = attendanceStats[0];

  const isCoachOrAdmin = currentUser?.role === 'admin+' || currentUser?.role === 'admin' || currentUser?.role === 'entraineur';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-accent" size={18} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Statistiques</h2>
        </div>
        {isCoachOrAdmin && players.length > 0 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => exportAttendanceReport(players, events, attendanceRecords)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground transition-all"
              title="Rapport de présences (PDF)"
            >
              <Download size={12} /> Présences
            </button>
            <button
              onClick={() => exportSeasonReport(players, events, cards, championships || [], champMatches || [])}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-all"
              title="Bilan saison (PDF)"
            >
              <Download size={12} /> Bilan
            </button>
          </div>
        )}
      </div>

      {/* Button to open KPI/Attendance modal */}
      {isCoachOrAdmin && players.length > 0 && (
        <button
          onClick={() => setShowStatsModal(true)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:bg-secondary/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/15 rounded-xl flex items-center justify-center">
              <Trophy size={20} className="text-accent" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-foreground">Performances & Présences</div>
              <div className="text-[10px] text-muted-foreground">KPIs, podium, taux de présence</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {topScorer && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg">
                <Target size={12} className="text-accent" />
                {topScorer.name.split(' ')[0]} · {topScorer.goals || 0} buts
              </div>
            )}
            <ChevronDown size={16} className="text-muted-foreground group-hover:text-foreground transition-colors -rotate-90" />
          </div>
        </button>
      )}

      {/* KPI & Attendance Modal */}
      <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/60">
          {/* Header */}
          <div className="p-4 pb-3 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur-md z-10 flex items-center gap-3">
            <button
              onClick={() => setShowStatsModal(false)}
              className="w-9 h-9 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors shrink-0"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">Tableau de bord</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Performances & présences de l'équipe</p>
            </div>
          </div>

          <div className="p-4 space-y-5">

            {/* ── Section 1 : Tops joueurs ── */}
            <div>
              <h4 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Trophy size={12} className="text-accent" />
                Tops joueurs
                <span className="flex-1 h-px bg-border/50" />
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Buteur', player: topScorer, value: `${topScorer?.goals || 0}`, unit: 'buts', Icon: Target, gradient: 'from-accent/15 to-accent/5' },
                  { label: 'Passeur', player: topAssister, value: `${topAssister?.assists || 0}`, unit: 'passes', Icon: Zap, gradient: 'from-primary/15 to-primary/5' },
                  { label: 'Assidu', player: topAttendance?.player, value: topAttendance ? `${topAttendance.attendance!.present}/${topAttendance.attendance!.total}` : '—', unit: 'entraîn.', Icon: Calendar, gradient: 'from-accent/10 to-accent/5' },
                ].map((kpi, i) => {
                  const member = kpi.player ? members.find(m => m.playerId === kpi.player!.id) : null;
                  const photoURL = member?.photoURL;
                  const initials = kpi.player?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                  return (
                    <div key={i} className={`flex flex-col items-center p-3 bg-gradient-to-b ${kpi.gradient} border border-border/40 rounded-xl text-center`}>
                      <div className="relative mb-2">
                        {photoURL ? (
                          <img src={photoURL} alt="" className="w-11 h-11 rounded-xl object-cover ring-1 ring-border/50" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center ring-1 ring-border/50">
                            <span className="text-xs font-bold text-foreground">{initials}</span>
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-background border border-border/50 flex items-center justify-center shadow-sm">
                          <kpi.Icon size={10} className="text-accent" />
                        </div>
                      </div>
                      <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{kpi.label}</div>
                      <div className="text-xs font-bold text-foreground truncate w-full">{kpi.player?.name.split(' ')[0] || '—'}</div>
                      <div className="text-lg font-black text-accent leading-tight mt-0.5">{kpi.value}</div>
                      <div className="text-[8px] text-muted-foreground font-medium">{kpi.unit}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Section 2 : Présences entraînements ── */}
            {attendanceStats.length > 0 && (
              <div>
                <h4 className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <BarChart3 size={12} className="text-accent" />
                  Présences entraînements
                  <span className="flex-1 h-px bg-border/50" />
                </h4>

                {/* Modern Podium */}
                {attendanceStats.length >= 3 && (
                  <div className="relative bg-gradient-to-b from-accent/5 to-transparent rounded-2xl border border-border/40 p-4 pt-5 mb-4 overflow-hidden">
                    {/* Decorative background */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/8 via-transparent to-transparent pointer-events-none" />
                    
                    <div className="relative flex items-end justify-center gap-2 sm:gap-4 pb-2">
                      {[1, 0, 2].map((podiumIdx) => {
                        const item = attendanceStats[podiumIdx];
                        if (!item) return null;
                        const rate = item.attendance!.rate;
                        const isFirst = podiumIdx === 0;
                        const member = members.find(m => m.playerId === item.player.id);
                        const photoURL = member?.photoURL;
                        const initials = item.player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

                        // podiumIdx = index in attendanceStats (0=1st, 1=2nd, 2=3rd)
                        const podiumConfig = [
                          { rank: 1, medal: '🥇', height: 'h-20', avatarSize: 'w-14 h-14', ringColor: 'ring-accent/50', bg: 'bg-accent/10', textColor: 'text-accent' },
                          { rank: 2, medal: '🥈', height: 'h-14', avatarSize: 'w-12 h-12', ringColor: 'ring-muted-foreground/30', bg: 'bg-secondary/60', textColor: 'text-muted-foreground' },
                          { rank: 3, medal: '🥉', height: 'h-10', avatarSize: 'w-11 h-11', ringColor: 'ring-muted-foreground/20', bg: 'bg-secondary/40', textColor: 'text-muted-foreground' },
                        ][podiumIdx];

                        return (
                          <div key={item.player.id} className={`flex flex-col items-center flex-1 max-w-[110px] ${podiumIdx === 0 ? 'order-2' : podiumIdx === 1 ? 'order-1' : 'order-3'}`}>
                            {/* Medal */}
                            <span className={`text-lg ${isFirst ? 'text-2xl mb-1' : 'mb-0.5'}`}>{podiumConfig.medal}</span>
                            
                            {/* Avatar */}
                            <div className={`relative mb-1.5 ${isFirst ? 'scale-105' : ''}`}>
                              {photoURL ? (
                                <img src={photoURL} alt={item.player.name} className={`${podiumConfig.avatarSize} rounded-full object-cover ring-2 ${podiumConfig.ringColor} shadow-md`} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className={`${podiumConfig.avatarSize} rounded-full bg-secondary border-2 border-border flex items-center justify-center shadow-md`}>
                                  <span className={`font-bold text-foreground ${isFirst ? 'text-sm' : 'text-[10px]'}`}>{initials}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Name */}
                            <div className={`font-semibold text-foreground text-center truncate w-full ${isFirst ? 'text-xs' : 'text-[10px]'}`}>
                              {item.player.name.split(' ')[0]}
                            </div>
                            
                            {/* Stats */}
                            <div className={`font-black ${podiumConfig.textColor} ${isFirst ? 'text-xl' : 'text-base'} leading-tight`}>
                              {item.attendance!.present}
                            </div>
                            <div className="text-[9px] text-muted-foreground font-medium leading-tight mb-1.5">
                              sur {item.attendance!.total} entraîn. ({rate.toFixed(0)}%)
                            </div>
                            
                            {/* Podium bar */}
                            <div className={`w-full ${podiumConfig.height} rounded-t-xl ${podiumConfig.bg} border border-border/30 border-b-0 flex items-center justify-center`}>
                              <span className={`text-xl font-black ${podiumConfig.textColor} opacity-40`}>{podiumConfig.rank}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Bottom line */}
                    <div className="h-px bg-border/50 -mx-4" />
                  </div>
                )}

                {/* Full ranking list */}
                <div className="space-y-1.5">
                  {attendanceStats.map((item, index) => {
                    const rate = item.attendance!.rate;
                    const colorClass = rate >= 80 ? 'bg-accent' : rate >= 60 ? 'bg-accent/70' : rate >= 40 ? 'bg-warning' : 'bg-destructive';
                    const textColor = rate >= 80 ? 'text-accent' : rate >= 60 ? 'text-accent' : rate >= 40 ? 'text-warning' : 'text-destructive';
                    return (
                      <div key={item.player.id} className="flex items-center gap-2 p-2.5 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                        <div className={`w-6 h-6 rounded-lg ${colorClass} flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">{item.player.name}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-black ${textColor} w-7 text-right`}>{item.attendance!.present}</span>
                          <div className="w-16 h-1.5 bg-border/50 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.round(rate)}%` }} />
                          </div>
                          <span className="text-[9px] text-muted-foreground text-right whitespace-nowrap w-[4.5rem]">{item.attendance!.present}/{item.attendance!.total} entraîn.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Player cards with radar */}
      {players.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-muted-foreground font-medium">Aucun joueur enregistré</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {players.map(player => {
            const playerCards = getPlayerCards(player.id);
            const matches = player.matches || 0;
            const goals = player.goals || 0;
            const assists = player.assists || 0;
            const avgGoals = matches > 0 ? (goals / matches).toFixed(2) : '—';
            const attendance = calculateAttendanceRate(player.id);
            const discipline = getDisciplineScore(player.id);
            const isExpanded = expandedRadar === player.id;

            return (
              <div key={player.id} className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in">
                {/* Player header */}
                <div className="flex items-center justify-between p-3 sm:p-5 pb-3 sm:pb-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <PlayerAvatar player={player} members={members} size={36} className="rounded-xl sm:w-[44px] sm:h-[44px]" />
                     <div>
                      <h3 className="font-bold text-sm sm:text-base text-foreground">{player.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground px-1.5 sm:px-2 py-0.5 bg-secondary rounded-md">{player.position}</span>
                        {(() => { const m = members.find(mb => mb.playerId === player.id); return m ? <RoleBadge role={m.role} displayRole={m.displayRole} size="sm" subtle /> : null; })()}
                      </div>
                      {/* Attendance info */}
                      {attendance && (
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar size={10} className="text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {attendance.present}/{attendance.total} entraîn. ({attendance.rate.toFixed(0)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Radar toggle button */}
                  {isCoachOrAdmin && (
                    <button
                      onClick={() => setExpandedRadar(isExpanded ? null : player.id)}
                      className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${isExpanded ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                    >
                      <ChartNoAxesCombined size={15} />
                      <span className="text-[8px] leading-tight">Stats avancées</span>
                    </button>
                  )}
                </div>

                {/* Radar chart (expandable) */}
                {isCoachOrAdmin && isExpanded && (
                  <div className="px-3 sm:px-5 pb-3">
                    <div className="bg-secondary/30 rounded-xl p-2 border border-border/50">
                      <PlayerRadarChart
                        name={player.name}
                        goals={goals}
                        assists={assists}
                        matches={matches}
                        attendanceRate={attendance?.rate ?? null}
                        disciplineScore={discipline}
                      />
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[9px] sm:text-[10px] text-muted-foreground mt-1 pb-1">
                        <span className="flex items-center gap-1"><Target size={10} /> {goals} buts</span>
                        <span className="flex items-center gap-1"><Zap size={10} /> {assists} PD</span>
                        <span className="flex items-center gap-1"><Activity size={10} /> {matches} matchs</span>
                        <span className="flex items-center gap-1"><Check size={10} /> {attendance ? `${attendance.rate.toFixed(0)}%` : '—'}</span>
                        <span className="flex items-center gap-1"><Shield size={10} /> {discipline.toFixed(0)}% disc.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border mx-3 sm:mx-5 rounded-xl overflow-hidden mb-3 sm:mb-4">
                  {[
                    { icon: Activity, label: 'Matchs', value: matches, field: 'matches', color: 'text-accent' },
                    { icon: Target, label: 'Buts', value: goals, field: 'goals', color: 'text-green-500' },
                    { icon: Zap, label: 'Passes D.', value: assists, field: 'assists', color: 'text-purple-500' },
                    { icon: TrendingUp, label: 'Moy/Match', value: avgGoals, field: null, color: 'text-muted-foreground' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card p-3 flex flex-col items-center text-center">
                      <stat.icon size={15} className={`${stat.color} mb-1.5`} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</span>
                      {canManage() && stat.field ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <button
                            onClick={() => updatePlayerStats(player.id, stat.field!, String(Math.max(0, Number(stat.value) - 1)))}
                            className="w-6 h-6 rounded-md bg-secondary hover:bg-destructive/15 hover:text-destructive flex items-center justify-center transition-all"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={stat.value}
                            onChange={(e) => updatePlayerStats(player.id, stat.field!, e.target.value)}
                            className="text-xl font-bold w-10 bg-transparent text-foreground outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                          />
                          <button
                            onClick={() => updatePlayerStats(player.id, stat.field!, String(Number(stat.value) + 1))}
                            className="w-6 h-6 rounded-md bg-secondary hover:bg-accent/20 hover:text-accent flex items-center justify-center transition-all"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-foreground mt-0.5">{stat.value}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cards section */}
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Shield size={14} className="text-muted-foreground" />
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cartons</h4>
                    </div>
                    {canManage() && (
                      <button onClick={() => onAddCard(player.id)} className="text-xs text-destructive font-semibold hover:bg-destructive/10 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1">
                        <Plus size={12} /> Ajouter un carton
                      </button>
                    )}
                  </div>
                  {playerCards.length === 0 ? (
                    <div className="flex items-center gap-2 py-2.5 px-3 bg-secondary/50 rounded-xl">
                      <Check size={14} className="text-green-500" />
                      <p className="text-xs text-muted-foreground font-medium">Aucun carton</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {playerCards.map(card => (
                        <div key={card.id} className={`flex items-center gap-3 p-3 rounded-xl border ${card.type === 'yellow' ? 'bg-warning/5 border-warning/20' : 'bg-destructive/5 border-destructive/20'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.type === 'yellow' ? 'bg-warning/20' : 'bg-destructive/20'}`}>
                            <AlertTriangle size={14} className={card.type === 'yellow' ? 'text-warning' : 'text-destructive'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${card.type === 'yellow' ? 'text-warning' : 'text-destructive'}`}>
                                {card.type === 'yellow' ? 'JAUNE' : 'ROUGE'}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar size={10} /> {new Date(card.date).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <p className="text-xs text-foreground truncate mt-0.5">{card.reason}</p>
                            {card.suspendedUntil && (
                              <p className="text-[10px] text-destructive font-medium mt-0.5">Suspendu → {new Date(card.suspendedUntil).toLocaleDateString('fr-FR')}</p>
                            )}
                          </div>
                          {canManage() && (
                            <button onClick={() => deleteCard(card.id)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all shrink-0">
                              <Trash2 size={13} className="text-destructive/60" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatsTab;
