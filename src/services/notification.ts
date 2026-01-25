// Push Notification Service for Cook Web Panel

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

class NotificationService {
  private permission: NotificationPermission = "default";
  private audio: HTMLAudioElement | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      this.permission = Notification.permission;
      this.audio = new Audio(
        "https://server-v2.kepket.uz/mixkit-positive-notification-951.wav"
      );
    }
  }

  // Check if notifications are supported
  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  // Get current permission status
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.warn("Notifications are not supported in this browser");
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return "denied";
    }
  }

  // Show a notification
  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn("Notifications are not supported");
      return null;
    }

    // Request permission if not granted
    if (Notification.permission === "default") {
      await this.requestPermission();
    }

    if (Notification.permission !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/logo.png",
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }

  // Play notification sound
  async playSound(): Promise<void> {
    if (!this.soundEnabled || !this.audio) return;

    try {
      this.audio.currentTime = 0;
      await this.audio.play();
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }

  // Set sound enabled/disabled
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  // Get sound enabled status
  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  // Show notification for new order
  async showNewOrderNotification(
    tableName: string,
    itemCount: number,
    items: Array<{ foodName?: string; name?: string; quantity?: number }>
  ): Promise<void> {
    // Play sound
    await this.playSound();

    // Build notification body
    const itemNames = items
      .slice(0, 3)
      .map((item) => `${item.foodName || item.name} x${item.quantity || 1}`)
      .join(", ");

    const body =
      items.length > 3
        ? `${itemNames} va yana ${items.length - 3} ta...`
        : itemNames;

    // Show push notification
    await this.show({
      title: `Yangi buyurtma - ${tableName}`,
      body: body || `${itemCount} ta taom`,
      tag: "new-order",
      requireInteraction: true,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
