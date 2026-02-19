import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook to register for push notifications on native platforms.
 * Stores the FCM token in Supabase fcm_tokens table.
 */
export function usePushNotifications(userId: string | undefined) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || registered.current) return;
    if (!Capacitor.isNativePlatform()) return;

    const register = async () => {
      try {
        // Check / request permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.log('Push notifications permission not granted');
          return;
        }

        // Listen for token BEFORE calling register to avoid race condition
        PushNotifications.addListener('registration', async (token) => {
          console.log('FCM Token:', token.value);
          try {
            // First, delete any existing rows with the same token (from other users)
            // This prevents duplicate notifications on the same device
            await supabase
              .from('fcm_tokens')
              .delete()
              .eq('token', token.value);

            // Then upsert for the current user (conflict on token to support multiple devices)
            const { error } = await supabase
              .from('fcm_tokens')
              .upsert({
                user_id: userId,
                token: token.value,
                platform: Capacitor.getPlatform(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'token' });
            
            if (error) {
              console.error('Error storing FCM token:', error);
            } else {
              registered.current = true;
            }
          } catch (e) {
            console.error('Error saving FCM token:', e);
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Handle received notifications when app is in foreground
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          toast.info(notification.title || 'Notification', {
            description: notification.body || '',
          });
        });

        // Handle notification tap (app was in background)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push notification action:', action);
        });

        // Register with FCM - wrapped in its own try/catch to prevent native crash propagation
        try {
          await PushNotifications.register();
        } catch (registerErr) {
          console.error('FCM register() failed (google-services.json missing?):', registerErr);
        }

      } catch (err) {
        console.error('Push notification setup error:', err);
      }
    };

    register();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [userId]);
}
