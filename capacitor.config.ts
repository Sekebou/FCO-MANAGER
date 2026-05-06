import type { CapacitorConfig } from '@capacitor/cli';

// Remote server keeps the native app on the published Lovable web bundle,
// so JS fixes can go live without another Xcode rebuild.
const USE_REMOTE_SERVER = true;

const config: CapacitorConfig = {
  appId: 'com.sekebou.fcomanager',
  appName: 'FCO-Manager',
  webDir: 'dist',
  ...(USE_REMOTE_SERVER
    ? {
        server: {
          url: 'https://f724ebf3-745f-46d6-9ffc-d9e0270da6cb.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
  android: {
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#0f1a3e',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
