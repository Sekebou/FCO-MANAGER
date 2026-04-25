import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Trophy, Calendar, Clock, MapPin, ChevronDown, ChevronUp, Users, Shield, Lock, Trash2, RefreshCw, X, UserPlus } from 'lucide-react';
import PitchView from './PitchView';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Convocation, Player } from '@/pages/Dashboard';
import type { Championship } from './ChampionnatTab';

export interface MatchSheet {
  id: string;
  eventId?: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  team?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  convocations: Record<string, Convocation>;
  createdAt: string;
  createdBy?: string;
}

interface Props {
  matchSheets: MatchSheet[];
  players: Player[];
  isManager?: boolean;
  championships?: Championship[];
  teamLogoMap?: Record<string, string>;
  onMatchSheetUpdated?: (sheet: MatchSheet) => void;
  onDeleteMatchSheet?: (sheetId: string) => void;
}

const teamColors: Record<string, string> = {
  A: 'bg-primary/15 text-primary border-primary/30',
  B: 'bg-accent/15 text-accent border-accent/30',
  C: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
};

/* ── Swap Player Bottom-Sheet Modal ── */
interface SwapPlayerModalProps {
  swapModal: { sheetId: string; playerId: string; playerName: string; conv: Convocation };
  swapMode: 'list' | 'custom';
  swapSearch: string;
  swapCustomName: string;
  localSheets: MatchSheet[];
  players: Player[];
  onClose: () => void;
  onSwapModeChange: (mode: 'list' | 'custom') => void;
  onSwapSearchChange: (v: string) => void;
  onSwapCustomNameChange: (v: string) => void;
  onSwapPlayer: (id: string, name: string, isVirtual: boolean) => void;
}

