import { supabase } from '@/lib/supabase';

export interface NotificationTrigger {
  type: 'task_created' | 'task_assigned' | 'task_completed' | 'task_approved' | 'task_overdue' | 'points_awarded' | 'family_invite';
  userId: string;
  title: string;
  body: string;
  data?: any;
}

class NotificationTriggerService {
  
  // Trigger notification when a new task is created
  async triggerTaskCreated(taskId: string, taskTitle: string, assignedUserId: string, createdByUserId: string) {
    await this.sendNotification({
      type: 'task_created',
      userId: assignedUserId,
      title: 'New Task Assigned! 📝',
      body: `You have a new task: "${taskTitle}"`,
      data: { taskId, type: 'task_created' }
    });
  }

  // Trigger notification when task status changes
  async triggerTaskStatusChange(taskId: string, taskTitle: string, status: string, userId: string, assignedUserId: string) {
    let title = '';
    let body = '';
    
    switch (status) {
      case 'completed':
        title = 'Task Completed! ✅';
        body = `${taskTitle} has been marked as completed`;
        // Notify parents when child completes a task
        if (userId === assignedUserId) {
          await this.notifyParents(userId, title, body, { taskId, type: 'task_completed' });
        }
        break;
        
      case 'approved':
        title = 'Task Approved! 🎉';
        body = `Great job! "${taskTitle}" has been approved`;
        // Notify child when parent approves
        await this.sendNotification({
          type: 'task_approved',
          userId: assignedUserId,
          title,
          body,
          data: { taskId, type: 'task_approved' }
        });
        break;
        
      case 'in_progress':
        title = 'Task Started! 🚀';
        body = `"${taskTitle}" is now in progress`;
        // Notify parents when child starts a task
        if (userId === assignedUserId) {
          await this.notifyParents(userId, title, body, { taskId, type: 'task_started' });
        }
        break;
    }
  }

  // Trigger notification for overdue tasks
  async triggerTaskOverdue(taskId: string, taskTitle: string, assignedUserId: string) {
    await this.sendNotification({
      type: 'task_overdue',
      userId: assignedUserId,
      title: 'Task Overdue! ⏰',
      body: `"${taskTitle}" is past its due date`,
      data: { taskId, type: 'task_overdue' }
    });
  }

  // Trigger notification when points are awarded
  async triggerPointsAwarded(userId: string, points: number, reason: string) {
    await this.sendNotification({
      type: 'points_awarded',
      userId,
      title: `${points} Points Earned! 🌟`,
      body: `You earned ${points} points for: ${reason}`,
      data: { points, reason, type: 'points_awarded' }
    });
  }

  // Trigger notification for family invites
  async triggerFamilyInvite(invitedUserId: string, inviterName: string, familyName: string) {
    await this.sendNotification({
      type: 'family_invite',
      userId: invitedUserId,
      title: 'Family Invitation! 👨‍👩‍👧‍👦',
      body: `${inviterName} invited you to join "${familyName}"`,
      data: { inviterName, familyName, type: 'family_invite' }
    });
  }

  // Helper to notify all parents in a family
  private async notifyParents(childUserId: string, title: string, body: string, data: any) {
    try {
      // Get the child's family and find all parents
      const { data: childUser } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', childUserId)
        .single();

      if (childUser?.family_id) {
        const { data: parents } = await supabase
          .from('users')
          .select('id')
          .eq('family_id', childUser.family_id)
          .eq('role', 'parent');

        if (parents) {
          // Send notification to all parents
          const notifications = parents.map(parent => 
            this.sendNotification({
              type: 'task_completed',
              userId: parent.id,
              title,
              body,
              data
            })
          );
          
          await Promise.all(notifications);
        }
      }
    } catch (error) {
      console.error('Error notifying parents:', error);
    }
  }

  // Core function to send notification
  private async sendNotification(trigger: NotificationTrigger) {
    try {
      // Store notification in database for in-app display
      await this.storeNotification(trigger);
      
      // Send push notification (will implement when Firebase is configured)
      await this.sendPushNotification(trigger);
      
      console.log(`✅ Notification sent: ${trigger.title} to user ${trigger.userId}`);
    } catch (error) {
      console.error('❌ Error sending notification:', error);
    }
  }

  // Store notification in database for in-app display
  private async storeNotification(trigger: NotificationTrigger) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: trigger.userId,
          title: trigger.title,
          body: trigger.body,
          type: trigger.type,
          data: trigger.data,
          read: false,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing notification:', error);
      }
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  // Send push notification via Firebase (placeholder for now)
  private async sendPushNotification(trigger: NotificationTrigger) {
    // This would use Firebase Admin SDK to send push notifications
    // For now, we'll just log it
    console.log('📱 Would send push notification:', trigger);
    
    // TODO: Implement Firebase Admin SDK call to send actual push notification
    // This would typically be done via an API route or edge function
  }
}

export const notificationTriggers = new NotificationTriggerService();