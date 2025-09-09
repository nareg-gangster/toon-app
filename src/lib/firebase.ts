import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  // You'll need to replace these with your actual Firebase config values
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: any;
if (typeof window !== 'undefined') {
  messaging = getMessaging(app);
}

export { messaging };

// Function to get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  try {
    if (!messaging) return null;
    
    const currentToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    });
    
    if (currentToken) {
      console.log('📱 FCM registration token:', currentToken);
      return currentToken;
    } else {
      console.log('❌ No registration token available.');
      return null;
    }
  } catch (err) {
    console.error('❌ An error occurred while retrieving token:', err);
    return null;
  }
};

// Function to setup foreground message listener
export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    
    onMessage(messaging, (payload) => {
      console.log('📨 Received foreground message:', payload);
      resolve(payload);
    });
  });