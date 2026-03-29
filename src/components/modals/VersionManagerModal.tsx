import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAppVersion } from '@/lib/appVersion';
import { Smartphone, Apple, Shield, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface VersionManagerModalProps {
  open: boolean;
  onClose: () => void;
}

const VersionManagerModal: React.FC<VersionManagerModalProps> = ({ open, onClose }) => {
  const [iosVersion, setIosVersion] = useState('');
  const [androidVersion, setAndroidVersion] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const [version, { data }] = await Promise.all([
        getAppVersion(),
        supabase.from('app_config').select('key, value').in('key', ['min_version_ios', 'min_version_android']),
      ]);
      setCurrentVersion(version);
      if (data) {
        for (const row of data) {
          if (row.key === 'min_version_ios') setIosVersion(row.value);
          if (row.key === 'min_version_android') setAndroidVersion(row.value);
        }
      }
      setLoading(false);
    };
    load();
  }, [open]);

  const isValidVersion = (v: string) => /^\d+\.\d+\.\d+$/.test(v);

  const handleSave = async () => {
    if (!isValidVersion(iosVersion) || !isValidVersion(androidVersion)) {
      toast.error('Format invalide. Utilise le format X.Y.Z (ex: 1.2.0)');
      return;
    }
    setSaving(true);
    try {
      const { error: e1 } = await supabase.from('app_config').update({ value: iosVersion, updated_at: new Date().toISOString() }).eq('key', 'min_version_ios');
      const { error: e2 } = await supabase.from('app_config').update({ value: androidVersion, updated_at: new Date().toISOString() }).eq('key', 'min_version_android');
      if (e1 || e2) throw new Error('Erreur lors de la sauvegarde');
      toast.success('Versions minimales mises à jour !');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/60 backdrop-blur-md z-[70] flex justify-center items-end"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-card w-full border-x border-t border-border shadow-2xl rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Shield size={18} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Versions requises</h3>
                  <p className="text-[11px] text-muted-foreground">Forcer la mise à jour des joueurs</p>
                </div>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>
              ) : (
                <>
                  <div className="bg-secondary/50 rounded-xl p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Ta version actuelle</p>
                    <p className="text-sm font-semibold text-foreground">{currentVersion}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Apple size={16} />
                      Version minimum iOS
                    </label>
                    <input
                      type="text"
                      value={iosVersion}
                      onChange={(e) => setIosVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Smartphone size={16} />
                      Version minimum Android
                    </label>
                    <input
                      type="text"
                      value={androidVersion}
                      onChange={(e) => setAndroidVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ Assure-toi que la nouvelle version est déjà disponible sur les stores avant de changer ces valeurs !
                    </p>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 px-6 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </>
              )}
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VersionManagerModal;
