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
export const getChildSummeryApi  = async () => {
  const response = await apiClient.get("/auth/users/summery/unread-count");
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

export const adminLoginAsUserApi = async (userId) => {
  const response = await apiClient.post(
    "/auth/users/impersonate",
    { userId },
  );

  return response.data;
};



export const getPermissionsApi = async () => {
  const response = await apiClient.get(`/auth/permissions`);
  return response.data;
};

export const getPermissionGroupsApi = async () => {
  const response = await apiClient.get(`/auth/permission-groups`);
  return response.data;
};

export const createPermissionGroupApi = async (body) => {
  const response = await apiClient.post(`/auth/permission-groups`, body);
  return response.data;
};

export const updatePermissionGroupApi = async (id, body) => {
  const response = await apiClient.put(`/auth/permission-groups/${id}`, body);
  return response.data;
};

export const deletePermissionGroupApi = async (id) => {
  const response = await apiClient.delete(`/auth/permission-groups/${id}`);
  return response.data;
};

export const getPermissionAssignmentsApi = async () => {
  const response = await apiClient.get(`/auth/permission-assignments`);
  return response.data;
};

export const setManagerGroupsApi = async (userId, groupIds) => {
  const response = await apiClient.put(
    `/auth/permission-assignments/${userId}`,
    { groupIds }
  );
  return response.data;
};
export const getMyPermissionsApi = async () => {
  const res = await apiClient.get("/auth/my-permissions");
  return res.data;
};