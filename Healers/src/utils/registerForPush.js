// import * as Device from "expo-device";
// import * as Notifications from "expo-notifications";
// import Constants from "expo-constants";
// import { Platform } from "react-native";

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

// export async function registerForPushNotifications() {
//   if (!Device.isDevice) return null;

//   if (Platform.OS === "android") {
//     await Notifications.setNotificationChannelAsync("default", {
//       name: "default",
//       importance: Notifications.AndroidImportance.MAX,
//     });
//   }

//   let { status } = await Notifications.getPermissionsAsync();
//   if (status !== "granted") {
//     ({ status } = await Notifications.requestPermissionsAsync());
//   }
//   if (status !== "granted") return null;

//   const projectId =
//     Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
//   const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
//   return data;
// }