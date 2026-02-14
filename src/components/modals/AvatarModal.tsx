import React, { useState, useRef } from 'react';
import { db, doc, updateDoc } from '@/lib/firebase';
import type { AppUser } from '@/contexts/AuthContext';
import { Loader2, Camera, Trash2, X, User, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  currentUser: AppUser;
  onClose: () => void;
  onAvatarUpdated: (photoURL: string | null) => void;
}

const AvatarModal = ({ currentUser, onClose, onAvatarUpdated }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(currentUser.photoURL || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <h3 className="text-lg font-bold text-foreground">Photo de profil</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-all"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex flex-col items-center py-8 px-6">
          <div className="relative group">
            {photoURL ? (
              <img
                src={photoURL}
                alt="Avatar"
                className="w-32 h-32 rounded-full object-cover border-4 border-border shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center border-4 border-border shadow-lg">
                <span className="text-3xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">{currentUser.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 space-y-2.5">
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
            className="w-full bg-accent text-accent-foreground py-3 rounded-xl font-medium hover:bg-accent/90 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 text-sm"
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
              className="w-full bg-destructive/10 text-destructive py-3 rounded-xl font-medium hover:bg-destructive/20 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2.5"
            >
              <Trash2 size={16} /> Supprimer la photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarModal;
