import apiClient from './apiClient';

export const GetUsers = async (payload = { filter }) => {
  const response = await apiClient.post("/auth/get_user", payload);
  return response.data.data;
};

export const updateOnlineStatusApi = async (isOnline) => {
  const response = await apiClient.put("/auth/users/online-status", {
    isOnline,
  });
  return response.data;
};

export const switchUserApi = async (userId) => {
  const response = await apiClient.post(`/auth/users/switch-user/${userId}`);
  return response.data;
};

export const updateChildProfile = async (payload) => {
  const response = await apiClient.put(
    "/auth/users/profile",
    payload,
  );
  return response.data;
};

export const deleteChildProfileImage = async () => {
  const response = await apiClient.delete("/auth/users/profile-image");
  return response.data;
};

export const getUnreadNotificationCountApi  = async () => {
  const response = await apiClient.get("/auth/users/notifications/unread-count");
  return response.data;
};

export const getUnreadNotificationsApi = async () => {
  const response = await apiClient.get("/auth/users/notifications/unread");
  return response.data;
};

export const markNotificationAsReadApi = async (notificationId) => {
  const response = await apiClient.post(`/auth/users/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsReadApi = async () => {
  const response = await apiClient.post(`/auth/users/notifications/read-all`);
  return response.data;
};
