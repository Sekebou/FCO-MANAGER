import React, { useMemo } from 'react';
import {
  ChevronRight, Clock, MapPin, Trophy, Dumbbell,
  Target, Shield, Swords, Users,
  Calendar, Newspaper, BarChart3, Bell
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

const getDayParts = (d: string) => {
  const date = new Date(d);
  return {
    day: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
    num: date.getDate().toString().padStart(2, '0'),
  };
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

/* ──────────────── Bento Glass HomeTab — Saison 2026 ──────────────── */
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

  const nextMatch = useMemo(() => upcomingEvents.find(e => e.type === 'match') || null, [upcomingEvents]);
  const otherMatches = useMemo(() => upcomingEvents.filter(e => e.type === 'match').slice(1, 3), [upcomingEvents]);
  const nextTrainings = useMemo(() => upcomingEvents.filter(e => e.type === 'training').slice(0, 2), [upcomingEvents]);

  const myPlayer = useMemo(() => {
    if (!currentUser?.playerId) return null;
    return players.find(p => p.id === currentUser.playerId) || null;
  }, [players, currentUser]);

  const recentNews = useMemo(() => news.slice(0, 2), [news]);
  const playerIdsWithAccount = useMemo(() => new Set(members.filter(m => m.playerId).map(m => m.playerId)), [members]);
  const totalPlayers = useMemo(() => players.filter(p => playerIdsWithAccount.has(p.id)).length, [players, playerIdsWithAccount]);

  const initials = currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const firstName = currentUser?.name?.split(' ')[0] || '';

  const myConvoked = nextMatch && currentUser?.playerId && nextMatch.convocationsPublished
    && nextMatch.convocations && (nextMatch.convocations as any)[currentUser.playerId];

  // Stats bento : si joueur → perso ; sinon → club
  const bentoStats = myPlayer
    ? [
        { label: 'Buts', value: myPlayer.goals || 0, icon: Target },
        { label: 'Passes', value: myPlayer.assists || 0, icon: Swords },
        { label: 'Matchs', value: myPlayer.matches || 0, icon: Shield },
      ]
    : isCoach
    ? [
        { label: 'Joueurs', value: totalPlayers, icon: Users },
        { label: 'Buts Club', value: players.reduce((s, p) => s + (p.goals || 0), 0), icon: Target },
        { label: 'Passes Club', value: players.reduce((s, p) => s + (p.assists || 0), 0), icon: Swords },
      ]
    : null;

  return (
    /* Breakout : casse le padding parent du Dashboard pour fond immersif full-bleed */
    <div className="-mx-3 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-10 bg-[#050a1f] text-white min-h-[calc(100vh-120px)] relative overflow-hidden">
      {/* Halos d'ambiance */}
      <div className="absolute top-[-120px] left-[-80px] w-[340px] h-[340px] rounded-full bg-[#0e2ba0]/40 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-100px] w-[300px] h-[300px] rounded-full bg-[#3b82f6]/20 blur-[120px] pointer-events-none" />

      <div className="relative z-10 px-5 pt-5 pb-28 space-y-6 font-['Epilogue']">

        {/* ── Header — avatar + greeting + bell ── */}
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0e2ba0] to-[#3b82f6] border border-white/20 p-0.5 shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#050a1f] flex items-center justify-center">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-sm font-black text-white">{initials}</span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 uppercase tracking-[0.18em] font-bold leading-none">{getGreeting()}</p>
              <h2 className="font-['Urbanist'] font-extrabold text-lg tracking-tight truncate mt-1">{firstName}</h2>
            </div>
          </div>
          <button
            onClick={() => onNavigate('news')}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl active:scale-95 transition-all"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-white/70" strokeWidth={2} />
          </button>
        </header>

        {/* ── Hero : Prochain match ── */}
        {nextMatch ? (
          <section>
            <div className="relative group">
              <div className="absolute inset-0 bg-[#0e2ba0] blur-3xl opacity-25 pointer-events-none" />
              <button
                onClick={() => onNavigate('presences', nextMatch.id)}
                className="relative w-full text-left overflow-hidden rounded-[28px] bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/15 backdrop-blur-xl p-5 active:scale-[0.99] transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <span className="px-3 py-1 rounded-full bg-[#0e2ba0] text-[10px] font-black tracking-wider uppercase">
                    Prochain match
                  </span>
                  <div className="text-right">
                    <p className="text-xs font-bold capitalize">{formatDate(nextMatch.date)}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      {nextMatch.time || '—'}{nextMatch.location ? ` · ${nextMatch.location.split(',')[0]}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-around gap-2">
                  {(() => {
                    const parts = nextMatch.title.split(/\s+(?:vs\.?|-)\s+/i);
                    const home = parts[0]?.trim() || 'FCO';
                    const away = parts[1]?.trim() || nextMatch.title;
                    return (
                      <>
                        <div className="flex flex-col items-center flex-1 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 overflow-hidden shrink-0">
                            {nextMatch.homeLogo ? (
                              <img src={nextMatch.homeLogo} alt="" className="w-12 h-12 object-contain" />
                            ) : (
                              <Trophy size={26} className="text-white/70" />
                            )}
                          </div>
                          <span className="text-[11px] font-bold tracking-tight uppercase truncate max-w-[110px]">{home}</span>
                        </div>

                        <div className="flex flex-col items-center px-2">
                          {getCountdown(nextMatch.date, nextMatch.time) ? (
                            <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-black tracking-wider">
                              {getCountdown(nextMatch.date, nextMatch.time)}
                            </div>
                          ) : (
                            <div className="text-xs font-black text-white/20 italic">VS</div>
                          )}
                          <div className="h-6 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent mt-2" />
                        </div>

                        <div className="flex flex-col items-center flex-1 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 overflow-hidden shrink-0">
                            {nextMatch.awayLogo ? (
                              <img src={nextMatch.awayLogo} alt="" className="w-12 h-12 object-contain" />
                            ) : (
                              <Trophy size={26} className="text-white/40" />
                            )}
                          </div>
                          <span className="text-[11px] font-bold tracking-tight uppercase truncate max-w-[110px]">{away}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {myConvoked && (
                  <div className="mt-5 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30">
                    <Shield size={13} className="text-[#7dd3fc] shrink-0" strokeWidth={2.5} />
                    <span className="text-[11px] font-bold text-[#bfdbfe]">Tu es convoqué pour ce match</span>
                  </div>
                )}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-[28px] bg-white/[0.04] border border-white/10 backdrop-blur-xl p-6 text-center">
            <Trophy size={28} className="text-white/30 mx-auto mb-2" />
            <p className="text-sm font-bold text-white/80">Aucun match programmé</p>
            <p className="text-[11px] text-white/40 mt-1">La nouvelle saison arrive bientôt</p>
          </section>
        )}

        {/* ── Bento Stats Grid ── */}
        {bentoStats && (
          <section className="grid grid-cols-3 gap-3">
            {bentoStats.map((s) => (
              <div
                key={s.label}
                className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden"
              >
                <div className="w-7 h-7 rounded-lg bg-[#3b82f6]/15 flex items-center justify-center mb-3">
                  <s.icon size={14} className="text-[#7dd3fc]" strokeWidth={2.5} />
                </div>
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1 truncate">{s.label}</p>
                <p className="text-xl font-['Urbanist'] font-extrabold tracking-tight">{s.value}</p>
              </div>
            ))}
          </section>
        )}

        {/* ── Dernier résultat / autres matchs à venir ── */}
        {otherMatches.length > 0 && (
          <button
            onClick={() => onNavigate('presences')}
            className="w-full text-left bg-gradient-to-r from-[#0e2ba0]/40 to-white/[0.04] border border-white/10 rounded-2xl p-4 backdrop-blur-sm flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 font-bold uppercase mb-1 tracking-wider">À venir aussi</p>
              <p className="text-sm font-bold font-['Urbanist'] truncate">
                {otherMatches.length} match{otherMatches.length > 1 ? 's' : ''} · {formatDate(otherMatches[0].date)}
              </p>
            </div>
            <span className="text-xs font-bold text-[#7dd3fc] shrink-0 ml-2">VOIR TOUT →</span>
          </button>
        )}

        {/* ── Entraînements ── */}
        {nextTrainings.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-['Urbanist'] font-extrabold text-lg tracking-tight">Entraînements</h3>
              <button
                onClick={() => onNavigate('presences')}
                className="text-[10px] font-bold text-[#0e2ba0] bg-white rounded-full px-2.5 py-1 active:scale-95 transition-all"
              >
                CETTE SEMAINE
              </button>
            </div>
            <div className="space-y-3">
              {nextTrainings.map((t, idx) => {
                const { day, num } = getDayParts(t.date);
                const cd = getCountdown(t.date, t.time);
                return (
                  <button
                    key={t.id}
                    onClick={() => onNavigate('presences', t.id)}
                    className={`w-full text-left flex items-center gap-4 p-4 bg-white/[0.04] rounded-2xl border border-white/10 active:scale-[0.99] transition-all ${idx > 0 ? 'opacity-70' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-white/5 rounded-xl border border-white/10 shrink-0">
                      <span className="text-[9px] text-white/50 font-bold uppercase tracking-tighter">{day}</span>
                      <span className="text-sm font-black font-['Urbanist']">{num}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold tracking-tight truncate capitalize">{t.title.toLowerCase()}</h4>
                      <p className="text-[11px] text-white/40 font-medium truncate mt-0.5">
                        {t.time || '—'}{t.location ? ` · ${t.location.split(',')[0]}` : ''}
                      </p>
                    </div>
                    {cd && idx === 0 ? (
                      <div className="h-2 w-2 rounded-full bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.7)] shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-white/30 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Quick Navigation ── */}
        <section>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Calendar, label: 'Présences', tab: 'presences' },
              { icon: Trophy, label: 'Champ.', tab: 'championnat' },
              { icon: BarChart3, label: 'Stats', tab: 'stats' },
              { icon: isCoach ? Users : Newspaper, label: isCoach ? 'Effectif' : 'Actus', tab: isCoach ? 'members' : 'news' },
            ].map((a) => (
              <button
                key={a.tab}
                onClick={() => onNavigate(a.tab)}
                className="flex flex-col items-center gap-2 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm active:scale-95 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-[#3b82f6]/15 flex items-center justify-center">
                  <a.icon size={18} className="text-[#7dd3fc]" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{a.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Recent News ── */}
        {recentNews.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-['Urbanist'] font-extrabold text-lg tracking-tight">Actus</h3>
              <button onClick={() => onNavigate('news')} className="text-[11px] font-bold text-[#7dd3fc] active:scale-95 transition-all">
                VOIR TOUT →
              </button>
            </div>
            <div className="space-y-2.5">
              {recentNews.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onNavigate('news')}
                  className="w-full text-left flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm active:scale-[0.99] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/15 flex items-center justify-center shrink-0 border border-white/5">
                    <Newspaper size={16} className="text-[#7dd3fc]" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold truncate">{n.title}</h4>
                    <p className="text-[11px] text-white/40 truncate mt-0.5">{n.content.slice(0, 60)}</p>
                  </div>
                  <span className="text-[10px] text-white/30 font-semibold shrink-0">{formatDate(n.date)}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default React.memo(HomeTab);
