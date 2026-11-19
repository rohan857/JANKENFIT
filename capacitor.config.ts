/**
 * Capacitor Configuration for standalone Android (.apk) and iOS (.ipa) builds.
 * Android external app data directory: Android/data/com.janken.fit/files/
 * Build web bundle: `CAPACITOR_BUILD=1 npm run build`
 * Sync native shells: `npx cap sync android` / `npx cap sync ios`
 */
interface CapacitorAppConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme: 'https' | 'http';
    iosScheme?: string;
    cleartext?: boolean;
  };
  android?: {
    backgroundColor: string;
    allowMixedContent: boolean;
    captureInput: boolean;
    webContentsDebuggingEnabled: boolean;
  };
  ios?: {
    scheme: string;
    contentInset: 'automatic' | 'scrollableAxes' | 'never' | 'always';
    backgroundColor: string;
    limitsNavigationsToAppBoundDomains?: boolean;
  };
  plugins?: {
    StatusBar?: {
      style: 'DARK' | 'LIGHT';
      backgroundColor: string;
    };
  };
}

const config: CapacitorAppConfig = {
  appId: 'com.janken.fit',
  appName: 'JANKENFIT',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'jankenfit',
    cleartext: false,
  },
  android: {
    backgroundColor: '#2B1B12',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    scheme: 'JANKENFIT',
    contentInset: 'automatic',
    backgroundColor: '#2B1B12',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2B1B12',
    },
  },
};

export default config;
