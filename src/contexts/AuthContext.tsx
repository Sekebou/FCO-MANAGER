import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, authReady, db, onAuthStateChanged, signOut, doc, getDoc, onSnapshot, type User } from '@/lib/firebase';
import { toast } from 'sonner';

export interface AppUser {
  uid: string;
  email: string;
  role: string;
  name: string;
  username?: string;
  playerId?: string;
  photoURL?: string | null;
  team?: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: User | null;
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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Grace period flag: skip session-token check right after auth state changes
  // to avoid race condition with Auth.tsx writing the new token
  const loginGraceRef = React.useRef(false);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeSnapshot: (() => void) | null = null;

    const fetchUserProfile = async (user: User) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && isMounted) {
          const userData = userDoc.data();
          const appUser: AppUser = {
            uid: user.uid,
            email: user.email || '',
            role: userData.role,
            name: userData.name,
            username: userData.username || '',
            playerId: userData.playerId || undefined,
            photoURL: userData.photoURL || null,
            team: userData.team || undefined,
          };
          localStorage.setItem('currentUser', JSON.stringify(appUser));
          setCurrentUser(appUser);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    // Use cached data for instant display, then always refresh from Firestore
    // Wait for Firebase persistence to be ready before listening to auth state
    // This prevents a false "null" user event on app restart (Android/Capacitor)
    let unsubscribe: (() => void) | null = null;
    
    // authReady has a built-in 3s timeout, but add a safety net here too
    const startAuth = () => {
      if (!isMounted) return;
      
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;
        setFirebaseUser(user);

        // Clean up previous snapshot listener
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }

        if (user) {
          const stored = localStorage.getItem('currentUser');
          if (stored) {
            setCurrentUser(JSON.parse(stored));
          }
          // Always refresh profile from Firestore to keep role up-to-date
          await fetchUserProfile(user);

          // Start a grace period: ignore session token changes for 5s
          // so Auth.tsx has time to write the new token to Firestore + localStorage
          loginGraceRef.current = true;
          setTimeout(() => { loginGraceRef.current = false; }, 5000);

          // Listen for session token changes to enforce single-session
          unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
            if (!isMounted || !snapshot.exists()) return;
            // Skip check during login grace period
            if (loginGraceRef.current) return;
            const data = snapshot.data();
            const localToken = localStorage.getItem('sessionToken');
            if (localToken && data.sessionToken && data.sessionToken !== localToken) {
              toast.error('Session déconnectée', {
                description: 'Votre compte est déjà connecté depuis un autre appareil. Vous avez été déconnecté.',
                duration: 8000,
              });
              localStorage.removeItem('currentUser');
              localStorage.removeItem('sessionToken');
              signOut(auth);
            } else if (!localToken && data.sessionToken) {
              localStorage.setItem('sessionToken', data.sessionToken);
            }
          });
        } else {
          setCurrentUser(null);
          localStorage.removeItem('currentUser');
          localStorage.removeItem('sessionToken');
        }
        if (isMounted) setLoading(false);
      });
    };

    authReady.then(startAuth).catch(() => {
      console.warn('Auth persistence failed, starting anyway');
      startAuth();
    });

    // Ultimate fallback: if still loading after 6s, force loading=false
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth safety timeout: forcing loading=false');
        setLoading(false);
      }
    }, 6000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, logout, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
