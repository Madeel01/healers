import apiClient from './apiClient';

export const GetUsers = async (payload = { filter }) => {
  const response = await apiClient.post("/auth/get_user", payload);
  return response.data.data; 
};