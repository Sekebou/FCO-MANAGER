import React, { useMemo } from 'react';
import {
  ChevronRight, Clock, MapPin, Trophy, Dumbbell,
  Target, Shield, Swords, Users,
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

  const now = new Date();
  const upcomingEvents = useMemo(() =>
    events
      .filter(e => new Date(e.date) >= now)
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
  const totalPlayers = players.length;

  const initials = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

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

      {/* ── Player Stats (joueur only) ── */}
      {!isCoach && myPlayer && (
        <div className="grid grid-cols-3 gap-2.5">
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
        </div>
      )}

      {/* ── Coach Stats ── */}
      {isCoach && (
        <div className="grid grid-cols-3 gap-2.5">
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
        </div>
      )}

      {/* ── Next Matches (VS style with logos) ── */}
      {nextMatches.length > 0 && (
        <div>
          <SectionHeader icon={Trophy} title={`Prochain${nextMatches.length > 1 ? 's' : ''} match${nextMatches.length > 1 ? 's' : ''}`} onAction={() => onNavigate('presences')} actionLabel="Voir tout" />
          <div className="space-y-2.5">
            {nextMatches.map((match) => {
              // Parse teams from title (format: "Team A - Team B" or just title)
              const titleParts = match.title.split(/\s*[-–]\s*/);
              const homeTeam = titleParts[0]?.trim() || match.title;
              const awayTeam = titleParts[1]?.trim() || '';
              const hasVs = awayTeam.length > 0;

              return (
                <button
                  key={match.id}
                  onClick={() => onNavigate('presences', match.id)}
                  className="w-full bg-card border border-border/50 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
                >
                  {/* Top bar with date/time/team badge */}
                  <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Calendar size={10} /> {formatDate(match.date)}
                      </span>
                      {match.time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Clock size={10} /> {match.time}
                        </span>
                      )}
                    </div>
                    {match.team && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary">{match.team}</span>
                    )}
                  </div>

                  {hasVs ? (
                    /* ── VS Layout with logos ── */
                    <div className="flex items-center justify-between px-3.5 py-3">
                      {/* Home team */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-primary/5 border border-border/30 flex items-center justify-center overflow-hidden">
                          {match.homeLogo ? (
                            <img src={match.homeLogo} alt="" className="w-9 h-9 object-contain" />
                          ) : (
                            <Shield size={22} className="text-primary/40" />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 capitalize max-w-[90px]">
                          {homeTeam.toLowerCase()}
                        </span>
                      </div>

                      {/* VS badge */}
                      <div className="shrink-0 mx-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                          <span className="text-xs font-black text-primary tracking-tight">VS</span>
                        </div>
                      </div>

                      {/* Away team */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-primary/5 border border-border/30 flex items-center justify-center overflow-hidden">
                          {match.awayLogo ? (
                            <img src={match.awayLogo} alt="" className="w-9 h-9 object-contain" />
                          ) : (
                            <Shield size={22} className="text-muted-foreground/40" />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 capitalize max-w-[90px]">
                          {awayTeam.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* ── Simple layout (no VS) ── */
                    <div className="flex items-center gap-3 px-3.5 py-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        {match.homeLogo ? (
                          <img src={match.homeLogo} alt="" className="w-7 h-7 object-contain rounded" />
                        ) : (
                          <Trophy size={18} className="text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate capitalize">{match.title.toLowerCase()}</h3>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                    </div>
                  )}

                  {/* Location bar */}
                  {match.location && (
                    <div className="px-3.5 pb-2.5 -mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin size={9} /> <span className="truncate capitalize">{match.location.toLowerCase()}</span>
                      </span>
                    </div>
                  )}
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
