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

        // Register with FCM
        await PushNotifications.register();

        // Listen for token
        PushNotifications.addListener('registration', async (token) => {
          console.log('FCM Token:', token.value);
          // Store the token in Supabase
          const { error } = await supabase
            .from('fcm_tokens')
            .upsert({
              user_id: userId,
              token: token.value,
              platform: Capacitor.getPlatform(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          
          if (error) {
            console.error('Error storing FCM token:', error);
          } else {
            registered.current = true;
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
