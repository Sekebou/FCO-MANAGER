import type { CapacitorConfig } from '@capacitor/cli';

// Set to true for development (hot-reload from Lovable preview)
// Set to false for production builds (native local files)
const USE_REMOTE_SERVER = false;

const config: CapacitorConfig = {
  appId: 'app.lovable.f724ebf3745f46d69ffcd9e0270da6cb',
  appName: 'blue-pitch-dash',
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
};

export default config;
