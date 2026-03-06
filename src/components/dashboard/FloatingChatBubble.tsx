import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser } from '@/contexts/AuthContext';
import type { Member } from '@/pages/Dashboard';
import ChatTab from './ChatTab';

interface Props {
  currentUser: AppUser | null;
  members: Member[];
}

const BUBBLE_SIZE = 56;
const EDGE_MARGIN = 8;

const FloatingChatBubble: React.FC<Props> = ({ currentUser, members }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Initialize position
  useEffect(() => {
    const savedPos = localStorage.getItem('chat_bubble_pos');
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        setPosition(clampPosition(parsed.x, parsed.y));
        return;
      } catch {}
    }
    // Default: bottom-right, above tab bar
    setPosition({
      x: window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN - 8,
      y: window.innerHeight - BUBBLE_SIZE - 120,
    });
  }, []);

  // Fetch unread count
  useEffect(() => {
    if (!currentUser) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('unread_count')
        .contains('participants', [currentUser.uid]);
      if (data) {
        const total = data.reduce((sum, c) => {
          const uc = (c.unread_count as Record<string, number>) || {};
          return sum + (uc[currentUser.uid] || 0);
        }, 0);
        setUnreadCount(total);
      }
    };
    fetchUnread();

    const isIOSNative = /iPad|iPhone|iPod/.test(navigator.userAgent) && (window as any).Capacitor?.isNativePlatform?.();
    if (isIOSNative) {
      const interval = setInterval(fetchUnread, 2000);
      return () => clearInterval(interval);
    }

    const channel = supabase
      .channel('bubble-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchUnread)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages' }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Reset unread when opened
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  const clampPosition = (x: number, y: number) => ({
    x: Math.max(EDGE_MARGIN, Math.min(window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN, x)),
    y: Math.max(EDGE_MARGIN + 40, Math.min(window.innerHeight - BUBBLE_SIZE - 80, y)),
  });

  // Snap to nearest edge
  const snapToEdge = useCallback((x: number, y: number) => {
    const midX = window.innerWidth / 2;
    const snappedX = x + BUBBLE_SIZE / 2 < midX ? EDGE_MARGIN : window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN;
    const pos = clampPosition(snappedX, y);
    setPosition(pos);
    localStorage.setItem('chat_bubble_pos', JSON.stringify(pos));
  }, []);

  // Touch handlers for drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startPosX: position.x,
      startPosY: position.y,
      moved: false,
    };
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
      setDragging(true);
    }
    if (dragRef.current.moved) {
      e.preventDefault();
      const newPos = clampPosition(
        dragRef.current.startPosX + dx,
        dragRef.current.startPosY + dy,
      );
      setPosition(newPos);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragRef.current?.moved) {
      snapToEdge(position.x, position.y);
    } else {
      setIsOpen(prev => !prev);
    }
    setDragging(false);
    dragRef.current = null;
  }, [position, snapToEdge]);

  // Mouse handlers for desktop drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
      moved: false,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragRef.current.moved = true;
        setDragging(true);
      }
      if (dragRef.current.moved) {
        const newPos = clampPosition(
          dragRef.current.startPosX + dx,
          dragRef.current.startPosY + dy,
        );
        setPosition(newPos);
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current?.moved) {
        snapToEdge(position.x, position.y);
      } else {
        setIsOpen(prev => !prev);
      }
      setDragging(false);
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [position, snapToEdge]);

  if (!currentUser || position.x < 0) return null;

  return createPortal(
    <>
      {/* Bubble - z-40 so it's BELOW modals (z-50/70) */}
      <div
        ref={bubbleRef}
        className="fixed select-none touch-none"
        style={{
          left: position.x,
          top: position.y,
          zIndex: 40,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="w-full h-full rounded-full flex items-center justify-center shadow-xl border-2 border-accent/30"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))',
            boxShadow: '0 4px 20px -2px hsl(var(--accent) / 0.5)',
          }}
        >
          <MessageCircle size={26} className="text-accent-foreground" strokeWidth={2.2} />
        </motion.div>

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && !isOpen && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-destructive flex items-center justify-center px-1"
            >
              <span className="text-[11px] font-black text-destructive-foreground leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat modal - always same position, below other modals */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{ zIndex: 45 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

            {/* Chat panel - full screen on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-2 sm:inset-4 top-[env(safe-area-inset-top,8px)] bottom-2 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                    <MessageCircle size={18} className="text-accent" />
                  </div>
                  <h2 className="text-base font-bold text-foreground">Discussions</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Chat content */}
              <div className="flex-1 overflow-hidden">
                <ChatTab currentUser={currentUser} members={members} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
};

export default React.memo(FloatingChatBubble);
