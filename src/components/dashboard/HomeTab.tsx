import React, { useMemo } from 'react';
import {
  ChevronRight, Clock, MapPin, Trophy, Dumbbell,
  Target, Shield, Swords, Users,
  Calendar, Newspaper, BarChart3
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
  const todayStr = now.toLocaleDateString('en-CA');

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

  const handleMatchClick = (matchId: string) => {
    onNavigate('presences', matchId);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* ── Greeting Header ── */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
      </div>

      {/* ── Personal Stats (any user with a player profile) ── */}
      {myPlayer && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Target, value: myPlayer.goals || 0, label: 'Mes Buts', color: 'text-primary' },
            { icon: Swords, value: myPlayer.assists || 0, label: 'Mes Passes', color: 'text-accent' },
            { icon: Shield, value: myPlayer.matches || 0, label: 'Mes Matchs', color: 'text-muted-foreground' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
              <s.icon size={16} className={`${s.color} mx-auto mb-1 opacity-70`} />
              <div className="text-xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Club Stats (coach/admin view) ── */}
      {isCoach && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Users, value: totalPlayers, label: 'Joueurs', color: 'text-primary' },
            { icon: Target, value: players.reduce((s, p) => s + (p.goals || 0), 0), label: 'Buts Club', color: 'text-accent' },
            { icon: Swords, value: players.reduce((s, p) => s + (p.assists || 0), 0), label: 'Passes Club', color: 'text-muted-foreground' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
              <s.icon size={16} className={`${s.color} mx-auto mb-1 opacity-70`} />
              <div className="text-xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Next Matches ── */}
      {nextMatches.length > 0 && (
        <div>
          <SectionHeader icon={Trophy} title={`Prochain${nextMatches.length > 1 ? 's' : ''} match${nextMatches.length > 1 ? 's' : ''}`} onAction={() => onNavigate('presences')} actionLabel="Voir tout" />
          <div className="space-y-2">
            {nextMatches.map((match) => {
              const myPid = currentUser?.playerId;
              const iAmConvoked = !!(myPid && match.convocationsPublished && match.convocations && (match.convocations as any)[myPid]);
              const publisher = match.convocationsPublishedByName || match.createdByName;
              return (
              <button
                key={match.id}
                onClick={() => handleMatchClick(match.id)}
                className="w-full text-left bg-card border border-border/50 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
              >
                {iAmConvoked && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary/15 to-accent/15 border-b border-primary/30 text-[11px] font-bold text-primary">
                    <Shield size={11} className="shrink-0" />
                    <span className="truncate">
                      Tu es convoqué{publisher ? <> par <span className="font-black">{publisher}</span></> : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {match.homeLogo ? (
                      <img src={match.homeLogo} alt="" className="w-7 h-7 object-contain" style={{ mixBlendMode: 'multiply' }} />
                    ) : (
                      <Trophy size={18} className="text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{match.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar size={10} /> {formatDate(match.date)}
                      </span>
                      {match.time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
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
          <div className="space-y-2">
            {nextTrainings.map((training) => (
              <button
                key={training.id}
                onClick={() => onNavigate('presences', training.id)}
                className="w-full text-left bg-card border border-border/50 rounded-2xl p-3.5 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Dumbbell size={18} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate capitalize">{training.title.toLowerCase()}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar size={10} /> {formatDate(training.date)}
                      </span>
                      {training.time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
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
                  <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Navigation ── */}
      <div>
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
  <div className="flex items-center justify-between mb-2 px-0.5">
    <div className="flex items-center gap-1.5">
      <Icon size={14} className="text-primary" />
      <span className="text-xs font-bold text-foreground tracking-wide">{title}</span>
    </div>
    {onAction && (
      <button onClick={onAction} className="text-[11px] font-semibold text-accent flex items-center gap-0.5">
        {actionLabel} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

export default React.memo(HomeTab);
