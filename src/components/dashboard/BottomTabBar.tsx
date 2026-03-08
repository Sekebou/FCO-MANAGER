import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Bell, Trophy, Ticket, Camera, ClipboardCheck,
  TrendingUp, Calendar, UserCheck, MessageCircle, Plus, X
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
  { id: 'championnat', label: 'Champ', icon: Trophy },
  { id: 'paris', label: 'Paris', icon: Ticket },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'stats', label: 'Stats', icon: TrendingUp },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'members', label: 'Membres', icon: UserCheck },
  { id: 'discussions', label: 'Discussions', icon: MessageCircle },
];

const bottomTabs = allTabs.slice(0, 4);
const moreTabs = allTabs.slice(4);

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadDiscussions?: number;
}

const BottomTabBar = ({ activeTab, onTabChange, unreadDiscussions = 0 }: BottomTabBarProps) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleTap = useCallback((tabId: string) => {
    if (tabId === activeTab && !moreOpen) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
    setMoreOpen(false);
  }, [activeTab, onTabChange, moreOpen]);

  const isActiveInMore = moreTabs.some(t => t.id === activeTab);

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
              maxHeight: '60vh',
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-base font-bold text-foreground">Plus</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable grid of extra tabs */}
            <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ maxHeight: 'calc(60vh - 80px)' }}>
              <div className="grid grid-cols-3 gap-2">
                {moreTabs.map((tab, i) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const hasUnread = tab.id === 'discussions' && unreadDiscussions > 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTap(tab.id)}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-foreground"
                      )}
                    >
                      <div className="relative">
                        <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                        {hasUnread && !isActive && (
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
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn(
                      'transition-colors duration-200',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
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

            {/* Unread badge on Plus when discussions has unread */}
            {!isActiveInMore && unreadDiscussions > 0 && activeTab !== 'discussions' && (
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
