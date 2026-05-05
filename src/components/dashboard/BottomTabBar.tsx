import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Bell, Trophy, Ticket, Camera, ClipboardCheck,
  TrendingUp, Calendar, UserCheck, Tv, Plus, X,
  Settings2, GripVertical, ArrowLeftRight, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const allTabs: Tab[] = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'presences', label: 'Présences', icon: ClipboardCheck },
  { id: 'matchsheets', label: 'F. Match', icon: Shield },
  { id: 'championnat', label: 'Champ', icon: Trophy },
  { id: 'paris', label: 'Paris', icon: Ticket },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'stats', label: 'Stats', icon: TrendingUp },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'members', label: 'Membres', icon: UserCheck },
  { id: 'tv', label: 'FCO TV', icon: Tv },
];

const DEFAULT_BOTTOM_IDS = ['home', 'presences', 'championnat', 'paris'];
const STORAGE_KEY = 'fco_bottom_tabs';
const BOTTOM_COUNT = 4;

function loadBottomIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      // Validate: must be exactly 4 valid tab ids
      const validIds = allTabs.map(t => t.id);
      const filtered = ids.filter(id => validIds.includes(id));
      if (filtered.length === BOTTOM_COUNT && new Set(filtered).size === BOTTOM_COUNT) {
        return filtered;
      }
    }
  } catch {}
  return DEFAULT_BOTTOM_IDS;
}

function saveBottomIds(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadDiscussions?: number;
}

