import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bunkmate.app',
  appName: 'BunkMate',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#4f46e5"
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth : false,
        biometricTitle : "Biometric login for query",
        biometricSubTitle : "Please authenticate"
      }
    }
  }
};

export default config;
