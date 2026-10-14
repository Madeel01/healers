import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

  // Notifications.setNotificationHandler({
  //   handleNotification: async () => ({
  //     shouldShowBanner: true,
  //     shouldShowList: true,
  //     shouldPlaySound: true,
  //     shouldSetBadge: false,
  //   }),
  // });

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Physical device required");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default Notifications",
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

  if (finalStatus !== "granted") {
    console.log("Notification permission denied");
    return null;
  }

  const token = await Notifications.getDevicePushTokenAsync();

  console.log("FCM Token:", token.data);

  return token.data;
}

export function setupNotificationListeners(onNotificationPress) {
  const receivedListener =
    Notifications.addNotificationReceivedListener((notification) => {
      console.log(
        "Push Received:",
        notification.request.content
      );
    });

  const responseListener =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data =
        response.notification.request.content.data;

      console.log("Notification Clicked:", data);

      if (onNotificationPress) {
        onNotificationPress(data);
      }
    });

  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
}
