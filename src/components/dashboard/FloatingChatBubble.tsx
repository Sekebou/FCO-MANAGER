import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser } from '@/contexts/AuthContext';
import type { Member } from '@/pages/Dashboard';
import ChatTab from './ChatTab';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Props {
  currentUser: AppUser | null;
  members: Member[];
}

const BUBBLE_SIZE = 56;
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD = 8;

const clampPosition = (x: number, y: number) => ({
  x: Math.max(EDGE_MARGIN, Math.min(window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN, x)),
  y: Math.max(EDGE_MARGIN + 40, Math.min(window.innerHeight - BUBBLE_SIZE - 80, y)),
});

const snapToEdge = (x: number, y: number) => {
  const midX = window.innerWidth / 2;
  const snappedX = x + BUBBLE_SIZE / 2 < midX ? EDGE_MARGIN : window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN;
  return clampPosition(snappedX, y);
};

const FloatingChatBubble: React.FC<Props> = ({ currentUser, members }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useBodyScrollLock(isOpen);

  // Initialize position
  useEffect(() => {
    const saved = localStorage.getItem('chat_bubble_pos');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setPosition(clampPosition(p.x, p.y));
        return;
      } catch {}
    }
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

  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // --- Pointer-based drag (works for touch + mouse) ---
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!position) return;
    dragging.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (!dragging.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      dragging.current = true;
    }
    if (dragging.current) {
      e.preventDefault();
      setPosition(clampPosition(dragStart.current.posX + dx, dragStart.current.posY + dy));
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (dragging.current && position) {
      const snapped = snapToEdge(position.x, position.y);
      setPosition(snapped);
      localStorage.setItem('chat_bubble_pos', JSON.stringify(snapped));
    } else {
      setIsOpen(true);
    }
    dragging.current = false;
  }, [position]);

  const closeChat = useCallback(() => setIsOpen(false), []);

  if (!currentUser || !position) return null;

  return createPortal(
    <>
      {/* ====== BUBBLE (visible only when closed) ====== */}
      {!isOpen && (
        <div
          className="fixed touch-none select-none"
          style={{
            left: position.x,
            top: position.y,
            zIndex: 40,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div
            className="w-full h-full rounded-full flex items-center justify-center shadow-xl border-2 border-accent/30"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))',
              boxShadow: '0 4px 20px -2px hsl(var(--accent) / 0.5)',
            }}
          >
            <MessageCircle size={26} className="text-accent-foreground" strokeWidth={2.2} />
          </div>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-destructive flex items-center justify-center px-1">
              <span className="text-[11px] font-black text-destructive-foreground leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ====== CHAT PANEL (fullscreen overlay) ====== */}
      {isOpen && (
        <div className="fixed inset-0" style={{ zIndex: 45 }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={closeChat}
            onTouchEnd={closeChat}
          />

          {/* Panel */}
          <div
            className="absolute inset-0 sm:inset-3 bg-card sm:rounded-2xl border-0 sm:border sm:border-border shadow-2xl overflow-hidden flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
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
                type="button"
                onClick={closeChat}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); closeChat(); }}
                className="w-10 h-10 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Chat content */}
            <div className="flex-1 overflow-hidden">
              <ChatTab currentUser={currentUser} members={members} embedded />
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};

export default React.memo(FloatingChatBubble);
