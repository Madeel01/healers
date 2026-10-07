import apiClient from '../apiClient';

export const Overview = async () => {
  const response = await apiClient.get("/admin/overview");
  return response.data;
};
export const getTherapistSchedule = async (therapistId, params) => {
  const res = await apiClient.get(`/admin/therapists/${therapistId}/schedule`, { params });
  return res.data;
};
export const childUsers = (params) => apiClient.get("/admin/children", { params });

export const createChild = (data) => apiClient.post("/admin/children", data);

export const updateChild = (id, data) => apiClient.put(`/admin/children/${id}`, data);

export const deleteChild = (id) => apiClient.delete(`/admin/children/${id}`);

export const getChildSchedule = async (childId, params) => {
  const res = await apiClient.get(`/admin/children/${childId}/schedule`, { params });
  return res.data;
};
export const getChildBatchOptions = async (childId) => {
  const res = await apiClient.get(`/admin/children/${childId}/batch-options`);
  return res.data;
};
export const getChildCustomSlotOptions = async (childId, body) => {
  const res = await apiClient.post(`/admin/children/${childId}/custom-slot-options`, body);
  return res.data;
};
export const createChildCustomAppointment = async (childId, body) => {
  const res = await apiClient.post(`/admin/children/${childId}/custom-appointments`, body);
  return res.data;
};
export const deleteChildCustomAppointment = async (childId, appointmentId) => {
  const res = await apiClient.delete(`/admin/children/${childId}/custom-appointments/${appointmentId}`);
  return res.data;
};


///////////////////// Therapist API's /////////////////////////////
export const therapistUsers = async (params = {}) => {
  const response = await apiClient.get("/admin/get_therapists", { params });
  return response.data;
};

export const AssignTheraistChild = async () => {
  const response = await apiClient.get("/admin/get_therapists_child");
  return response.data;
};

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

export const assignChildrenToTherapist = async ({ therapistId, addChildIds, removeChildIds }) => {
  const response = await apiClient.post("/admin/therapists/assign", {
    therapistId,
    addChildIds,
    removeChildIds,
  });
  return response.data;
};



///////////////////// Schedule API's /////////////////////////////
export const createSchedule = (body) => apiClient.post("/scheduling", body).then((r) => r.data);

export const getSchedule = (params) => apiClient.get("/scheduling", { params }).then((r) => r.data);

export const addAppointment = (body) => apiClient.post("/scheduling/appointment", body).then((r) => r.data);

export const updateAppointment = (body) => apiClient.put("/scheduling/appointment", body).then((r) => r.data);

export const deleteAppointment = (body) =>
  apiClient.delete("/scheduling/appointment", { data: body }).then((r) => r.data);

export const getTherapistSchedules = (params) => apiClient.get("/scheduling/therapist", { params }).then((r) => r.data);

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
    `/admin/feedback/${feedbackId}/replies`,
  );
  return response.data;
};

export const addFeedbackReply = async (feedbackId, message) => {
  const response = await apiClient.post(
    `/admin/feedback/${feedbackId}/replies`,
    { message },
  );
  return response.data;
};

///////////////////// Batch API's /////////////////////////////
export const getSessions = (params) => apiClient.get("/admin/schedule", { params }).then((r) => r.data);

export const getBatches = (params) => apiClient.get("/admin/batches", { params }).then((r) => r.data);

export const createBatch = (data) => apiClient.post("/admin/batches", data).then((r) => r.data);

export const getBatchPackageOptions = () => apiClient.get("/admin/batches/batch-packages").then((r) => r.data);

export const getBatchScheduleData = (batchId) =>
  apiClient.get(`/admin/batches/schedule/${batchId}`).then((r) => r.data);

export const getBatchTherapistOptions = (batchId) =>
  apiClient.get(`/admin/batches/${batchId}/therapist-options`).then((r) => r.data);

export const getBatchSlotOptions = (batchId, data) =>
  apiClient.post(`/admin/batches/${batchId}/schedule/options`, data).then((r) => r.data);

export const previewBatchSchedule = (batchId, data) =>
  apiClient.post(`/admin/batches/${batchId}/schedule/preview`, data).then((r) => r.data);

export const saveBatchSchedule = (batchId, data) =>
  apiClient.post(`/admin/batches/${batchId}/schedule`, data).then((r) => r.data);

export const getBatchEligibleChildren = (batchId, search = "") =>
  apiClient
    .get(`/admin/batches/${batchId}/eligible-children`, { params: { search } })
    .then((r) => r.data);

export const updateBatchChildren = (batchId, data) =>
  apiClient.put(`/admin/batches/${batchId}/children`, data).then((r) => r.data);

export const removeBatchAssignment = (batchId, assignmentId) =>
  apiClient
    .delete(`/admin/batches/${batchId}/assignments/${assignmentId}`)
    .then((r) => r.data);

export const updateBatch = (id, data) => apiClient.put(`/admin/batches/${id}`, data).then((r) => r.data);

