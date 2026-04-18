import React, { useMemo } from 'react';
import {
  ChevronRight, Clock, MapPin, Trophy, Dumbbell,
  Target, Shield, Swords, Users,
  Calendar, Newspaper, BarChart3, Flame, Sparkles
} from 'lucide-react';
import type { Player, Event, NewsItem, Member } from '@/pages/Dashboard';
import type { AppUser } from '@/contexts/AuthContext';
import { getNowParis, isEventTerminatedParis } from '@/lib/dateUtils';

interface HomeTabProps {
  currentUser: AppUser | null;
  events: Event[];
  players: Player[];
  news: NewsItem[];
  members: Member[];
  onNavigate: (tab: string, eventId?: string) => void;
}

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatDateLong = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const getCountdown = (dateStr: string, timeStr?: string | null): string | null => {
  const target = new Date(dateStr);
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    target.setHours(h || 0, m || 0, 0, 0);
  } else {
    target.setHours(0, 0, 0, 0);
  }
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `J-${days}`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${mins}min`;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

const HomeTab: React.FC<HomeTabProps> = ({ currentUser, events, players, news, members, onNavigate }) => {
  const isCoach = currentUser && ['admin+', 'admin', 'entraineur'].includes(currentUser.role);

  const now = getNowParis();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const isEventTerminated = (event: Event): boolean => isEventTerminatedParis(event);

  const upcomingEvents = useMemo(() =>
    events
      .filter(e => new Date(e.date) >= today && !isEventTerminated(e))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events]
  );

  const nextMatches = useMemo(() => upcomingEvents.filter(e => e.type === 'match').slice(0, 3), [upcomingEvents]);
  const nextTrainings = useMemo(() => upcomingEvents.filter(e => e.type === 'training').slice(0, 2), [upcomingEvents]);

  const myPlayer = useMemo(() => {
    if (!currentUser?.playerId) return null;
    return players.find(p => p.id === currentUser.playerId) || null;
  }, [players, currentUser]);

  const recentNews = useMemo(() => news.slice(0, 2), [news]);
  const playerIdsWithAccount = useMemo(() => new Set(members.filter(m => m.playerId).map(m => m.playerId)), [members]);
  const totalPlayers = useMemo(() => players.filter(p => playerIdsWithAccount.has(p.id)).length, [players, playerIdsWithAccount]);

  const initials = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const heroMatch = nextMatches[0];
  const heroCountdown = heroMatch ? getCountdown(heroMatch.date, heroMatch.time) : null;
  const heroIsConvoked = !!(currentUser?.playerId && heroMatch?.convocationsPublished && heroMatch?.convocations && (heroMatch.convocations as any)[currentUser.playerId]);
  const heroPublisher = heroMatch?.convocationsPublishedByName || heroMatch?.createdByName;

  const handleMatchClick = (matchId: string) => {
    onNavigate('presences', matchId);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* ── Hero Greeting Card ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 shadow-lg shadow-primary/20">
        {/* Decorative pitch lines */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white" />
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-accent/30 blur-2xl" />
        </div>

        <div className="relative flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border-2 border-white/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="text-base font-black text-white">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">{getGreeting()}</p>
            <h2 className="text-xl font-black text-white leading-tight truncate">
              {currentUser?.name?.split(' ')[0]} 👋
            </h2>
            <p className="text-[11px] text-white/80 mt-0.5 font-medium">
              {isCoach ? `${totalPlayers} joueurs · effectif actif` : 'Prêt à enflammer le terrain ?'}
            </p>
          </div>
        </div>

        {/* Hero next match teaser */}
        {heroMatch && (
          <button
            onClick={() => handleMatchClick(heroMatch.id)}
            className="relative mt-4 w-full text-left bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-accent to-accent/70 shrink-0 shadow-md">
                <Flame size={14} className="text-white" />
                <span className="text-[10px] font-black text-white mt-0.5">{heroCountdown || 'LIVE'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Prochain match</p>
                <h3 className="text-sm font-black text-white truncate">{heroMatch.title}</h3>
                <p className="text-[11px] text-white/80 truncate capitalize">
                  {formatDateLong(heroMatch.date)}{heroMatch.time ? ` · ${heroMatch.time}` : ''}
                </p>
              </div>
              <ChevronRight size={18} className="text-white/60 shrink-0" />
            </div>
            {heroIsConvoked && (
              <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/15 rounded-lg border border-white/20">
                <Sparkles size={11} className="text-white shrink-0" />
                <span className="text-[10px] font-bold text-white truncate">
                  Tu es convoqué{heroPublisher ? <> par <span className="font-black">{heroPublisher}</span></> : ''}
                </span>
              </div>
            )}
          </button>
        )}
      </div>

      {/* ── Personal Stats (any user with a player profile) ── */}
      {myPlayer && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Target, value: myPlayer.goals || 0, label: 'Buts', gradient: 'from-primary/15 to-primary/5', iconColor: 'text-primary' },
            { icon: Swords, value: myPlayer.assists || 0, label: 'Passes', gradient: 'from-accent/15 to-accent/5', iconColor: 'text-accent' },
            { icon: Shield, value: myPlayer.matches || 0, label: 'Matchs', gradient: 'from-muted to-background', iconColor: 'text-foreground/70' },
          ].map((s) => (
            <div key={s.label} className={`relative overflow-hidden bg-gradient-to-br ${s.gradient} border border-border/50 rounded-2xl p-3 text-center`}>
              <s.icon size={18} className={`${s.iconColor} mx-auto mb-1`} strokeWidth={2.5} />
              <div className="text-2xl font-black text-foreground leading-none">{s.value}</div>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Club Stats (coach/admin view) ── */}
      {isCoach && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Users, value: totalPlayers, label: 'Joueurs', gradient: 'from-primary/15 to-primary/5', iconColor: 'text-primary' },
            { icon: Target, value: players.reduce((s, p) => s + (p.goals || 0), 0), label: 'Buts Club', gradient: 'from-accent/15 to-accent/5', iconColor: 'text-accent' },
            { icon: Swords, value: players.reduce((s, p) => s + (p.assists || 0), 0), label: 'Passes Club', gradient: 'from-muted to-background', iconColor: 'text-foreground/70' },
          ].map((s) => (
            <div key={s.label} className={`relative overflow-hidden bg-gradient-to-br ${s.gradient} border border-border/50 rounded-2xl p-3 text-center`}>
              <s.icon size={18} className={`${s.iconColor} mx-auto mb-1`} strokeWidth={2.5} />
              <div className="text-2xl font-black text-foreground leading-none">{s.value}</div>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Next Matches ── */}
      {nextMatches.length > 0 && (
        <div>
          <SectionHeader icon={Trophy} title={`Prochain${nextMatches.length > 1 ? 's' : ''} match${nextMatches.length > 1 ? 's' : ''}`} onAction={() => onNavigate('presences')} actionLabel="Voir tout" />
          <div className="space-y-2.5">
            {nextMatches.map((match) => {
              const myPid = currentUser?.playerId;
              const iAmConvoked = !!(myPid && match.convocationsPublished && match.convocations && (match.convocations as any)[myPid]);
              const publisher = match.convocationsPublishedByName || match.createdByName;
              const cd = getCountdown(match.date, match.time);
              return (
                <button
                  key={match.id}
                  onClick={() => handleMatchClick(match.id)}
                  className="group w-full text-left bg-card border border-border/60 rounded-2xl overflow-hidden active:scale-[0.98] transition-all hover:border-primary/30 hover:shadow-md"
                >
                  {iAmConvoked && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary/15 to-accent/15 border-b border-primary/30 text-[11px] font-bold text-primary">
                      <Shield size={11} className="shrink-0" strokeWidth={2.5} />
                      <span className="truncate">
                        Tu es convoqué{publisher ? <> par <span className="font-black">{publisher}</span></> : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                      {match.homeLogo ? (
                        <img src={match.homeLogo} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'multiply' }} />
                      ) : (
                        <Trophy size={20} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-foreground truncate">{match.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Calendar size={10} /> {formatDate(match.date)}
                        </span>
                        {match.time && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <Clock size={10} /> {match.time}
                          </span>
                        )}
                      </div>
                      {match.location && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <MapPin size={9} /> <span className="truncate max-w-[200px]">{match.location}</span>
                        </span>
                      )}
                    </div>
                    {cd && (
                      <span className="px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[10px] font-black text-accent shrink-0">
                        {cd}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Next Trainings (up to 2) ── */}
      {nextTrainings.length > 0 && (
        <div>
          <SectionHeader icon={Dumbbell} title={`Prochain${nextTrainings.length > 1 ? 's' : ''} entraînement${nextTrainings.length > 1 ? 's' : ''}`} onAction={() => onNavigate('presences')} actionLabel="Voir tout" />
          <div className="space-y-2.5">
            {nextTrainings.map((training) => {
              const cd = getCountdown(training.date, training.time);
              return (
                <button
                  key={training.id}
                  onClick={() => onNavigate('presences', training.id)}
                  className="group w-full text-left bg-card border border-border/60 rounded-2xl p-3.5 active:scale-[0.98] transition-all hover:border-accent/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center shrink-0 border border-accent/10">
                      <Dumbbell size={20} className="text-accent" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-foreground truncate capitalize">{training.title.toLowerCase()}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Calendar size={10} /> {formatDate(training.date)}
                        </span>
                        {training.time && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <Clock size={10} /> {training.time}
                          </span>
                        )}
                      </div>
                      {training.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <MapPin size={10} /> <span className="truncate capitalize">{training.location.toLowerCase()}</span>
                        </span>
                      )}
                    </div>
                    {cd && (
                      <span className="px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[10px] font-black text-accent shrink-0">
                        {cd}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Navigation ── */}
      <div>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { icon: Calendar, label: 'Présences', tab: 'presences', color: 'text-primary', bg: 'from-primary/10 to-primary/5' },
            { icon: Trophy, label: 'Champ.', tab: 'championnat', color: 'text-accent', bg: 'from-accent/10 to-accent/5' },
            { icon: BarChart3, label: 'Stats', tab: 'stats', color: 'text-primary', bg: 'from-primary/10 to-primary/5' },
            { icon: isCoach ? Users : Newspaper, label: isCoach ? 'Effectif' : 'Actus', tab: isCoach ? 'members' : 'news', color: 'text-accent', bg: 'from-accent/10 to-accent/5' },
          ].map((a) => (
            <button
              key={a.tab}
              onClick={() => onNavigate(a.tab)}
              className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl bg-gradient-to-br ${a.bg} border border-border/50 active:scale-95 transition-all hover:shadow-md`}
            >
              <a.icon size={22} className={a.color} strokeWidth={2.5} />
              <span className="text-[10px] font-bold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent News ── */}
      {recentNews.length > 0 && (
        <div>
          <SectionHeader icon={Newspaper} title="Dernières actus" onAction={() => onNavigate('news')} actionLabel="Voir tout" />
          <div className="space-y-2">
            {recentNews.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate('news')}
                className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/60 active:scale-[0.98] transition-all hover:border-accent/30 hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center shrink-0 border border-accent/10">
                  <Newspaper size={16} className="text-accent" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-foreground truncate">{n.title}</h4>
                  <p className="text-[11px] text-muted-foreground truncate">{n.content.slice(0, 60)}</p>
                </div>
                <span className="text-[10px] text-muted-foreground/60 font-semibold shrink-0">{formatDate(n.date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Section Header helper ── */
const SectionHeader: React.FC<{
  icon: React.ElementType;
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ icon: Icon, title, onAction, actionLabel = 'Voir' }) => (
  <div className="flex items-center justify-between mb-2.5 px-1">
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon size={13} className="text-primary" strokeWidth={2.5} />
      </div>
      <span className="text-xs font-black text-foreground tracking-wide uppercase">{title}</span>
    </div>
    {onAction && (
      <button onClick={onAction} className="text-[11px] font-bold text-accent flex items-center gap-0.5 active:scale-95 transition-transform">
        {actionLabel} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

export default React.memo(HomeTab);
