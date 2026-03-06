import React, { useState } from 'react';
import { X, Send, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendPushNotifFormProps {
  onClose: () => void;
}

const SendPushNotifForm: React.FC<SendPushNotifFormProps> = ({ onClose }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [platform, setPlatform] = useState<'all' | 'ios' | 'android'>('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Titre et message requis');
      return;
    }

    setSending(true);
    try {
      // Fetch tokens filtered by platform
      let query = supabase.from('fcm_tokens').select('token, platform');
      if (platform !== 'all') {
        query = query.eq('platform', platform);
      }
      const { data: tokens, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;
      if (!tokens || tokens.length === 0) {
        toast.error(`Aucun token ${platform} trouvé`);
        setSending(false);
        return;
      }

      const tokenList = tokens.map(t => t.token);

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { title: title.trim(), body: body.trim(), tokens: tokenList },
      });

      if (error) throw error;

      toast.success(`Notification envoyée ! (${data?.sent || 0} succès, ${data?.failed || 0} échecs)`);
      onClose();
    } catch (err: any) {
      console.error('Push error:', err);
      toast.error(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-accent" />
            <h3 className="font-bold text-foreground">Test Notification Push</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Platform selector */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Plateforme</label>
            <div className="flex gap-2">
              {(['all', 'ios', 'android'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    platform === p
                      ? 'bg-accent text-accent-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Smartphone size={14} />
                  {p === 'all' ? 'Tous' : p === 'ios' ? 'iOS' : 'Android'}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="🏆 Test FCO Manager"
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Notification de test..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {sending ? 'Envoi en cours...' : 'Envoyer la notification'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendPushNotifForm;