export const getSessionSlotOptions = async (batchId, assignmentId, body) => {
  const res = await apiClient.post(`/admin/batches/${batchId}/assignments/${assignmentId}/slot-options`, body);
  return res.data;
};

export const createAdditionalSession = async (batchId, assignmentId, body) => {
  const res = await apiClient.post(`/admin/batches/${batchId}/assignments/${assignmentId}/additional`, body);
  return res.data;
};

export const postponeBatchSession = async (batchId, assignmentId, sessionId, body) => {
  const res = await apiClient.post(
    `/admin/batches/${batchId}/assignments/${assignmentId}/sessions/${sessionId}/postpone`,
    body,
  );
  return res.data;
};

export const deleteBatchSession = (batchId, assignmentId, sessionId) =>
  apiClient
    .delete(`/admin/batches/${batchId}/assignments/${assignmentId}/sessions/${sessionId}`)
    .then((r) => r.data);

export const getAllPackages = async (page = 1, limit = 5, search = "") => {
  const res = await apiClient.get("/admin/packages", { params: { page, limit, search } });
  return res.data;
};



export const getPackageById = (packageId) =>
  apiClient
    .get(`/admin/packages/${packageId}`)
    .then((res) => res.data);

export const createPackage = (body) =>
  apiClient
    .post("/admin/packages", body)
    .then((res) => res.data);

export const updatePackage = (packageId, body) =>
  apiClient
    .put(`/admin/packages/${packageId}`, body)
    .then((res) => res.data);

export const deletePackage = (packageId) =>
  apiClient
    .delete(`/admin/packages/${packageId}`)
    .then((res) => res.data);

export const deleteBatch = (id) => apiClient.delete(`/admin/batches/${id}`).then((r) => r.data);

///////////////////// BroadCast API's /////////////////////////////
export const createBroadcast = (formData) =>
  apiClient.post("/admin/broadcast", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateBroadcast = (broadcastId, formData) =>
  apiClient.put(`/admin/broadcast/${broadcastId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });

export const getBroadcastById = (broadcastId) => apiClient.get(`/admin/broadcast/${broadcastId}`);

export const getBroadcasts = (page = 1, limit = 20, search = "", status = "", type = "") =>
  apiClient.get("/admin/broadcast", { params: { page, limit, search, status, type } });

export const deleteBroadcast = (broadcastId, IsHide = false, userID = null) =>
  apiClient.delete(`/admin/broadcast/${broadcastId}`, {
    data: {
      IsHide,
      userID,
    },
  });

///////////////////// Complaints API's /////////////////////////////
export const getComplaints = (params = {}) => apiClient.get("/admin/complaints", { params }).then((res) => res.data);

export const resolveComplaint = (complaintId, resolutionNote = "") =>
  apiClient
    .put(`/admin/complaints/${complaintId}/resolve`, { resolutionNote })
    .then((res) => res.data);

export const updateComplaintPriority = (complaintId, priority) =>
  apiClient
    .put(`/admin/complaints/${complaintId}/priority`, { priority })
    .then((res) => res.data);

export const getComplaintMessages = (complaintId) =>
  apiClient.get(`/admin/complaints/${complaintId}/messages`).then((res) => res.data);

export const sendComplaintMessage = (complaintId, text) =>
  apiClient
    .post(`/admin/complaints/${complaintId}/messages`, { text })
    .then((res) => res.data);

///////////////////// Common API's /////////////////////////////
export const getParents = (params = {}) => apiClient.get("/admin/parents", { params }).then((res) => res.data);

export const getUsersByRole = async (params = {}) => {
  const response = await apiClient.get("/admin/users", { params });
  return response.data;
};

///////////////////// Notification API's /////////////////////////////
export const getAllNotifications = (params) => apiClient.get("/admin/notifications", { params }).then((r) => r.data);

export const markNotificationRead = (id) => apiClient.put(`/admin/notifications/${id}/read`).then((r) => r.data);

export const markAllNotificationsRead = () => apiClient.put("/admin/notifications/read-all").then((r) => r.data);



///////////////////// Availability API's /////////////////////////////
export const getAvailability = (params) =>
  apiClient.get("/admin/scheduling/availability", { params }).then((r) => r.data);

export const createAvailability = (body) => apiClient.post("/admin/scheduling/availability", body).then((r) => r.data);

export const updateAvailability = (id, body) =>
  apiClient.put(`/admin/scheduling/availability/${id}`, body).then((r) => r.data);

export const deleteAvailability = (id) => apiClient.delete(`/admin/scheduling/availability/${id}`).then((r) => r.data);



export const getServices = async (params = {}) => {
  const response = await apiClient.get("/admin/services", { params });
  return response.data;
};

export const createService = async (payload) => {
  const response = await apiClient.post("/admin/services", payload);
  return response.data;
};

export const updateService = async (id, payload) => {
  const response = await apiClient.put(`/admin/services/${id}`, payload);
  return response.data;
};

export const deleteService = async (id) => {
  const response = await apiClient.delete(`/admin/services/${id}`);
  return response.data;
};

