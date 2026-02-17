import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, db, onAuthStateChanged, signOut, doc, getDoc, onSnapshot, type User } from '@/lib/firebase';

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
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          sessionStorage.setItem('currentUser', JSON.stringify(appUser));
          setCurrentUser(appUser);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    // Use cached data for instant display, then always refresh from Firestore
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      setFirebaseUser(user);

      // Clean up previous snapshot listener
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (user) {
        const stored = sessionStorage.getItem('currentUser');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
        // Always refresh profile from Firestore to keep role up-to-date
        await fetchUserProfile(user);

        // Listen for session token changes to enforce single-session
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
          if (!isMounted || !snapshot.exists()) return;
          const data = snapshot.data();
          const localToken = sessionStorage.getItem('sessionToken');
          // If there's a session token in Firestore and it doesn't match ours, force logout
          if (localToken && data.sessionToken && data.sessionToken !== localToken) {
            console.log('Session invalidée : connexion depuis un autre appareil');
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('sessionToken');
            signOut(auth);
          }
        });
      } else {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionToken');
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, logout, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
