import React, { useState, useRef, useEffect } from 'react';
import { db, doc, updateDoc, getDoc } from '@/lib/firebase';
import type { AppUser } from '@/contexts/AuthContext';
import { Loader2, Camera, Trash2, X, Upload, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  currentUser: AppUser;
  onClose: () => void;
  onAvatarUpdated: (photoURL: string | null) => void;
  focusLicense?: boolean;
}

const AvatarModal = ({ currentUser, onClose, onAvatarUpdated, focusLicense = false }: Props) => {
  const licenseRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(currentUser.photoURL || null);
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [loadingLicense, setLoadingLicense] = useState(true);
  const [savingLicense, setSavingLicense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNonPlayer = currentUser.role === 'photographe';

  // Load license data from user doc
  useEffect(() => {
    const loadLicenseData = async () => {
      if (isNonPlayer) {
        setLoadingLicense(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          // Try user doc first, fallback to player doc
          if (data.licenseExpiry) {
            setLicenseExpiry(data.licenseExpiry);
          } else if (currentUser.playerId) {
            const playerDoc = await getDoc(doc(db, 'players', currentUser.playerId));
            if (playerDoc.exists()) {
              setLicenseExpiry(playerDoc.data().licenseExpiry || '');
            }
          }
        }
      } catch (err) {
        console.error('Error loading license data:', err);
      } finally {
        setLoadingLicense(false);
      }
    };
    loadLicenseData();
  }, [currentUser.uid, currentUser.playerId, isNonPlayer]);

  // Scroll to license section when focusLicense is set
  useEffect(() => {
    if (focusLicense && !loadingLicense && licenseRef.current) {
      licenseRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusLicense, loadingLicense]);

  const compressImage = (file: File, maxWidth = 300, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = ['image/jpeg', 'image/png', 'image/webp'];
    if (!valid.includes(file.type)) { toast.error('Format non supporté (JPG, PNG, WebP)'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image trop lourde (max 3MB)'); return; }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: compressed });
      setPhotoURL(compressed);
      const stored = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      stored.photoURL = compressed;
      sessionStorage.setItem('currentUser', JSON.stringify(stored));
      onAvatarUpdated(compressed);
      toast.success('Photo mise à jour !');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer la photo de profil ?')) return;
    setUploading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: null });
      setPhotoURL(null);
      const stored = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      stored.photoURL = null;
      sessionStorage.setItem('currentUser', JSON.stringify(stored));
      onAvatarUpdated(null);
      toast.success('Photo supprimée');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLicense = async () => {
    setSavingLicense(true);
    try {
      // Save to user's own doc (always writable by the user)
      await updateDoc(doc(db, 'users', currentUser.uid), { licenseExpiry: licenseExpiry || null });
      // Also update player doc if possible (admin/coach will have perms)
      if (currentUser.playerId) {
        try {
          await updateDoc(doc(db, 'players', currentUser.playerId), { licenseExpiry: licenseExpiry || null });
        } catch {
          // Player doc update may fail for non-staff, that's ok
        }
      }
      toast.success('Licence mise à jour !');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSavingLicense(false);
    }
  };

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl max-w-sm w-full border border-border shadow-xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">Mon profil</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-all"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex flex-col items-center py-6 px-6">
          <div className="relative group">
            {photoURL ? (
              <img
                src={photoURL}
                alt="Avatar"
                className="w-28 h-28 rounded-full object-cover border-4 border-border shadow-lg"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center border-4 border-border shadow-lg">
                <span className="text-2xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
            >
              <Camera size={16} />
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{currentUser.role === 'admin+' ? 'Administrateur' : currentUser.role}</p>
        </div>

        {/* Photo actions */}
        <div className="px-5 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-accent text-accent-foreground py-2.5 rounded-xl font-medium hover:bg-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {uploading ? (
              <><Loader2 size={16} className="animate-spin" /> Traitement...</>
            ) : (
              <><Upload size={16} /> {photoURL ? 'Changer la photo' : 'Ajouter une photo'}</>
            )}
          </button>
          {photoURL && (
            <button
              onClick={handleDelete}
              disabled={uploading}
              className="w-full bg-destructive/10 text-destructive py-2.5 rounded-xl font-medium hover:bg-destructive/20 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> Supprimer la photo
            </button>
          )}
        </div>

        {/* License section - visible for non-photographe with playerId */}
        {!isNonPlayer && currentUser.playerId && (
          <div ref={licenseRef} className={`px-5 pt-4 pb-5 ${focusLicense ? 'ring-2 ring-primary/30 rounded-xl mx-2 bg-primary/5 transition-all' : ''}`}>
            <div className="border-t border-border pt-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Expiration licence FFF
              </label>
              {loadingLicense ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                  <Loader2 size={14} className="animate-spin" /> Chargement...
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      className="w-full pl-9 pr-3 py-2.5 bg-secondary border border-border rounded-xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm transition-all"
                      value={licenseExpiry}
                      onChange={(e) => setLicenseExpiry(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleSaveLicense}
                    disabled={savingLicense}
                    className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 text-sm flex items-center gap-1.5"
                  >
                    {savingLicense ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom padding if no license section */}
        {(isNonPlayer || !currentUser.playerId) && <div className="pb-5" />}
      </div>
    </div>
  );
};

export default AvatarModal;
