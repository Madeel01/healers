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
