import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f724ebf3745f46d69ffcd9e0270da6cb',
  appName: 'blue-pitch-dash',
  webDir: 'dist',
  server: {
    url: 'https://f724ebf3-745f-46d6-9ffc-d9e0270da6cb.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
