import React, { useRef, useEffect, useState } from 'react';
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
  { id: 'championnat', label: 'Classement', icon: Trophy },
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
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setIndicatorStyle({
        left: btnRect.left - containerRect.left + btnRect.width / 2 - 16,
        width: 32,
      });
    }
  }, [activeTab]);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-card/80 backdrop-blur-2xl border-t border-border/50" />
      
      {/* Active indicator pill */}
      <div
        className="absolute top-0 h-[3px] bg-accent rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
      />

      <div ref={containerRef} className="relative flex items-end justify-around px-1 pt-1.5 pb-1.5">
        {allTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all duration-300 min-w-0 flex-1',
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground/60 active:scale-90'
              )}
            >
              <div
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-500',
                  isActive
                    ? 'bg-accent/12 scale-110'
                    : 'scale-100'
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={cn(
                    'transition-all duration-300',
                    isActive && 'drop-shadow-[0_0_8px_hsl(var(--accent)/0.4)]'
                  )}
                />
                {/* Active dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent animate-scale-in" />
                )}
              </div>
              <span
                className={cn(
                  'text-[9px] font-semibold tracking-tight leading-none transition-all duration-300 truncate max-w-full',
                  isActive
                    ? 'text-accent opacity-100 translate-y-0'
                    : 'text-muted-foreground/50 opacity-80'
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomTabBar;
