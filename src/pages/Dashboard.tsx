import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getWebOrigin } from '@/lib/getWebOrigin';
import { sendInvitationEmail, sendEventEmail } from '@/lib/emailjs';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, TrendingUp, Bell, Calendar, CalendarDays, LogOut, Shield, Trophy, Lock, Menu, X, CheckCircle2, Mail, KeyRound, UserCheck, Copy, Camera, Dumbbell, UserCircle, Briefcase, MessageCircle, Coins, Hand, Send, Ticket
} from 'lucide-react';
import clubLogo from '@/assets/logo.png';
import { toast } from 'sonner';
import PresencesTab from '@/components/dashboard/PresencesTab';
import StatsTab from '@/components/dashboard/StatsTab';
import NewsTab from '@/components/dashboard/NewsTab';
import CalendarTab from '@/components/dashboard/CalendarTab';
import MembersTab from '@/components/dashboard/MembersTab';
import ChampionnatTab, { type Championship, type Match } from '@/components/dashboard/ChampionnatTab';
import GalleryTab, { type Album, type Photo } from '@/components/dashboard/GalleryTab';
import ChatTab from '@/components/dashboard/ChatTab';
import ParisTab from '@/components/dashboard/ParisTab';
// FloatingChatBubble removed — discussions is now a tab
import BottomTabBar from '@/components/dashboard/BottomTabBar';
import OnboardingTutorial from '@/components/dashboard/OnboardingTutorial';
import HomeTab from '@/components/dashboard/HomeTab';
import NotificationBell from '@/components/dashboard/NotificationBell';
import AddPlayerForm from '@/components/modals/AddPlayerForm';
import AddEventForm from '@/components/modals/AddEventForm';
import AddNewsForm from '@/components/modals/AddNewsForm';
import AddCardForm from '@/components/modals/AddCardForm';
import ChangePasswordForm from '@/components/modals/ChangePasswordForm';
import AdminResetPasswordForm from '@/components/modals/AdminResetPasswordForm';
import AvatarModal from '@/components/modals/AvatarModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import InvitePlayerForm from '@/components/modals/InvitePlayerForm';
import SendPushNotifForm from '@/components/modals/SendPushNotifForm';
import WinCelebration from '@/components/dashboard/WinCelebration';



      {/* Modals */}
      {showAddPlayer && <AddPlayerForm onSubmit={addPlayer} onClose={() => setShowAddPlayer(false)} currentUser={currentUser} />}
      {showInvitePlayer && (
        <InvitePlayerForm currentUser={currentUser} onClose={() => setShowInvitePlayer(false)}
          onSubmit={async (data) => {
            try {
              if (currentUser?.role === 'entraineur') data.role = 'joueur';
              if (data.role === 'admin+' && currentUser?.role !== 'admin+') { toast.error("Seul l'Admin+ peut attribuer ce rôle"); return; }
              const isCollective = data.mode === 'collective';
              const expiresAt = new Date(Date.now() + (isCollective ? 7 * 24 : 48) * 60 * 60 * 1000).toISOString();
              const { data: inv, error } = await supabase.from('invitations').insert({
                email: data.mode === 'email' ? data.email : null,
                role: data.role,
                position: data.position || null,
                license_expiry: data.licenseExpiry || null,
                expires_at: expiresAt,
                invited_by: currentUser?.uid || '',
                max_uses: isCollective ? 9999 : 1,
                use_count: 0,
              } as any).select('id').single();
              if (error) throw error;
              const link = `${getWebOrigin()}/register?token=${inv.id}`;
              if (data.mode === 'email' && data.email) {
                try {
                  await sendInvitationEmail({
                    to_email: data.email,
                    invite_link: link,
                    role_label: data.role || 'Joueur',
                    inviter_name: currentUser?.name || 'Un administrateur',
                  });
                  toast.success('Invitation envoyée par email !');
                } catch { toast.warning("Email non envoyé, mais le lien a été généré"); }
              } else {
                toast.success(isCollective ? 'Lien collectif généré !' : 'Lien d\'invitation généré !');
              }
              setShowInvitePlayer(false);
              setInviteResult({ email: data.email || '', link });
            } catch (err: any) { toast.error('Erreur: ' + err.message); }
          }}
        />
      )}
      {inviteResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setInviteResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-accent" /></div>
              <h3 className="text-lg font-bold text-foreground">{inviteResult.email ? 'Invitation envoyée' : 'Lien généré'}</h3>
              {inviteResult.email && <p className="text-sm text-muted-foreground mt-1">{inviteResult.email}</p>}
            </div>
            <div className="mx-6 mb-4 space-y-2">
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                <Mail size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lien d'inscription</p>
                  <p className="text-xs font-medium text-foreground truncate">{inviteResult.link}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(inviteResult.link); toast.success('Lien copié !'); }} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">📋 Vous pouvez aussi partager ce lien directement. Il expire dans 48h.</p>
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setInviteResult(null)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}
      {showAddEvent && <AddEventForm onSubmit={addEvent} onClose={() => setShowAddEvent(false)} isDirigeant={currentUser?.role === 'dirigeant'} />}
      {showAddNews && <AddNewsForm onSubmit={addNews} onClose={() => setShowAddNews(false)} />}
      {showAddCard && <AddCardForm players={visiblePlayers} selectedPlayerId={selectedPlayerForCard} onSubmit={addCard} onClose={() => { setShowAddCard(false); setSelectedPlayerForCard(null); }} />}
      {showChangePassword && <ChangePasswordForm onClose={() => setShowChangePassword(false)} />}
      {showAdminResetPassword && selectedMemberForReset && <AdminResetPasswordForm member={selectedMemberForReset} onClose={() => { setShowAdminResetPassword(false); setSelectedMemberForReset(null); }} />}
      {showAvatarModal && currentUser && <AvatarModal currentUser={currentUser} onClose={() => { setShowAvatarModal(false); setAvatarFocusLicense(false); }} onAvatarUpdated={(photoURL) => setCurrentUser({ ...currentUser, photoURL })} focusLicense={avatarFocusLicense} onStartTutorial={() => setShowTutorial(true)} />}
      {showPushTest && <SendPushNotifForm onClose={() => setShowPushTest(false)} />}
      {showLicenseReminder && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowLicenseReminder(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mb-4"><Shield size={32} className="text-warning" /></div>
              <h3 className="text-lg font-bold text-foreground">Licence non renseignée</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center">Votre date d'expiration de licence FFF n'est pas encore renseignée. Merci de la mettre à jour dans votre profil.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowLicenseReminder(false)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all text-sm">Plus tard</button>
              <button onClick={() => { setShowLicenseReminder(false); setAvatarFocusLicense(true); setShowAvatarModal(true); }} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-primary/20">Mettre à jour</button>
            </div>
          </div>
        </div>
      )}
      {confirmModal && <ConfirmModal title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onClose={() => setConfirmModal(null)} />}
      {playerCreatedResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setPlayerCreatedResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-accent" /></div>
              <h3 className="text-lg font-bold text-foreground">Joueur ajouté avec succès</h3>
              <p className="text-sm text-muted-foreground mt-1">{playerCreatedResult.name}</p>
            </div>
            {playerCreatedResult.withAccount && playerCreatedResult.email && (
              <div className="mx-6 mb-4 space-y-2">
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <Mail size={16} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</p><p className="text-sm font-medium text-foreground truncate">{playerCreatedResult.email}</p></div>
                  <button onClick={() => navigator.clipboard.writeText(playerCreatedResult.email || '')} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50">
                  <KeyRound size={16} className="text-accent shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mot de passe</p><p className="text-sm font-medium text-foreground font-mono">{playerCreatedResult.password}</p></div>
                  <button onClick={() => navigator.clipboard.writeText(playerCreatedResult.password || '')} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copier"><Copy size={14} className="text-muted-foreground" /></button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-2 px-2">📋 Communique ces identifiants au joueur pour qu'il puisse se connecter</p>
              </div>
            )}
            <div className="p-4 border-t border-border"><button onClick={() => setPlayerCreatedResult(null)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">Parfait !</button></div>
          </div>
        </div>
      )}
      {eventCreatedResult && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setEventCreatedResult(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4"><CalendarDays size={32} className="text-accent" /></div>
              <h3 className="text-lg font-bold text-foreground">Événement créé avec succès</h3>
              <p className="text-sm text-muted-foreground mt-1">{eventCreatedResult.title}</p>
            </div>
            <div className="mx-6 mb-4 space-y-2">
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50"><Calendar size={16} className="text-accent shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</p><p className="text-sm font-medium text-foreground">{new Date(eventCreatedResult.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div>
              <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50"><Trophy size={16} className="text-accent shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</p><p className="text-sm font-medium text-foreground">{eventCreatedResult.type === 'match' ? '⚽ Match' : eventCreatedResult.type === 'training' ? '🏃 Entraînement' : '📌 Autre'}</p></div></div>
              {eventCreatedResult.notified ? (
                <div className="flex items-center gap-3 p-3 bg-accent/5 rounded-xl border border-accent/20"><Bell size={16} className="text-accent shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p><p className="text-sm font-medium text-accent">{eventCreatedResult.notifCount} joueur{eventCreatedResult.notifCount > 1 ? 's' : ''} notifié{eventCreatedResult.notifCount > 1 ? 's' : ''} par email</p></div></div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-secondary/60 rounded-xl border border-border/50"><Bell size={16} className="text-muted-foreground shrink-0" /><div className="flex-1"><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</p><p className="text-sm text-muted-foreground">Aucune notification envoyée</p></div></div>
              )}
            </div>
            <div className="p-4 border-t border-border"><button onClick={() => setEventCreatedResult(null)} className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-medium hover:brightness-110 transition-all text-sm shadow-lg shadow-accent/20">Parfait !</button></div>
          </div>
        </div>
      )}

      {/* Welcome modal */}
      <AnimatePresence>
        {welcomeName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 pb-24 sm:pb-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 60 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280, delay: 0.1 }}
              className="relative max-w-sm w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-card to-card/95 border border-border/50 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]"
            >
              <motion.div
                animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-primary/25 rounded-full blur-[80px] pointer-events-none"
              />
              <div className="relative z-10 px-8 pt-10 pb-8 text-center">
                <div className="relative inline-flex items-center justify-center mb-7">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-28 h-28 rounded-full border border-primary/15"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute w-24 h-24 rounded-full border border-primary/20"
                  />
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.3 }}
                    className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-primary/10"
                  >
                    <img src={clubLogo} alt="FCO" className="w-13 h-13 object-contain drop-shadow-md" />
                  </motion.div>
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-xs font-bold uppercase tracking-[0.25em] text-primary/60 mb-3"
                >Bienvenue au club</motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight"
                >
                  Salut{' '}
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{welcomeName}</span> 👋
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="text-sm text-muted-foreground mt-3 leading-relaxed"
                >Tout est prêt pour toi. On te fait un tour rapide ?</motion.p>
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setWelcomeName(null); setTutorialMandatory(true); setShowTutorial(true); }}
                  className="mt-8 w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/30"
                >Découvrir l'app 🚀</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding tutorial */}
      {showTutorial && currentUser && (
        <OnboardingTutorial
          userRole={currentUser.role}
          onComplete={() => { setShowTutorial(false); setTutorialMandatory(false); setTimeout(() => setActiveTab('home'), 400); setTimeout(() => { if (licenseNeedsReminder) setShowLicenseReminder(true); }, 1000); }}
          onTabChange={handleTabChange}
          mandatory={tutorialMandatory}
        />
      )}
    </div>
  );
};

export default Dashboard;
