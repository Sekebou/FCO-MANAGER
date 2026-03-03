import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Calendar, Users, TrendingUp, ChevronRight, Clock,
  MapPin, Swords, Dumbbell, Flame, Target, Shield, Star,
  BarChart3, CalendarDays, Newspaper, ArrowRight
} from 'lucide-react';
import type { Player, Event, NewsItem, Member } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import clubLogo from '@/assets/logo.png';

interface HomeTabProps {
  currentUser: AppUser | null;
  events: Event[];
  players: Player[];
  news: NewsItem[];
  members: Member[];
  onNavigate: (tab: string) => void;
}

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const HomeTab: React.FC<HomeTabProps> = ({ currentUser, events, players, news, members, onNavigate }) => {
  const isCoach = currentUser && ['admin+', 'admin', 'entraineur'].includes(currentUser.role);

  // Next events (future only)
  const now = new Date();
  const upcomingEvents = useMemo(() =>
    events
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3),
    [events]
  );

  const nextMatch = upcomingEvents.find(e => e.type === 'match');
  const nextTraining = upcomingEvents.find(e => e.type === 'training');

  // Player stats (for joueur)
  const myPlayer = useMemo(() => {
    if (!currentUser?.playerId) return null;
    return players.find(p => p.id === currentUser.playerId) || null;
  }, [players, currentUser]);

  // Top scorer
  const topScorer = useMemo(() =>
    [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0],
    [players]
  );

  // Recent news
  const recentNews = useMemo(() => news.slice(0, 2), [news]);

  // Attendance rate for current player
  const totalPlayers = players.length;

  // Quick actions based on role
  const quickActions = isCoach
    ? [
        { icon: Calendar, label: 'Présences', tab: 'presences', color: 'bg-primary/10 text-primary' },
        { icon: Users, label: 'Effectif', tab: 'members', color: 'bg-accent/10 text-accent' },
        { icon: Trophy, label: 'Championnat', tab: 'championnat', color: 'bg-warning/10 text-warning' },
        { icon: TrendingUp, label: 'Stats', tab: 'stats', color: 'bg-success/10 text-success' },
      ]
    : [
        { icon: Calendar, label: 'Présences', tab: 'presences', color: 'bg-primary/10 text-primary' },
        { icon: Trophy, label: 'Championnat', tab: 'championnat', color: 'bg-warning/10 text-warning' },
        { icon: BarChart3, label: 'Stats', tab: 'stats', color: 'bg-accent/10 text-accent' },
        { icon: Newspaper, label: 'Actus', tab: 'news', color: 'bg-success/10 text-success' },
      ];

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
  };

  return (
    <motion.div
      className="space-y-5 pb-4"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Hero Card */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary via-primary to-accent shadow-xl">
        {/* Football pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        
        {/* Glowing orb */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary-foreground/5 blur-2xl" />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-warning" />
                <span className="text-[10px] font-bold text-primary-foreground/60 uppercase tracking-widest">
                  {isCoach ? 'Tableau de bord' : 'Mon espace'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-primary-foreground leading-tight">
                {getGreeting()}, <span className="bg-gradient-to-r from-primary-foreground to-primary-foreground/70 bg-clip-text">{currentUser?.name?.split(' ')[0]}</span>
              </h2>
              <p className="text-xs sm:text-sm text-primary-foreground/50 mt-1.5 leading-relaxed">
                {isCoach
                  ? `${totalPlayers} joueurs · ${upcomingEvents.length} événement${upcomingEvents.length > 1 ? 's' : ''} à venir`
                  : myPlayer
                    ? `${myPlayer.goals || 0} buts · ${myPlayer.assists || 0} passes · ${myPlayer.matches || 0} matchs`
                    : 'Bienvenue sur FCO Manager'
                }
              </p>
            </div>
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary-foreground/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-primary-foreground/10 shadow-lg shrink-0">
              <img src={clubLogo} alt="FCO" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-lg" />
            </div>
          </div>

          {/* Player stats mini bar (joueur only) */}
          {!isCoach && myPlayer && (
            <div className="flex items-center gap-2 mt-4">
              {[
                { icon: Target, value: myPlayer.goals || 0, label: 'Buts' },
                { icon: Swords, value: myPlayer.assists || 0, label: 'Passes D.' },
                { icon: Shield, value: myPlayer.matches || 0, label: 'Matchs' },
              ].map((s, i) => (
                <div key={i} className="flex-1 bg-primary-foreground/10 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-primary-foreground/5">
                  <s.icon size={14} className="text-primary-foreground/60 mx-auto mb-0.5" />
                  <div className="text-lg font-black text-primary-foreground">{s.value}</div>
                  <div className="text-[9px] font-semibold text-primary-foreground/40 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Actions Grid */}
      <motion.div variants={fadeUp}>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {quickActions.map((action) => (
            <button
              key={action.tab}
              onClick={() => onNavigate(action.tab)}
              className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${action.color}`}>
                <action.icon size={20} strokeWidth={2} />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Next Match Card */}
      {nextMatch && (
        <motion.div variants={fadeUp}>
          <button
            onClick={() => onNavigate('presences')}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <Swords size={14} className="text-accent" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Prochain match</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm group-hover:shadow-md transition-shadow">
              {/* Gradient stripe */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
              
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-foreground truncate">{nextMatch.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CalendarDays size={12} />
                        <span className="text-xs font-medium">{formatDate(nextMatch.date)}</span>
                      </div>
                      {nextMatch.time && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock size={12} />
                          <span className="text-xs font-medium">{nextMatch.time}</span>
                        </div>
                      )}
                    </div>
                    {nextMatch.location && (
                      <div className="flex items-center gap-1 text-muted-foreground mt-1">
                        <MapPin size={12} />
                        <span className="text-xs font-medium truncate">{nextMatch.location}</span>
                      </div>
                    )}
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0 ml-3">
                    <Trophy size={24} className="text-accent" />
                  </div>
                </div>

                {/* Presence summary for coaches */}
                {isCoach && nextMatch.presences && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                    <div className="flex -space-x-1.5">
                      {Object.entries(nextMatch.presences).filter(([, s]) => s === 'present').slice(0, 5).map(([pid], i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-success/20 border-2 border-card flex items-center justify-center">
                          <span className="text-[8px] font-bold text-success">✓</span>
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {Object.values(nextMatch.presences).filter(s => s === 'present').length} présent(s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* Next Training (if different from match) */}
      {nextTraining && nextTraining.id !== nextMatch?.id && (
        <motion.div variants={fadeUp}>
          <button
            onClick={() => onNavigate('presences')}
            className="w-full text-left group"
          >
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/50 shadow-sm group-hover:shadow-md transition-shadow">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Dumbbell size={20} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Prochain entraînement</span>
                </div>
                <h4 className="text-sm font-bold text-foreground truncate mt-0.5">{nextTraining.title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{formatDate(nextTraining.date)}</span>
                  {nextTraining.time && <span className="text-xs text-muted-foreground">· {nextTraining.time}</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/40 shrink-0" />
            </div>
          </button>
        </motion.div>
      )}

      {/* Stats Overview (Coach) or Top Scorer (Player) */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-warning" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {isCoach ? 'Aperçu de l\'effectif' : 'Meilleur buteur'}
            </span>
          </div>
          <button onClick={() => onNavigate('stats')} className="flex items-center gap-0.5 text-xs font-semibold text-accent hover:underline">
            Voir tout <ArrowRight size={12} />
          </button>
        </div>

        {isCoach ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Joueurs', value: totalPlayers, icon: Users, gradient: 'from-primary/10 to-accent/5' },
              { label: 'Buts total', value: players.reduce((s, p) => s + (p.goals || 0), 0), icon: Target, gradient: 'from-success/10 to-success/5' },
              { label: 'Passes D.', value: players.reduce((s, p) => s + (p.assists || 0), 0), icon: Swords, gradient: 'from-warning/10 to-warning/5' },
            ].map((stat) => (
              <div key={stat.label} className={`flex flex-col items-center p-3 rounded-2xl bg-gradient-to-b ${stat.gradient} border border-border/30`}>
                <stat.icon size={16} className="text-muted-foreground mb-1" />
                <div className="text-xl font-black text-foreground">{stat.value}</div>
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : topScorer && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/50 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{topScorer.name}</div>
              <div className="text-xs text-muted-foreground">{topScorer.position}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black text-accent">{topScorer.goals}</div>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase">buts</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Recent News */}
      {recentNews.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <Newspaper size={14} className="text-accent" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Dernières actus</span>
            </div>
            <button onClick={() => onNavigate('news')} className="flex items-center gap-0.5 text-xs font-semibold text-accent hover:underline">
              Toutes <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentNews.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate('news')}
                className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Newspaper size={16} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground truncate">{n.title}</h4>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.content.slice(0, 80)}...</p>
                </div>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 whitespace-nowrap">{formatDate(n.date)}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Motivational footer */}
      <motion.div variants={fadeUp} className="text-center pt-2 pb-2">
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary/60 border border-border/30">
          <Flame size={12} className="text-warning" />
          <span className="text-[11px] font-semibold text-muted-foreground">Allez le FCO ! 🔵⚪</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export default React.memo(HomeTab);
