import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const registerPushNotifications = async () => {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      "session-reminders",
      {
        name: "Session Reminders",
        importance:
          Notifications.AndroidImportance.HIGH,
        sound: "default",
      },
    );
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
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId
    ?? Constants?.easConfig?.projectId;

  if (!projectId) {
    console.log("EAS projectId not found");
    return null;
  }

  const token =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

  return token.data;
};