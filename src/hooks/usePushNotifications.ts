import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { db, doc, setDoc } from '@/lib/firebase';
import { toast } from 'sonner';

/**
 * Hook to register for push notifications on native platforms.
 * Stores the FCM token in Firestore under the user's document.
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
          // Store the token in Firestore
          await setDoc(doc(db, 'fcm_tokens', userId), {
            token: token.value,
            updatedAt: new Date().toISOString(),
            platform: Capacitor.getPlatform(),
          }, { merge: true });
          registered.current = true;
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
          // Could navigate to specific tab based on action data
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
