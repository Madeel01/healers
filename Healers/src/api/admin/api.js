import apiClient from '../apiClient';

export const Overview = async () => {
  const response = await apiClient.get("/admin/overview");
  return response.data;
};

///////////////////// Therapist API's /////////////////////////////
export const therapistUsers = async (params = {}) => {
  const response = await apiClient.get("/admin/get_therapists",{ params });
  return response.data;
}

export const createTherapist = async (payload) => {
  const response = await apiClient.post("/admin/therapists", payload);
  return response.data;
};
 
export const updateTherapist = async (id, payload) => {
  const response = await apiClient.put(`/admin/therapists/${id}`, payload);
  return response.data;
};
 
export const deleteTherapist = async (id) => {
  const response = await apiClient.delete(`/admin/therapists/${id}`);
  return response.data;
};

export const assignChildrenToTherapist = async ({ therapistId, addChildIds,removeChildIds }) => {
  const response = await apiClient.post("/admin/therapists/assign", {
    therapistId,
    addChildIds,
    removeChildIds
  });
  return response.data;
};

export const getUsersByRole = async (params = {}) => {
  const response = await apiClient.get("/admin/users",{ params });
  return response.data;
}
///////////////////// Schedule API's /////////////////////////////

export const createSchedule = (body) =>
  apiClient.post('/scheduling', body).then((r) => r.data);

export const getSchedule = (params) =>
  apiClient.get('/scheduling', { params }).then((r) => r.data);

export const addAppointment = (body) =>
  apiClient.post('/scheduling/appointment', body).then((r) => r.data);

export const updateAppointment = (body) =>
  apiClient.put('/scheduling/appointment', body).then((r) => r.data);

export const deleteAppointment = (body) =>
  apiClient.delete('/scheduling/appointment', { data: body }).then((r) => r.data);

export const getTherapistSchedules = (params) =>
  apiClient.get('/scheduling/therapist', { params }).then((r) => r.data);


///////////////////// Children API's /////////////////////////////
export const childUsers = (params) => apiClient.get("/admin/children", { params });
export const createChild = (data) => apiClient.post("/admin/children", data);
export const updateChild = (id, data) => apiClient.put(`/admin/children/${id}`, data);
export const deleteChild = (id) => apiClient.delete(`/admin/children/${id}`);

///////////////////// Leave Request API's /////////////////////////////
export const getLeaveRequests = (params) => apiClient.get("/admin/leave-requests", { params });
export const approveLeaveRequest = (id) => apiClient.put(`/admin/leave-requests/${id}/approve`);
export const rejectLeaveRequest = (id, rejectionReason) =>
  apiClient.put(`/admin/leave-requests/${id}/reject`, { rejectionReason });
export const getStaffOnLeaveToday = () => apiClient.get("/admin/leave-requests/on-leave-today");

///////////////////// Feedback Request API's /////////////////////////////
export const getFeedbackRequests = (params) => apiClient.get(`/admin/feedback/${params.status}`);
export const deleteFeedback = (feedbackId) => apiClient.delete(`/admin/feedback/${feedbackId}`);
export const getFeedbackReplies = async (feedbackId) => {
  const response = await apiClient.get(
    `/admin/feedback/${feedbackId}/replies`
  );
  return response.data;
};
export const addFeedbackReply = async (feedbackId, message) => {
  const response = await apiClient.post(
    `/admin/feedback/${feedbackId}/replies`,
    { message }
  );
  return response.data;
};

///////////////////// Batch API's /////////////////////////////
export const getBatches = (params) =>
  apiClient.get("/admin/batches", { params }).then((r) => r.data);

export const createBatch = (data) =>
  apiClient.post("/admin/batches", data).then((r) => r.data);

export const updateBatch = (id, data) =>
  apiClient.put(`/admin/batches/${id}`, data).then((r) => r.data);

export const deleteBatch = (id) =>
  apiClient.delete(`/admin/batches/${id}`).then((r) => r.data);
