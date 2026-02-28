// ==========================================
// push-manager.js
// Handles Web Push API Subscription & Supabase saving
// ==========================================

class PushManager {
    constructor() {
        this.vapidPublicKey = null; // Will be fetched from app_config
        this.serviceWorkerRegistration = null;
        this.isEnabled = false;
    }

    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported by this browser.');
            return false;
        }

        try {
            // 1. Wait for SW registration
            this.serviceWorkerRegistration = await navigator.serviceWorker.ready;

            // 2. Fetch VAPID key from Supabase app_config
            const { data, error } = await window.supabaseClient
                .from('app_config')
                .select('value')
                .eq('key', 'vapid_public_key')
                .single();

            if (error || !data) {
                console.warn('Could not load VAPID key from config:', error);
                return false;
            }

            this.vapidPublicKey = data.value;
            this.isEnabled = true;

            return true;
        } catch (error) {
            console.error('Failed to initialize push manager:', error);
            return false;
        }
    }

    async requestPermissionAndSubscribe(userEmail) {
        // Generate unique device ID if not exists
        let deviceId = localStorage.getItem('bunkit_device_id');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('bunkit_device_id', deviceId);
        }

        // If user is a guest (no email), format a pseudo-email to bypass DB NOT NULL constraints
        if (!userEmail) {
            userEmail = `guest_${deviceId}@bunkit.local`;
        }
        if (!this.isEnabled) {
            const initialized = await this.init();
            if (!initialized) return false;
        }

        try {
            console.log("Requesting notification permission...");
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                console.log('Notification permission denied.');
                return false;
            }

            console.log('Notification permission granted, subscribing to push service...');

            const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
            });

            console.log('Got Push Subscription, saving to DB...');

            // Save to Supabase
            const { error } = await window.supabaseClient
                .from('push_subscriptions')
                .upsert({
                    user_email: userEmail,
                    device_id: deviceId,
                    subscription_json: subscription.toJSON()
                }, { onConflict: 'user_email,device_id' });

            if (error) {
                console.error('Failed to save push subscription to DB:', error);
                return false;
            }

            console.log('Successfully saved push subscription!');
            return true;
        } catch (error) {
            console.error('Error during push subscription process:', error);
            return false;
        }
    }

    // Helper function to convert VAPID string
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Attach to window globally for non-module usage
window.pushManager = new PushManager();
