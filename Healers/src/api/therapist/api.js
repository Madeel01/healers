import apiClient from '../apiClient';

export const therapistUsers = async (params = {}) => {
  const response = await apiClient.get("/therapist/get_therapist_user", { params });
  return response.data;
};

export const getChildPrograms = async (childId, therapistId) => {
  const response = await apiClient.get(`/therapist/get_child_programs/${childId}`, {
    params: { therapistId },
  });
  return response.data;
};

export const AddPrograms = async (payload) => {
  const response = await apiClient.post("/therapist/add_programs", payload);
  return response.data;
};

export const addGoalToProgramApi = async (programId, title) => {
  const response = await apiClient.post(`/therapist/delete_program/${programId}/add_goal`, {
    title,
  });
  return response.data;
};

export const deleteProgramApi = async (programId) => {
  const response = await apiClient.delete(`/therapist/delete_program/${programId}`);
  return response.data;
};

export const deleteGoalApi = async (programId, goalId) => {
  const response = await apiClient.delete(`/therapist/delete_program/${programId}/goal/${goalId}`);
  return response.data;
};
