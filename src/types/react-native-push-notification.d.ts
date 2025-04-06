// Create a file named react-native-push-notification.d.ts in your project's types folder
declare module 'react-native-push-notification' {
    export interface PushNotificationOptions {
        // Add properties as needed
        channelId?: string;
        title?: string;
        message?: string;
        // ... other properties
    }

    const PushNotification: {
        configure: (options: any) => void;
        createChannel: (channel: any, callback?: (created: boolean) => void) => void;
        localNotification: (details: PushNotificationOptions) => void;
        // Add other methods you're using
    };

    export default PushNotification;
}