const SwapPlayerModal: React.FC<SwapPlayerModalProps> = ({
  swapModal, swapMode, swapSearch, swapCustomName, localSheets, players,
  onClose, onSwapModeChange, onSwapSearchChange, onSwapCustomNameChange, onSwapPlayer,
}) => {
  useBodyScrollLock();
  const containerRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [safeAreaTop, setSafeAreaTop] = useState(0);

  // Read safe-area-inset-top once on mount
  useEffect(() => {
    const el = document.documentElement;
    const raw = getComputedStyle(el).getPropertyValue('--sat').trim();
    if (raw) {
      setSafeAreaTop(parseFloat(raw) || 50);
    } else {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top,50px);pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height;
      document.body.removeChild(probe);
      setSafeAreaTop(h > 0 ? h : 50);
    }
  }, []);

  // Track visual viewport to adapt to virtual keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      setViewportHeight(vv.height);
      const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      setKeyboardInset(inset);
      const isKb = inset > 80 || vv.height < window.innerHeight * 0.82;
      setKeyboardOpen(isKb);
    };

    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Scroll list to top when search changes
  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [swapSearch]);

  const maxH = viewportHeight
    ? `${Math.max(320, viewportHeight - safeAreaTop - 8)}px`
    : '70vh';

  const sheet = localSheets.find(s => s.id === swapModal.sheetId);
  const convokedIds = sheet ? Object.keys(sheet.convocations).filter(id => sheet.convocations[id]?.status === 'convoque') : [];
  const q = swapSearch.toLowerCase().trim();
  const available = players
    .filter(p => !convokedIds.includes(p.id))
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/60 backdrop-blur-md"
      style={{ paddingBottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined }}
      onClick={onClose}
    >
      <motion.div
        ref={containerRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-card w-full rounded-t-2xl border-t border-border shadow-2xl flex flex-col"
        style={{ maxHeight: maxH }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">Remplacer {swapModal.playerName}</h3>
            <p className="text-[10px] text-muted-foreground">N°{swapModal.conv.number || '?'} — {swapModal.conv.position || 'Poste non défini'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Toggle: list / custom */}
        <div className="flex gap-1.5 px-5 pt-3">
          <button
            onClick={() => onSwapModeChange('list')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${swapMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            Joueur inscrit
          </button>
          <button
            onClick={() => onSwapModeChange('custom')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${swapMode === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            Nom libre
          </button>
        </div>

        {swapMode === 'list' ? (
          <>
            {/* Search */}
            <div className="px-5 pt-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={swapSearch}
                  onChange={e => onSwapSearchChange(e.target.value)}
                  onFocus={() => setTimeout(() => searchInputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300)}
                  placeholder="Rechercher un joueur..."
                  className="w-full pl-9 pr-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ fontSize: '16px' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Player list */}
            <div ref={listScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3 space-y-0.5" style={{ paddingBottom: keyboardOpen ? '120px' : undefined }}>
              {available.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {q ? 'Aucun joueur trouvé' : 'Aucun joueur disponible'}
                </p>
              ) : (
                available.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSwapPlayer(p.id, p.name, false)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary active:bg-secondary/80 transition-colors text-left"
                  >
                    <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary shrink-0">
                      {p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.position || 'Non défini'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          /* Custom name input */
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Entrez le nom du joueur remplaçant (même sans compte)</p>
            <input
              value={swapCustomName}
              onChange={e => onSwapCustomNameChange(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ fontSize: '16px' }}
              autoFocus
              maxLength={50}
            />
            <button
              onClick={() => {
                const name = swapCustomName.trim();
                if (!name) { toast.error('Entrez un nom'); return; }
                const virtualId = `virtual_${Date.now()}`;
                onSwapPlayer(virtualId, name, true);
              }}
              disabled={!swapCustomName.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 transition-all"
            >
              Confirmer le remplacement
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const MatchSheetsTab: React.FC<Props> = ({ matchSheets, players, isManager = false, championships = [], teamLogoMap = {}, onMatchSheetUpdated, onDeleteMatchSheet }) => {

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSheets, setLocalSheets] = useState(matchSheets);

  // Keep local state in sync
  React.useEffect(() => {
    setLocalSheets(matchSheets);
  }, [matchSheets]);

  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [swapModal, setSwapModal] = useState<{ sheetId: string; playerId: string; playerName: string; conv: Convocation } | null>(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapCustomName, setSwapCustomName] = useState('');
  const [swapMode, setSwapMode] = useState<'list' | 'custom'>('list');
  const [addModal, setAddModal] = useState<{ sheetId: string } | null>(null);
  const [addSearch, setAddSearch] = useState('');
  const [addMode, setAddMode] = useState<'list' | 'custom'>('list');
  const [addCustomName, setAddCustomName] = useState('');
  useBodyScrollLock(!!swapModal || !!addModal);

  const handleUpdateConvocations = useCallback(async (sheetId: string, updated: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from('match_sheets')
        .update({ convocations: updated as any })
        .eq('id', sheetId);
      if (error) throw error;
      setLocalSheets((prev) => {
        const next = prev.map((ms) => ms.id === sheetId ? { ...ms, convocations: updated } : ms);
        const updatedSheet = next.find((ms) => ms.id === sheetId);
        if (updatedSheet && onMatchSheetUpdated) {
          onMatchSheetUpdated(updatedSheet);
        }
        return next;
      });
      toast.success('Disposition sauvegardée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  }, [onMatchSheetUpdated]);

  const handleRefreshScore = useCallback(async (ms: MatchSheet) => {
    if (ms.homeScore != null && ms.awayScore != null) return;
    setRefreshingId(ms.id);
    try {
      const { data, error } = await supabase.rpc('refresh_match_sheet_score', { p_sheet_id: ms.id });
      if (error) throw error;
      const result = data as any;
      if (result?.already_set) {
        setLocalSheets((prev) => {
          const next = prev.map(s => s.id === ms.id ? { ...s, homeScore: result.home_score, awayScore: result.away_score } : s);
          const updatedSheet = next.find(s => s.id === ms.id);
          if (updatedSheet && onMatchSheetUpdated) onMatchSheetUpdated(updatedSheet);
          return next;
        });
        toast.info('Score déjà enregistré');
        return;
      }
      if (!result?.found) {
        toast.info('Score pas encore disponible pour ce match');
        return;
      }
      setLocalSheets((prev) => {
        const next = prev.map(s => s.id === ms.id ? { ...s, homeScore: result.home_score, awayScore: result.away_score } : s);
        const updatedSheet = next.find(s => s.id === ms.id);
        if (updatedSheet && onMatchSheetUpdated) onMatchSheetUpdated(updatedSheet);
        return next;
      });
      toast.success('Score mis à jour !');
    } catch {
      toast.error('Erreur lors de la récupération du score');
    } finally {
      setRefreshingId(null);
    }
  }, [onMatchSheetUpdated]);

  const handleSwapPlayer = useCallback(async (replacementId: string, replacementName: string, isVirtual: boolean) => {
    if (!swapModal) return;
    const { sheetId, playerId, conv } = swapModal;
    try {
      const sheet = localSheets.find(s => s.id === sheetId);
      if (!sheet) return;
      const updatedConvocations = { ...sheet.convocations };
      // Remove old player
      delete updatedConvocations[playerId];
      // Add replacement with same number/position/coords
      const newConv: Convocation = {
        status: 'convoque',
        number: conv.number,
        position: conv.position,
        customX: conv.customX,
        customY: conv.customY,
        ...(isVirtual ? { virtualName: replacementName } : {}),
      };
      updatedConvocations[replacementId] = newConv;

      const { error } = await supabase
        .from('match_sheets')
        .update({ convocations: updatedConvocations as any })
        .eq('id', sheetId);
      if (error) throw error;

      setLocalSheets((prev) => {
        const next = prev.map(s => s.id === sheetId ? { ...s, convocations: updatedConvocations } : s);
        const updatedSheet = next.find(s => s.id === sheetId);
        if (updatedSheet && onMatchSheetUpdated) onMatchSheetUpdated(updatedSheet);
        return next;
      });
      toast.success(`${replacementName} remplace le joueur`);
      setSwapModal(null);
      setSwapSearch('');
      setSwapCustomName('');
      setSwapMode('list');
    } catch {
      toast.error('Erreur lors du remplacement');
    }
  }, [swapModal, localSheets, onMatchSheetUpdated]);

  const now = new Date();

  // Build a logo lookup from championships teamLogos + event-based teamLogoMap
  const getTeamLogo = (teamName: string): string | null => {
    if (!teamName) return null;
    // Check teamLogoMap from events first
    const upper = teamName.toUpperCase();
    if (teamLogoMap[upper]) return teamLogoMap[upper];
    if (teamLogoMap[teamName]) return teamLogoMap[teamName];
    // Fallback to championships
    for (const champ of championships) {
      if (!champ.teamLogos) continue;
      const logo = champ.teamLogos[upper] || champ.teamLogos[teamName];
      if (logo) return logo;
    }
    return null;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sorted = [...localSheets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!q) return sorted;
    return sorted.filter(ms =>
      ms.title.toLowerCase().includes(q) ||
      ms.homeTeam?.toLowerCase().includes(q) ||
      ms.awayTeam?.toLowerCase().includes(q) ||
      ms.date.includes(q) ||
      ms.team?.toLowerCase().includes(q)
    );
  }, [localSheets, search]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Feuilles de match</h2>
          <p className="text-xs text-muted-foreground">{matchSheets.length} feuille{matchSheets.length > 1 ? 's' : ''} archivée{matchSheets.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par adversaire, date..."
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Shield className="mx-auto mb-3 text-muted-foreground" size={48} />
          <p className="text-muted-foreground font-medium">
            {search ? 'Aucun résultat' : 'Aucune feuille de match'}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {search ? 'Essayez une autre recherche' : 'Les compositions seront archivées ici après publication'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ms => {
            const isExpanded = expandedId === ms.id;
            // Unlock 1h after match start (date + time), using Europe/Paris timezone
            // If no time is set but date is past → unlock automatically
            let isLocked = !isManager;
            let matchEnded = false; // true when 2h+ after kickoff → reload allowed
            if (ms.date) {
              const parisFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Europe/Paris',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false,
              });
              const parts = parisFormatter.formatToParts(now);
              const pv = (t: string) => parts.find(p => p.type === t)?.value || '00';
              const parisNowMinutes = parseInt(pv('hour')) * 60 + parseInt(pv('minute'));
              const parisNowDate = `${pv('year')}-${pv('month')}-${pv('day')}`;

              if (parisNowDate > ms.date) {
                isLocked = false;
                matchEnded = true;
              } else if (parisNowDate === ms.date) {
                if (ms.time) {
                  const [mH, mM] = ms.time.split(':').map(Number);
                  const unlockMinutes = mH * 60 + mM + 60; // 1h for composition unlock
                  const scoreMinutes = mH * 60 + mM + 120; // 2h for score reload
                  isLocked = !isManager && parisNowMinutes < unlockMinutes;
                  matchEnded = parisNowMinutes >= scoreMinutes;
                }
              }
            }
            const hasScore = ms.homeScore != null && ms.awayScore != null;
            const hasConvocations = Object.values(ms.convocations).some(c => c.status === 'convoque');

            // Parse home/away from title if awayTeam is missing
            let resolvedHome = ms.homeTeam || null;
            let resolvedAway = ms.awayTeam || null;
            if (!resolvedAway && ms.title) {
              const vsParts = ms.title.split(/\s+vs\s+/i);
              if (vsParts.length === 2) {
                resolvedHome = vsParts[0].trim();
                resolvedAway = vsParts[1].trim();
              }
            }

            const hasVs = resolvedHome && resolvedAway;

            // Resolve logos: match sheet → event logo map → championship lookup
            const homeLogo = ms.homeLogo || (resolvedHome ? getTeamLogo(resolvedHome) : null);
            const awayLogo = ms.awayLogo || (resolvedAway ? getTeamLogo(resolvedAway) : null);

            const convokedPlayers = Object.entries(ms.convocations)
              .filter(([, c]) => c.status === 'convoque')
              .map(([playerId, conv]) => {
                const player = players.find(p => p.id === playerId);
                const name = conv.virtualName || player?.name || 'Joueur supprimé';
                return { id: playerId, name, conv };
              })
              .filter(Boolean) as { id: string; name: string; conv: Convocation }[];

            const starters = convokedPlayers.filter(p => !p.conv.number || p.conv.number <= 11);
            const substitutes = convokedPlayers.filter(p => p.conv.number != null && p.conv.number >= 12);

            return (
              <div
                key={ms.id}
                className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ms.id)}
                  className="w-full text-left relative"
                >
                  {/* Gradient accent strip */}
                  <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

                  {/* Top meta bar */}
                  <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ms.team && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${teamColors[ms.team] || 'bg-muted text-muted-foreground border-border'}`}>
                          Équipe {ms.team?.replace(/^Équipe\s*/i, '')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Calendar size={10} /> {formatDate(ms.date)}
                      </span>
                      {ms.time && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Clock size={10} /> {ms.time}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Friendly match label */}
                  {hasVs && ms.title.toLowerCase().includes('amical') && (
                    <div className="px-4 -mb-1">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Match amical
                      </span>
                    </div>
                  )}

                  {hasVs ? (
                    /* ── VS Layout ── */
                    <div className="flex items-center justify-between px-4 py-3">
                      {/* Home */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden ${homeLogo ? 'bg-white keep-white border border-border/50 p-1' : ''}`}>
                          {homeLogo ? (
                            <img src={homeLogo} alt={resolvedHome || ''} className="w-12 h-12 object-contain" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
                              <span className="text-[10px] font-black text-muted-foreground/60 text-center leading-none">{(resolvedHome || '?').slice(0, 3).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 capitalize max-w-[100px]">
                          {resolvedHome?.toLowerCase()}
                        </span>
                      </div>

                      {/* Score or VS */}
                      <div className="shrink-0 mx-1 flex flex-col items-center gap-1">
                        {hasScore ? (
                          <div className="flex items-center gap-2 bg-gradient-to-br from-secondary to-muted rounded-2xl px-4 py-2.5 shadow-sm">
                            <span className="text-2xl font-black text-foreground">{ms.homeScore}</span>
                            <span className="text-sm text-muted-foreground font-bold">-</span>
                            <span className="text-2xl font-black text-foreground">{ms.awayScore}</span>
                          </div>
                        ) : ms.team && matchEnded ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRefreshScore(ms); }}
                            disabled={refreshingId === ms.id}
                            className="flex flex-col items-center gap-1 group"
                          >
                            <RefreshCw size={16} className={`text-primary group-hover:text-primary/80 transition-colors ${refreshingId === ms.id ? 'animate-spin' : ''}`} />
                            <span className="text-[9px] font-bold text-primary/70">Score</span>
                          </button>
                        ) : (
                          <span className="text-xs font-black text-muted-foreground tracking-widest">VS</span>
                        )}
                      </div>

                      {/* Away */}
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden ${awayLogo ? 'bg-white keep-white border border-border/50 p-1' : ''}`}>
                          {awayLogo ? (
                            <img src={awayLogo} alt={resolvedAway || ''} className="w-12 h-12 object-contain" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
                              <span className="text-[10px] font-black text-muted-foreground/60 text-center leading-none">{(resolvedAway || '?').slice(0, 3).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-foreground text-center leading-tight line-clamp-2 capitalize max-w-[100px]">
                          {resolvedAway?.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Trophy size={20} className="text-primary" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground truncate flex-1">{ms.title}</h3>
                    </div>
                  )}

                  {/* Bottom bar: location + status badge */}
                  <div className="flex items-center justify-between px-4 pb-3 -mt-0.5">
                    <div className="flex items-center gap-2">
                      {ms.location && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin size={9} /> <span className="truncate capitalize max-w-[140px]">{ms.location.toLowerCase()}</span>
                        </span>
                      )}
                    </div>
                    {/* Status badge: orange locked / green available */}
                    {hasConvocations && (
                      <div className="flex items-center gap-1.5">
                        {isLocked ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">
                              Composition après match
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">
                              Composition disponible
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.3 }, opacity: { duration: 0.25, delay: 0.05 } } }}
                      exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.25 }, opacity: { duration: 0.15 } } }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className={`p-4 relative ${isLocked ? 'select-none' : ''}`}>
                        {isLocked && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm rounded-b-2xl">
                            <Lock size={28} className="text-muted-foreground mb-2" />
                            <p className="text-sm font-semibold text-muted-foreground">Composition verrouillée</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">Disponible après le match</p>
                          </div>
                        )}

                        <div className={isLocked ? 'filter blur-md' : ''}>
                          {convokedPlayers.length > 0 ? (
                            <PitchView
                              convocations={ms.convocations}
                              players={players}
                              isManager={isManager}
                              onUpdateConvocations={(updated) => handleUpdateConvocations(ms.id, updated)}
                              onSwapPlayer={isManager ? (playerId, playerName, conv) => {
                                setSwapModal({ sheetId: ms.id, playerId, playerName, conv });
                                setSwapSearch('');
                                setSwapCustomName('');
                                setSwapMode('list');
                              } : undefined}
                            />
                          ) : (
                            <div className="text-center py-8">
                              <Users size={32} className="mx-auto text-muted-foreground/50 mb-2" />
                              <p className="text-sm text-muted-foreground">Aucun joueur convoqué</p>
                            </div>
                          )}


                          <div className="my-4 flex items-center gap-3">
                            <Separator className="flex-1" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Infos match</span>
                            <Separator className="flex-1" />
                          </div>

                          <div className="space-y-2">
                            {hasScore && hasVs && (
                              <div className="flex items-center justify-center gap-3 py-2">
                                <div className="flex items-center gap-2">
                                  {homeLogo && <img src={homeLogo} alt="" className="w-5 h-5 object-contain" />}
                                  <span className="text-xs font-semibold text-foreground truncate max-w-[80px]">{resolvedHome}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-1.5">
                                  <span className="text-lg font-black text-foreground">{ms.homeScore}</span>
                                  <span className="text-xs text-muted-foreground">-</span>
                                  <span className="text-lg font-black text-foreground">{ms.awayScore}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground truncate max-w-[80px]">{resolvedAway}</span>
                                  {awayLogo && <img src={awayLogo} alt="" className="w-5 h-5 object-contain" />}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-1.5">
                              {ms.location && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                                  <MapPin size={12} className="shrink-0" />
                                  <span className="truncate">{ms.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar size={12} /> {formatDate(ms.date)}
                                </span>
                                {ms.time && (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Clock size={12} /> {ms.time}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                                <Users size={12} className="shrink-0" />
                                <span>
                                  {starters.length} titulaire{starters.length > 1 ? 's' : ''}
                                  {substitutes.length > 0 && ` + ${substitutes.length} remplaçant${substitutes.length > 1 ? 's' : ''}`}
                                </span>
                              </div>
                            </div>

                            {/* Delete button for managers */}
                            {isManager && onDeleteMatchSheet && (
                              <button
                                onClick={() => onDeleteMatchSheet(ms.id)}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all"
                              >
                                <Trash2 size={14} /> Supprimer cette feuille
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Swap Modal — bottom-sheet optimized for mobile keyboard */}
      <AnimatePresence>
        {swapModal && (
          <SwapPlayerModal
            swapModal={swapModal}
            swapMode={swapMode}
            swapSearch={swapSearch}
            swapCustomName={swapCustomName}
            localSheets={localSheets}
            players={players}
            onClose={() => setSwapModal(null)}
            onSwapModeChange={setSwapMode}
            onSwapSearchChange={setSwapSearch}
            onSwapCustomNameChange={setSwapCustomName}
            onSwapPlayer={handleSwapPlayer}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(MatchSheetsTab);
