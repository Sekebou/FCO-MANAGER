import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Decode a hex string to UTF-8 text.
 * On iOS, the FCM token string gets hex-encoded by Capacitor's Data→hex conversion.
 */
function tryDecodeHexToString(hex: string): string {
  if (/^[0-9A-Fa-f]+$/.test(hex) && hex.length % 2 === 0 && hex.length > 100) {
    try {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      const decoded = new TextDecoder().decode(bytes);
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
 * Safely check if running inside a Capacitor native app.
 */
function isNativePlatform(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Get the Capacitor platform safely.
 */
function getCapacitorPlatform(): string {
  try {
    return (window as any).Capacitor?.getPlatform?.() || 'web';
  } catch {
    return 'web';
  }
}

/**
 * Hook to register for push notifications on native platforms.
 * Stores the FCM token in Supabase fcm_tokens table.
 * 
 * Uses dynamic imports to prevent crashes if the native plugin
 * is not properly configured (e.g. missing Firebase config for
 * release keystore).
 */
export function usePushNotifications(userId: string | undefined) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || registered.current) return;
    if (!isNativePlatform()) return;

    // Defer everything to avoid blocking WebView cold start
    const timeoutId = setTimeout(async () => {
      try {
        // Dynamic import to prevent crash if plugin not available
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Set up listeners first
        await PushNotifications.addListener('registration', async (token) => {
          try {
            const finalToken = tryDecodeHexToString(token.value);
            console.log('FCM Token:', finalToken);
            const currentPlatform = getCapacitorPlatform();
            const { error } = await supabase
              .from('fcm_tokens')
              .upsert({
                user_id: userId,
                token: finalToken,
                platform: currentPlatform,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,platform' });
            
            if (error) {
              console.error('Error storing FCM token:', error);
            } else {
              console.log('FCM token saved successfully');
              registered.current = true;
            }
          } catch (e) {
            console.error('Error in registration listener:', e);
          }
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          try {
            toast.info(notification.title || 'Notification', {
              description: notification.body || '',
            });
          } catch (e) {
            console.error('Error handling push notification:', e);
          }
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push notification action:', action);
        });

        // Check and request permissions
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
        // Catch ALL errors — including native plugin crashes
        console.error('Push notification setup error (non-fatal):', err);
      }
    }, 2000); // 2s delay to let the app fully stabilize

    return () => {
      clearTimeout(timeoutId);
      // Clean up listeners safely
      try {
        import('@capacitor/push-notifications').then(({ PushNotifications }) => {
          PushNotifications.removeAllListeners().catch(() => {});
        }).catch(() => {});
      } catch {}
    };
  }, [userId]);
}
