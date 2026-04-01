import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Camera, Trash2, X, Upload, Calendar, CheckCircle2, BookOpen, AlertTriangle } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import NativeDatePicker from '@/components/ui/native-date-picker';

interface Props {
  currentUser: AppUser;
  onClose: () => void;
  onAvatarUpdated: (photoURL: string | null) => void;
  focusLicense?: boolean;
  onStartTutorial?: () => void;
}

const AvatarModal = ({ currentUser, onClose, onAvatarUpdated, focusLicense = false, onStartTutorial }: Props) => {
  useBodyScrollLock();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const licenseRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(currentUser.photoURL || null);
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [loadingLicense, setLoadingLicense] = useState(true);
  const [savingLicense, setSavingLicense] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNonPlayer = currentUser.role === 'photographe';

  useEffect(() => {
    const loadLicenseData = async () => {
      if (isNonPlayer) { setLoadingLicense(false); return; }
      try {
        const { data: profile } = await supabase.from('profiles').select('license_expiry').eq('id', currentUser.uid).single();
        if (profile?.license_expiry) {
          setLicenseExpiry(profile.license_expiry);
        } else if (currentUser.playerId) {
          const { data: player } = await supabase.from('players').select('license_expiry').eq('id', currentUser.playerId).single();
          if (player?.license_expiry) setLicenseExpiry(player.license_expiry);
        }
      } catch (err) {
        console.error('Error loading license data:', err);
      } finally {
        setLoadingLicense(false);
      }
    };
    loadLicenseData();
  }, [currentUser.uid, currentUser.playerId, isNonPlayer]);

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
      await supabase.from('profiles').update({ photo_url: compressed }).eq('id', currentUser.uid);
      setPhotoURL(compressed);
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      stored.photoURL = compressed;
      localStorage.setItem('currentUser', JSON.stringify(stored));
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
      await supabase.from('profiles').update({ photo_url: null }).eq('id', currentUser.uid);
      setPhotoURL(null);
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      stored.photoURL = null;
      localStorage.setItem('currentUser', JSON.stringify(stored));
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
      await supabase.from('profiles').update({ license_expiry: licenseExpiry || null }).eq('id', currentUser.uid);
      if (currentUser.playerId) {
        try {
          await supabase.from('players').update({ license_expiry: licenseExpiry || null }).eq('id', currentUser.playerId);
        } catch {}
      }
      toast.success('Licence mise à jour !');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSavingLicense(false);
    }
  };

  const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <div className="bg-card rounded-2xl max-w-sm w-full border border-border shadow-xl animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">Mon profil</h3>
          <button onClick={onClose} disabled={uploading} className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-all">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col items-center py-6 px-6">
          <div className="relative group">
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-border shadow-lg" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center border-4 border-border shadow-lg">
                <span className="text-2xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50">
              <Camera size={16} />
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{(() => {
            const effectiveRole = currentUser.displayRole || currentUser.role;
            const labels: Record<string, string> = { joueur: 'Joueur', entraineur: 'Entraîneur', photographe: 'Community Manager', dirigeant: 'Dirigeant', admin: 'Administrateur', 'admin+': 'Administrateur' };
            return labels[effectiveRole] || effectiveRole;
          })()}</p>
        </div>

        <div className="px-5 space-y-2">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="w-full bg-accent text-accent-foreground py-2.5 rounded-xl font-medium hover:bg-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
            {uploading ? (<><Loader2 size={16} className="animate-spin" /> Traitement...</>) : (<><Upload size={16} /> {photoURL ? 'Changer la photo' : 'Ajouter une photo'}</>)}
          </button>
          {photoURL && (
            <button onClick={handleDelete} disabled={uploading}
              className="w-full bg-destructive/10 text-destructive py-2.5 rounded-xl font-medium hover:bg-destructive/20 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              <Trash2 size={16} /> Supprimer la photo
            </button>
          )}
        </div>

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
                <div className="flex gap-2 w-full">
                  <div className="flex-1 min-w-0">
                    <NativeDatePicker value={licenseExpiry} onChange={setLicenseExpiry} placeholder="Date d'expiration" />
                  </div>
                  <button onClick={handleSaveLicense} disabled={savingLicense}
                    className="shrink-0 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 text-sm flex items-center gap-1.5">
                    {savingLicense ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Replay tutorial */}
        <div className="px-5 pb-5">
          <button
            onClick={() => { onClose(); onStartTutorial?.(); }}
            className="w-full bg-secondary text-foreground py-2.5 rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm flex items-center justify-center gap-2"
          >
           <BookOpen size={16} /> Revoir le tutoriel
          </button>
        </div>

        {/* Delete account */}
        <div className="px-5 pb-5">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-destructive/10 text-destructive py-2.5 rounded-xl font-medium hover:bg-destructive/20 transition-all text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> Supprimer mon compte
          </button>
        </div>

        {(isNonPlayer || !currentUser.playerId) && <div className="pb-2" />}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-[80]" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground text-center">Supprimer ton compte ?</h3>
              <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
                Cette action est <strong>irréversible</strong>. Toutes tes données seront supprimées : profil, statistiques, présences, paris, messages, et ton compte sera définitivement effacé.
              </p>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) throw new Error('Non connecté');
                    const res = await supabase.functions.invoke('delete-account', {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (res.error) throw res.error;
                    const body = res.data;
                    if (body?.error) throw new Error(body.error);
                    toast.success('Compte supprimé avec succès');
                    await logout();
                    navigate('/auth');
                  } catch (err: any) {
                    console.error('Delete account error:', err);
                    toast.error(err.message || 'Erreur lors de la suppression');
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-destructive text-destructive-foreground rounded-xl font-medium hover:bg-destructive/90 transition-all text-sm shadow-lg shadow-destructive/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Suppression...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarModal;
