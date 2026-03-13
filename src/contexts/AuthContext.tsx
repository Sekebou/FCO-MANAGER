import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AppUser {
  uid: string;
  email: string;
  role: string;
  displayRole?: string;
  name: string;
  username?: string;
  playerId?: string;
  photoURL?: string | null;
  team?: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const loginGraceRef = useRef(false);
  const profileChannelRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string, email: string) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profile && isMounted) {
          const appUser: AppUser = {
            uid: userId,
            email,
            role: profile.role,
            displayRole: profile.display_role || undefined,
            name: profile.name,
            username: profile.username || '',
            playerId: profile.player_id || undefined,
            photoURL: profile.photo_url || null,
            team: profile.team || undefined,
          };
          localStorage.setItem('currentUser', JSON.stringify(appUser));
          setCurrentUser(appUser);

          // Session token enforcement
          loginGraceRef.current = true;
          setTimeout(() => { loginGraceRef.current = false; }, 5000);

          // Subscribe to profile changes for session invalidation
          if (profileChannelRef.current) {
            supabase.removeChannel(profileChannelRef.current);
          }
          profileChannelRef.current = supabase
            .channel(`session-${userId}`)
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_sessions',
              filter: `user_id=eq.${userId}`,
            }, (payload: any) => {
              if (!isMounted || loginGraceRef.current) return;
              const newToken = payload.new?.session_token;
              const localToken = localStorage.getItem('sessionToken');
              if (localToken && newToken && newToken !== localToken) {
                toast.error('Session déconnectée', {
                  description: 'Votre compte est déjà connecté depuis un autre appareil.',
                  duration: 8000,
                });
                localStorage.removeItem('currentUser');
                localStorage.removeItem('sessionToken');
                supabase.auth.signOut();
                setCurrentUser(null);
              }
            })
            .subscribe();
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        const stored = localStorage.getItem('currentUser');
        if (stored) setCurrentUser(JSON.parse(stored));
        // Defer profile fetch to avoid Supabase auth callback deadlock
        setTimeout(() => fetchProfile(session.user.id, session.user.email || ''), 0);
      } else {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionToken');
      }
      if (isMounted) setLoading(false);
    });

    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) setLoading(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
      }
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
    setCurrentUser(null);
  };

  const isDemoAccount = !!(currentUser?.email && currentUser.email.toLowerCase() === DEMO_EMAIL.toLowerCase());

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout, setCurrentUser, isDemoAccount }}>
      {children}
    </AuthContext.Provider>
  );
};
