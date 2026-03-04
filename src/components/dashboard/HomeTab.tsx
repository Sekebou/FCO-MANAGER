import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight, Clock, MapPin, Trophy, Dumbbell,
  Target, Shield, Swords, Users, TrendingUp,
  Calendar, Newspaper, BarChart3
} from 'lucide-react';
import type { Player, Event, NewsItem, Member } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const HomeTab: React.FC<HomeTabProps> = ({ currentUser, events, players, news, members, onNavigate }) => {
  const isCoach = currentUser && ['admin+', 'admin', 'entraineur'].includes(currentUser.role);

  const now = new Date();
  const upcomingEvents = useMemo(() =>
    events
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4),
    [events]
  );

  const nextMatch = upcomingEvents.find(e => e.type === 'match');
  const nextTraining = upcomingEvents.find(e => e.type === 'training');

  const myPlayer = useMemo(() => {
    if (!currentUser?.playerId) return null;
    return players.find(p => p.id === currentUser.playerId) || null;
  }, [players, currentUser]);

  const recentNews = useMemo(() => news.slice(0, 2), [news]);
  const totalPlayers = players.length;

  const initials = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
  };

  return (
    <motion.div
      className="space-y-4 pb-6"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* ── Greeting Header ── */}
      <motion.div variants={fadeUp} className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-primary">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {getGreeting()}, {currentUser?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isCoach ? `${totalPlayers} joueurs dans l'effectif` : 'Prêt pour la prochaine ?'}
          </p>
        </div>
      </motion.div>

      {/* ── Player Stats (joueur only) ── */}
      {!isCoach && myPlayer && (
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Target, value: myPlayer.goals || 0, label: 'Buts', color: 'text-primary' },
            { icon: Swords, value: myPlayer.assists || 0, label: 'Passes D.', color: 'text-accent' },
            { icon: Shield, value: myPlayer.matches || 0, label: 'Matchs', color: 'text-muted-foreground' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
              <s.icon size={16} className={`${s.color} mx-auto mb-1 opacity-70`} />
              <div className="text-xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Coach Stats ── */}
      {isCoach && (
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Users, value: totalPlayers, label: 'Joueurs', color: 'text-primary' },
            { icon: Target, value: players.reduce((s, p) => s + (p.goals || 0), 0), label: 'Buts', color: 'text-accent' },
            { icon: Swords, value: players.reduce((s, p) => s + (p.assists || 0), 0), label: 'Passes', color: 'text-muted-foreground' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
              <s.icon size={16} className={`${s.color} mx-auto mb-1 opacity-70`} />
              <div className="text-xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Next Match ── */}
      {nextMatch && (
        <motion.div variants={fadeUp}>
          <SectionHeader icon={Trophy} title="Prochain match" onAction={() => onNavigate('presences')} />
          <button
            onClick={() => onNavigate('presences')}
            className="w-full text-left bg-card border border-border/50 rounded-2xl p-4 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">{nextMatch.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={11} /> {formatDate(nextMatch.date)}
                  </span>
                  {nextMatch.time && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} /> {nextMatch.time}
                    </span>
                  )}
                </div>
                {nextMatch.location && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin size={11} /> <span className="truncate">{nextMatch.location}</span>
                  </span>
                )}
              </div>
              <ChevronRight size={16} className="text-muted-foreground/40 shrink-0" />
            </div>
          </button>
        </motion.div>
      )}

      {/* ── Next Training ── */}
      {nextTraining && nextTraining.id !== nextMatch?.id && (
        <motion.div variants={fadeUp}>
          <SectionHeader icon={Dumbbell} title="Prochain entraînement" onAction={() => onNavigate('presences')} />
          <button
            onClick={() => onNavigate('presences')}
            className="w-full text-left bg-card border border-border/50 rounded-2xl p-4 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Dumbbell size={20} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">{nextTraining.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={11} /> {formatDate(nextTraining.date)}
                  </span>
                  {nextTraining.time && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} /> {nextTraining.time}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/40 shrink-0" />
            </div>
          </button>
        </motion.div>
      )}

      {/* ── Quick Navigation ── */}
      <motion.div variants={fadeUp}>
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Calendar, label: 'Présences', tab: 'presences' },
            { icon: Trophy, label: 'Championnat', tab: 'championnat' },
            { icon: BarChart3, label: 'Stats', tab: 'stats' },
            { icon: isCoach ? Users : Newspaper, label: isCoach ? 'Effectif' : 'Actus', tab: isCoach ? 'members' : 'news' },
          ].map((a) => (
            <button
              key={a.tab}
              onClick={() => onNavigate(a.tab)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-card border border-border/50 active:scale-95 transition-transform"
            >
              <a.icon size={20} className="text-primary" />
              <span className="text-[10px] font-semibold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Recent News ── */}
      {recentNews.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionHeader icon={Newspaper} title="Dernières actus" onAction={() => onNavigate('news')} actionLabel="Voir tout" />
          <div className="space-y-2">
            {recentNews.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate('news')}
                className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 active:scale-[0.98] transition-transform"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Newspaper size={16} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{n.title}</h4>
                  <p className="text-[11px] text-muted-foreground truncate">{n.content.slice(0, 60)}</p>
                </div>
                <span className="text-[10px] text-muted-foreground/50 shrink-0">{formatDate(n.date)}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

/* ── Section Header helper ── */
const SectionHeader: React.FC<{
  icon: React.ElementType;
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ icon: Icon, title, onAction, actionLabel = 'Voir' }) => (
  <div className="flex items-center justify-between mb-2 px-0.5">
    <div className="flex items-center gap-1.5">
      <Icon size={14} className="text-primary" />
      <span className="text-xs font-bold text-foreground uppercase tracking-wide">{title}</span>
    </div>
    {onAction && (
      <button onClick={onAction} className="text-[11px] font-semibold text-accent flex items-center gap-0.5">
        {actionLabel} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

export default React.memo(HomeTab);
