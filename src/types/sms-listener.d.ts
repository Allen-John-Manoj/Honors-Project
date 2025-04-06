// types/sms-listener.d.ts
declare module 'react-native-android-sms-listener' {
    export interface SmsMessage {
        originatingAddress: string;
        body: string;
        timestamp: number;
        serviceCenterAddress: string;
    }

    export function addListener(
        callback: (message: SmsMessage) => void
    ): { remove: () => void };
}