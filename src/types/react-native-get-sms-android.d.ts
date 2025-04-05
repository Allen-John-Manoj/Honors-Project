declare module 'react-native-get-sms-android' {
    interface SmsFilter {
        box?: 'inbox' | 'sent' | 'draft' | 'outbox' | 'failed' | 'queued';
        maxCount?: number;
        bodyRegex?: string;
    }

    interface SmsMessage {
        _id: string;
        address: string;
        body: string;
        date: string;
    }

    export function list(
        filterJson: string,
        errorCallback: (error: string) => void,
        successCallback: (count: number, smsList: string) => void
    ): void;
}