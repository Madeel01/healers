import apiClient from '../apiClient';

export const Overview = async () => {
  const response = await apiClient.get("/admin/overview");
  return response.data;
};
export const therapistUsers = async (params = {}) => {
  const response = await apiClient.get("/admin/get_therapists",{ params });
  return response.data;
}