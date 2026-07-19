import type { CapacitorConfig } from '@capacitor/cli';

// Charge l'app depuis l'URL publiée Lovable → pas besoin de rebuild Xcode
// Chaque "Publish" sur Lovable = live immédiatement sur le téléphone
const REMOTE_URL = 'https://fco-manager.lovable.app';

const config: CapacitorConfig = {
  appId: 'com.sekebou.fcomanager',
  appName: 'FCO-Manager',
  webDir: 'dist',
  server: {
    url: REMOTE_URL,
    cleartext: true,
  },

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
