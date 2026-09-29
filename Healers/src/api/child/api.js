import apiClient from '../apiClient';

export const getChildFeedbackRequests = (status = "all", page = 1) =>
  apiClient.get(
    `/child/feedback/${status}?page=${page}`,
  );

export const createChildFeedback = (data) => apiClient.post("/child/feedback", data);

export const addChildFeedbackReply = (feedbackId, message) =>
  apiClient.post(`/child/feedback/${feedbackId}/reply`, {
    message,
  });

export const deleteChildFeedback = (feedbackId) => apiClient.delete(`/child/feedback/${feedbackId}/reply`);

export const getChildFeedbackReplies = (appointmentId) => apiClient.get(`/child/feedback/replies/${appointmentId}`);

export const getChildAttendance = async (params = {}) => {
  const response = await apiClient.get("/child/get_ChildAttendance", { params });
  return response.data;
};

export const getChildVideos = async (childId, page = 1, limit = 2) => {
  const response = await apiClient.get(
    `/child/video/child/${childId}?page=${page}&limit=${limit}`,
  );
  return response.data;
};

export const getAssignUser = async (userId, role) => {
  const response = await apiClient.get("/child/assign_therapist", {
    params: { userId, role },
  });
  return response.data;
};
export const getConversations = async (page = 1, limit = 5) => {
  const response = await apiClient.get(`/chat/conversations?page=${page}&limit=${limit}`);
  return response.data;
};

export const getMessagesApi = async (conversationId) => {
  const response = await apiClient.get(`/chat/messages/${conversationId}`);
  return response.data;
};

export const sendMessageApi = async (payload) => {
  // payload: { senderId, receiverId, text }
  const response = await apiClient.post("/chat/messages", payload);
  return response.data;
};

export const markAsSeenApi = async (payload) => {
  // payload: { conversationId, userId }
  const response = await apiClient.post("/chat/messages/mark-as-seen", payload);
  return response.data;
};
