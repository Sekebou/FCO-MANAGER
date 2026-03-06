import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Decode a hex string to UTF-8 text.
 * On iOS, the FCM token string gets hex-encoded by Capacitor's Data→hex conversion.
 */
function tryDecodeHexToString(hex: string): string {
  // Check if it looks like a hex-encoded UTF-8 string (only hex chars, even length)
  if (/^[0-9A-Fa-f]+$/.test(hex) && hex.length % 2 === 0 && hex.length > 100) {
    try {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      const decoded = new TextDecoder().decode(bytes);
      // FCM tokens contain ':' and alphanumeric chars
      if (decoded.includes(':') && /^[\w\-:]+$/.test(decoded)) {
        console.log('Decoded hex FCM token:', decoded);
        return decoded;
      }
    } catch {
      // Not a valid hex-encoded string, return as-is
    }
  }
  return hex;
}

/**
 * Hook to register for push notifications on native platforms.
 * Stores the FCM token in Supabase fcm_tokens table.
 */
export function usePushNotifications(userId: string | undefined) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || registered.current) return;
    if (!Capacitor.isNativePlatform()) return;

    // Set up listeners IMMEDIATELY so we don't miss tokens from Firebase
    PushNotifications.addListener('registration', async (token) => {
      const finalToken = tryDecodeHexToString(token.value);
      console.log('FCM Token:', finalToken);
      try {
        const { error } = await supabase
          .from('fcm_tokens')
          .upsert({
            user_id: userId,
            token: finalToken,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'token' });
        
        if (error) {
          console.error('Error storing FCM token:', error);
        } else {
          console.log('FCM token saved successfully');
          registered.current = true;
        }
      } catch (e) {
        console.error('Error saving FCM token:', e);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      toast.info(notification.title || 'Notification', {
        description: notification.body || '',
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification action:', action);
    });

    // Defer the actual register() call to avoid blocking WebView cold start
    const timeoutId = setTimeout(async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.log('Push notifications permission not granted');
          return;
        }

        await PushNotifications.register();
      } catch (err) {
        console.error('Push notification setup error:', err);
      }
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      PushNotifications.removeAllListeners();
    };
  }, [userId]);
}