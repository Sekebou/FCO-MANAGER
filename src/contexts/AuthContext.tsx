import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, db, onAuthStateChanged, signOut, doc, getDoc, type User } from '@/lib/firebase';

export interface AppUser {
  uid: string;
  email: string;
  role: string;
  name: string;
  username?: string;
  playerId?: string;
  photoURL?: string | null;
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
      if (user) {
        const stored = sessionStorage.getItem('currentUser');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
        // Always refresh profile from Firestore to keep role up-to-date
        await fetchUserProfile(user);
      } else {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
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
