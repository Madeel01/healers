import { Platform } from 'react-native';

import apiClient from './apiClient';

export const savePushTokenApi = async (pushToken, jwtToken) => {
  const response = await apiClient.post(
    "/auth/users/push-notifications/register",
    {
      pushToken,
      platform: Platform.OS,
    },
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
  );

  return response.data;
};

export const removePushTokenApi = async (pushToken, jwtToken) => {
  const response = await apiClient.delete(
    "/auth/users/push-notifications/unregister",
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      data: {
        pushToken,
      },
    },
  );

  return response.data;
};

export const sendPushNotificationApi = async (payload) => {
  const response = await apiClient.post(
    "/auth/users/push-notifications/send",
    payload,
  );

  return response.data;
};
