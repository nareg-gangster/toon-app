import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
}

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (!Capacitor.isNativePlatform() || this.isInitialized) {
      return;
    }

    try {
      // Request permission to use push notifications
      const permissionResult = await PushNotifications.requestPermissions();
      
      if (permissionResult.receive === 'granted') {
        console.log('✅ Push notification permission granted');
        
        // Register with FCM
        await PushNotifications.register();
        
        // Set up listeners
        this.setupListeners();
        
        this.isInitialized = true;
      } else {
        console.log('❌ Push notification permission denied');
      }
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
    }
  }

  private setupListeners() {
    // On registration success, save the token
    PushNotifications.addListener('registration', (token) => {
      console.log('📱 Push registration success, token:', token.value);
      this.saveTokenToSupabase(token.value);
    });

    // Handle registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Push registration error:', error);
    });

    // Handle push notifications received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📨 Push notification received:', notification);
      this.handleForegroundNotification(notification);
    });

    // Handle push notification tapped/opened
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 Push notification action performed:', notification);
      this.handleNotificationTap(notification);
    });
  }

  private async saveTokenToSupabase(token: string) {
    try {
      // We'll implement this when we add the database table for tokens
      console.log('💾 Would save token to database:', token);
    } catch (error) {
      console.error('❌ Error saving token:', error);
    }
  }

  private handleForegroundNotification(notification: any) {
    // Show in-app notification or update notification center
    console.log('🔔 Handling foreground notification:', notification);
  }

  private handleNotificationTap(notification: any) {
    // Navigate to relevant part of the app based on notification data
    const data = notification.notification.data;
    
    if (data?.taskId) {
      // Navigate to task details
      console.log('🎯 Navigating to task:', data.taskId);
    } else if (data?.type === 'family_invite') {
      // Navigate to family settings
      console.log('👨‍👩‍👧‍👦 Navigating to family settings');
    }
  }

  async sendTestNotification() {
    // This would be called from your backend/edge function
    console.log('🧪 Test notification functionality');
  }
}

export const notificationService = new NotificationService();