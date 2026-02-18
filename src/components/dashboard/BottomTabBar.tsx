import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Users, TrendingUp, Trophy, Bell, Calendar, Camera, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const allTabs: Tab[] = [
  { id: 'presences', label: 'Présences', icon: Users },
  { id: 'stats', label: 'Statistiques', icon: TrendingUp },
  { id: 'championnat', label: 'Championnat', icon: Trophy },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: UserCheck },
];

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  // Auto-scroll to active tab
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const btnCenter = btnRect.left - containerRect.left + scrollLeft + btnRect.width / 2;
      const targetScroll = btnCenter - containerRect.width / 2;
      container.scrollTo({ left: targetScroll, behavior: mounted ? 'smooth' : 'auto' });
    }
  }, [activeTab, mounted]);

  const handleTap = (tabId: string) => {
    if (tabId === activeTab) return;
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Background */}
      <div
        className="absolute inset-0 border-t border-white/[0.08]"
        style={{
          background: 'linear-gradient(to top, hsl(var(--card) / 0.95), hsl(var(--card) / 0.88))',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backdropFilter: 'saturate(180%) blur(20px)',
        }}
      />

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex items-stretch overflow-x-auto scrollbar-hide px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-0.5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTap(tab.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center pt-1.5 pb-1 min-w-[4.2rem] shrink-0',
                  'outline-none select-none',
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Active pill indicator on top */}
                <div
                  className={cn(
                    'absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-accent transition-all',
                    mounted ? 'duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : 'duration-0',
                    isActive ? 'w-7 opacity-100' : 'w-0 opacity-0'
                  )}
                />

                {/* Icon */}
                <div
                  className={cn(
                    'relative flex items-center justify-center rounded-2xl transition-all',
                    isActive ? 'w-14 h-8 bg-accent/[0.12]' : 'w-8 h-8',
                    mounted ? 'duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : 'duration-0'
                  )}
                >
                  <Icon
                    size={isActive ? 20 : 21}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn(
                      'transition-all',
                      mounted ? 'duration-[250ms]' : 'duration-0',
                      isActive ? 'text-accent' : 'text-muted-foreground/55'
                    )}
                  />
                </div>

                {/* Label — full text, never truncated */}
                <span
                  className={cn(
                    'text-[10px] leading-none mt-1 tracking-tight whitespace-nowrap transition-all',
                    mounted ? 'duration-[250ms]' : 'duration-0',
                    isActive ? 'font-bold text-accent' : 'font-medium text-muted-foreground/45'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default React.memo(BottomTabBar);