const BottomTabBar = ({ activeTab, onTabChange, unreadDiscussions = 0 }: BottomTabBarProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bottomIds, setBottomIds] = useState<string[]>(loadBottomIds);
  const [swapSource, setSwapSource] = useState<string | null>(null);

  const bottomTabs = useMemo(() => bottomIds.map(id => allTabs.find(t => t.id === id)!), [bottomIds]);
  const moreTabs = useMemo(() => allTabs.filter(t => !bottomIds.includes(t.id)), [bottomIds]);

  const isActiveInMore = moreTabs.some(t => t.id === activeTab);

  const handleTap = useCallback((tabId: string) => {
    if (editMode) return;
    if (tabId === activeTab && !moreOpen) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
    setMoreOpen(false);
  }, [activeTab, onTabChange, moreOpen, editMode]);

  // Swap logic: tap a bottom tab, then tap a "more" tab to swap them
  const handleSwap = useCallback((tappedId: string, isFromMore: boolean) => {
    if (!editMode) return;
    if ('vibrate' in navigator) navigator.vibrate(10);

    if (!swapSource) {
      // First tap — select source
      setSwapSource(tappedId);
      return;
    }

    // Second tap — perform swap
    const sourceIsBottom = bottomIds.includes(swapSource);
    const targetIsBottom = bottomIds.includes(tappedId);

    if (swapSource === tappedId) {
      // Deselect
      setSwapSource(null);
      return;
    }

    // If both are from the same zone, reorder within bottom bar
    if (sourceIsBottom && targetIsBottom) {
      const newIds = [...bottomIds];
      const srcIdx = newIds.indexOf(swapSource);
      const tgtIdx = newIds.indexOf(tappedId);
      [newIds[srcIdx], newIds[tgtIdx]] = [newIds[tgtIdx], newIds[srcIdx]];
      setBottomIds(newIds);
      saveBottomIds(newIds);
      setSwapSource(null);
      return;
    }

    // Swap between bottom and more
    if (sourceIsBottom && !targetIsBottom) {
      const newIds = bottomIds.map(id => id === swapSource ? tappedId : id);
      setBottomIds(newIds);
      saveBottomIds(newIds);
      setSwapSource(null);
      return;
    }

    if (!sourceIsBottom && targetIsBottom) {
      const newIds = bottomIds.map(id => id === tappedId ? swapSource : id);
      setBottomIds(newIds);
      saveBottomIds(newIds);
      setSwapSource(null);
      return;
    }

    // Both from more — just deselect
    setSwapSource(null);
  }, [editMode, swapSource, bottomIds]);

  // Exit edit mode when closing more panel
  useEffect(() => {
    if (!moreOpen) {
      setEditMode(false);
      setSwapSource(null);
    }
  }, [moreOpen]);

  // Lock body scroll when more panel is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [moreOpen]);

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-black/50 touch-none"
            style={{ WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', overscrollBehavior: 'none' }}
            onClick={() => setMoreOpen(false)}
            onTouchMove={(e) => e.preventDefault()}
          />
        )}
      </AnimatePresence>

      {/* More panel */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl overflow-hidden touch-none"
            onTouchMove={(e) => e.stopPropagation()}
            style={{
              background: 'hsl(var(--card))',
              boxShadow: '0 -8px 40px -8px hsl(var(--primary) / 0.2)',
              maxHeight: '70vh',
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-base font-bold text-foreground">Plus</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditMode(!editMode); setSwapSource(null); }}
                  className={cn(
                    "h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-90",
                    editMode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <ArrowLeftRight size={14} />
                  {editMode ? 'Terminé' : 'Modifier'}
                </button>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Edit mode instructions */}
            {editMode && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-[11px] text-primary font-medium text-center">
                  Touchez un onglet ci-dessous, puis un onglet de la barre pour les échanger
                </p>
              </div>
            )}

            {/* Current bottom tabs (only visible in edit mode) */}
            {editMode && (
              <div className="px-4 mb-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Barre principale</p>
                <div className="grid grid-cols-4 gap-2">
                  {bottomTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isSelected = swapSource === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleSwap(tab.id, false)}
                        className={cn(
                          "relative flex flex-col items-center gap-1 py-2.5 rounded-2xl font-semibold text-xs transition-all active:scale-95 border-2",
                          isSelected
                            ? "bg-primary/15 border-primary text-primary scale-[1.03]"
                            : "bg-muted/60 border-transparent text-foreground"
                        )}
                      >
                        <Icon size={20} strokeWidth={isSelected ? 2.4 : 1.8} />
                        <span className="text-[10px]">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Separator */}
            {editMode && (
              <div className="px-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <ArrowLeftRight size={12} className="text-muted-foreground/50" />
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

            {/* More tabs label in edit mode */}
            {editMode && (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-5">Onglets disponibles</p>
            )}

            {/* Scrollable grid of extra tabs */}
            <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ maxHeight: editMode ? 'calc(70vh - 280px)' : 'calc(60vh - 80px)' }}>
              <div className="grid grid-cols-3 gap-2">
                {moreTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id && !editMode;
                  const isSelected = swapSource === tab.id;
                  const hasUnread = tab.id === 'discussions' && unreadDiscussions > 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => editMode ? handleSwap(tab.id, true) : handleTap(tab.id)}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95",
                        editMode && isSelected
                          ? "bg-primary/15 border-2 border-primary text-primary scale-[1.03]"
                          : editMode
                            ? "bg-muted/60 border-2 border-dashed border-border text-foreground"
                            : isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/60 text-foreground"
                      )}
                    >
                      <div className="relative">
                        <Icon size={22} strokeWidth={isActive || isSelected ? 2.2 : 1.8} />
                        {hasUnread && !isActive && !editMode && (
                          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-destructive flex items-center justify-center px-0.5">
                            <span className="text-[9px] font-black text-destructive-foreground leading-none">
                              {unreadDiscussions > 99 ? '99+' : unreadDiscussions}
                            </span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px]">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Tab Bar */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260, delay: 0.2 }}
      >
        <div
          className="absolute inset-0 border-t border-border/30"
          style={{
            background: 'linear-gradient(to top, hsl(var(--card) / 0.97), hsl(var(--card) / 0.92))',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            backdropFilter: 'saturate(180%) blur(20px)',
          }}
        />

        <div className="relative grid grid-cols-5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const hasUnread = tab.id === 'discussions' && unreadDiscussions > 0;
            return (
              <button
                key={tab.id}
                onClick={() => { setMoreOpen(false); handleTap(tab.id); }}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2 outline-none select-none"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 flex justify-center">
                    <motion.div
                      layoutId="tab-indicator"
                      className="w-6 h-[3px] rounded-full bg-primary"
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    />
                  </div>
                )}
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                  className="relative"
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn(
                      'transition-colors duration-200',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  {hasUnread && !isActive && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-destructive flex items-center justify-center px-0.5">
                      <span className="text-[9px] font-black text-destructive-foreground leading-none">
                        {unreadDiscussions > 99 ? '99+' : unreadDiscussions}
                      </span>
                    </span>
                  )}
                </motion.div>
                <span className={cn(
                  'text-[10px] leading-none tracking-tight text-center transition-colors duration-200',
                  isActive ? 'font-bold text-primary' : 'font-medium text-muted-foreground'
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* Plus button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 outline-none select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Show active indicator if current tab is in "more" */}
            {isActiveInMore && !moreOpen && (
              <div className="absolute top-0 left-0 right-0 flex justify-center">
                <motion.div
                  layoutId="tab-indicator"
                  className="w-6 h-[3px] rounded-full bg-primary"
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                />
              </div>
            )}
            <motion.div
              animate={{ rotate: moreOpen ? 45 : 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 400 }}
            >
              <Plus
                size={22}
                strokeWidth={isActiveInMore ? 2.4 : 1.6}
                className={cn(
                  'transition-colors duration-200',
                  isActiveInMore ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            </motion.div>
            <span className={cn(
              'text-[10px] leading-none tracking-tight text-center transition-colors duration-200',
              isActiveInMore ? 'font-bold text-primary' : 'font-medium text-muted-foreground'
            )}>
              Plus
            </span>

            {/* Unread badge on Plus when discussions has unread and is in more */}
            {!isActiveInMore && unreadDiscussions > 0 && activeTab !== 'discussions' && moreTabs.some(t => t.id === 'discussions') && (
              <span className="absolute top-1 right-1/4 min-w-[16px] h-[16px] rounded-full bg-destructive flex items-center justify-center px-0.5">
                <span className="text-[9px] font-black text-destructive-foreground leading-none">
                  {unreadDiscussions > 99 ? '99+' : unreadDiscussions}
                </span>
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default React.memo(BottomTabBar);
