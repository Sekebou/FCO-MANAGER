import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { auth, authReady, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, doc, getDoc, onSnapshot, type User } from '@/lib/firebase';
import { isIOSCapacitor, restGetDoc } from '@/lib/firestore-rest';
import { toast } from 'sonner';

const FIREBASE_API_KEY = 'AIzaSyAExtesWZPAEbQbGm5Rp17ek1PuWx_uceQ';

/**
 * On iOS Capacitor, the Firebase SDK uses inMemoryPersistence which loses
 * auth state on every app restart.  We stored a Firebase refresh token at
 * login time.  Exchange it here for a fresh ID token and then sign into
 * the SDK *before* onAuthStateChanged starts, so listeners work normally.
 */
const reAuthIOSIfNeeded = async (): Promise<void> => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isCapacitorEnv = !!(window as any).Capacitor;
  if (!(isIOS && isCapacitorEnv)) return;

  const refreshToken = localStorage.getItem('firebaseRefreshToken');
  if (!refreshToken) return;

  console.log('[AuthContext] iOS: exchanging refresh token for fresh session...');
  try {
    // Exchange refresh token for a new ID token via Firebase REST
    const tokenRes = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      }
    );
    if (!tokenRes.ok) {
      console.warn('[AuthContext] iOS: refresh token exchange failed', tokenRes.status);
      localStorage.removeItem('firebaseRefreshToken');
      return;
    }
    const tokenData = await tokenRes.json();
    // Store updated refresh token
    if (tokenData.refresh_token) {
      localStorage.setItem('firebaseRefreshToken', tokenData.refresh_token);
    }

    // Now try to sign into the SDK using stored credentials
    const storedEmail = localStorage.getItem('iosAuthEmail');
    const storedPass = localStorage.getItem('iosAuthPass');
    if (storedEmail && storedPass) {
      await Promise.race([
        signInWithEmailAndPassword(auth, storedEmail, atob(storedPass)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SDK sign-in timeout')), 5000)),
      ]);
      console.log('[AuthContext] iOS: SDK re-auth succeeded via stored credentials');
    }
  } catch (err: any) {
    console.warn('[AuthContext] iOS: re-auth failed:', err.message);
    // Session is still usable via localStorage (REST-only mode)
  }
};

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
  const iosSessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const startAuth = async () => {
      if (!isMounted) return;

      // On iOS Capacitor, try to re-authenticate the SDK BEFORE listening
      // so onAuthStateChanged fires with a valid user right away.
      await reAuthIOSIfNeeded();

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
          if (isIOSCapacitor) {
            // On iOS, SDK listeners don't work reliably. Use REST polling.
            if (iosSessionPollRef.current) clearInterval(iosSessionPollRef.current);
            const uid = user.uid;
            iosSessionPollRef.current = setInterval(async () => {
              if (!isMounted || loginGraceRef.current) return;
              try {
                const userData = await restGetDoc('users', uid);
                if (!userData) return;
                const localToken = localStorage.getItem('sessionToken');
                if (localToken && userData.sessionToken && userData.sessionToken !== localToken) {
                  toast.error('Session déconnectée', {
                    description: 'Votre compte est déjà connecté depuis un autre appareil. Vous avez été déconnecté.',
                    duration: 8000,
                  });
                  handleIOSLogout();
                }
              } catch (err) {
                console.warn('[AuthContext] iOS session poll error:', err);
              }
            }, 8000);
          } else {
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
          }
        } else {
          // On iOS Capacitor, keep the REST-based session if SDK re-auth failed
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          const isCapacitorEnv = !!(window as any).Capacitor;
          const hasLocalSession = !!localStorage.getItem('currentUser') && !!localStorage.getItem('sessionToken');
          
          if (isIOS && isCapacitorEnv && hasLocalSession) {
            console.log('[AuthContext] iOS Capacitor: keeping REST session despite null firebaseUser');
          } else {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('sessionToken');
          }
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
      if (iosSessionPollRef.current) clearInterval(iosSessionPollRef.current);
    };
  }, []);

  const handleIOSLogout = () => {
    if (iosSessionPollRef.current) {
      clearInterval(iosSessionPollRef.current);
      iosSessionPollRef.current = null;
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('firebaseRefreshToken');
    localStorage.removeItem('iosAuthEmail');
    localStorage.removeItem('iosAuthPass');
    setCurrentUser(null);
  };

  const logout = async () => {
    if (isIOSCapacitor) {
      // On iOS, signOut(auth) can hang. Just clear local state.
      handleIOSLogout();
    } else {
      await signOut(auth);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('sessionToken');
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, logout, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
