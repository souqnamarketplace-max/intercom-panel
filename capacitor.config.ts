import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.intercomplatform.panel',
  appName: 'Intercom Panel',
  webDir: 'dist',
  android: {
    // Panels are wall-mounted and always plugged in - no reason to ever
    // let the display sleep or dim on its own.
    allowMixedContent: false,
  },
};

export default config;
