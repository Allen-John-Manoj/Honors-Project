// Update your react-native-android-notification-listener.d.ts file
declare module 'react-native-android-notification-listener' {
    const NotificationListener: {
        // Include both versions of method names to be safe
        isPermissionGranted: () => Promise<boolean>;
        getPermissionStatus: () => Promise<'authorized' | 'denied' | 'unknown'>;
        requestPermission: () => Promise<void>;
        getNotifications: () => Promise<any[]>;
        // Still include these if you're using them elsewhere
        startService?: () => Promise<any>;
        stopService?: () => Promise<any>;
    };

    export default NotificationListener;
}