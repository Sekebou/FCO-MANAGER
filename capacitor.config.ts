import type { CapacitorConfig } from '@capacitor/cli';

// Set to true for development (hot-reload from Lovable preview)
// Set to false for production builds (native local files)
const USE_REMOTE_SERVER = false;

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
    webContentsDebuggingEnabled: true,
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
