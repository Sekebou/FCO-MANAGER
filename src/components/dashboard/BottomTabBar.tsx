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
  { id: 'stats', label: 'Stats', icon: TrendingUp },
  { id: 'championnat', label: 'Championnat', icon: Trophy },
  { id: 'news', label: 'Actus', icon: Bell },
  { id: 'calendar', label: 'Agenda', icon: Calendar },
  { id: 'gallery', label: 'Galerie', icon: Camera },
  { id: 'members', label: 'Membres', icon: UserCheck },
];

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorX, setIndicatorX] = useState(0);
  const [mounted, setMounted] = useState(false);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setIndicatorX(btnRect.left - containerRect.left + btnRect.width / 2 - 12);
    }
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    if (!mounted) setTimeout(() => setMounted(true), 50);
  }, [activeTab, updateIndicator, mounted]);

  // Haptic-like micro feedback on tap
  const handleTap = (tabId: string) => {
    if (tabId === activeTab) return;
    // Trigger haptic on native
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(tabId);
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Background with native blur */}
      <div 
        className="absolute inset-0 border-t border-white/[0.08]"
        style={{
          background: 'linear-gradient(to top, hsl(var(--card) / 0.92), hsl(var(--card) / 0.85))',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          backdropFilter: 'saturate(180%) blur(20px)',
        }}
      />

      {/* Safe area padding */}
      <div className="relative">
        {/* Sliding indicator */}
        <div
          className={cn(
            'absolute top-0 h-[2.5px] w-6 rounded-full bg-accent',
            mounted ? 'transition-transform duration-[450ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : ''
          )}
          style={{ transform: `translateX(${indicatorX}px)` }}
        />

        <div 
          ref={containerRef} 
          className="flex items-stretch justify-around px-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
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
                  'relative flex flex-col items-center justify-center py-1.5 flex-1 min-w-0',
                  'outline-none select-none',
                  '-webkit-tap-highlight-color: transparent',
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {/* Icon container with active background */}
                <div
                  className={cn(
                    'relative flex items-center justify-center rounded-2xl transition-all',
                    isActive 
                      ? 'w-14 h-9 bg-accent/[0.12]' 
                      : 'w-9 h-9',
                    mounted ? 'duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : 'duration-0'
                  )}
                >
                  <Icon
                    size={isActive ? 20 : 21}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={cn(
                      'transition-all',
                      mounted ? 'duration-[250ms]' : 'duration-0',
                      isActive 
                        ? 'text-accent' 
                        : 'text-muted-foreground/55'
                    )}
                  />
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] leading-none mt-1 tracking-tight transition-all truncate max-w-full px-0.5',
                    mounted ? 'duration-[250ms]' : 'duration-0',
                    isActive
                      ? 'font-bold text-accent'
                      : 'font-medium text-muted-foreground/45'
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
