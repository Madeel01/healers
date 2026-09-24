import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import apiClient from '../apiClient';

export const getDashboardStatsApi = async (params = {}) => {
  try {
    const response = await apiClient.get("/therapist/dashboard-stats", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error?.response?.data || error.message);
    throw error;
  }
};

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

export const updateGoalProgressApi = async (programId, goalId, progress) => {
  const response = await apiClient.patch(
    `/therapist/program/${programId}/goal/${goalId}/progress`,
    { progress },
  );
  return response.data;
};

export const getChildStatsApi = async (childId) => {
  const response = await apiClient.get(`/therapist/get_child_stats/${childId}`);
  return response.data;
};

export const feedbackManagement = async (ID, selectedChildId, monthRange) => {
  const response = await apiClient.get(
    `/therapist/feedback_management/${selectedChildId}`,
    {
      params: { ID, monthRange },
    },
  );
  return response.data;
};

export const createFeedback = async (payload) => {
  const response = await apiClient.post("/therapist/feedback/create", payload);
  return response.data;
};

export const getAttendanceApi = async (params = {}) => {
  const response = await apiClient.get("/therapist/get_attendance", { params });
  return response.data;
};

export const updateAttendanceStatusApi = async (payload) => {
  const response = await apiClient.patch("/therapist/update_attendance_status", payload);
  return response.data;
};

export const createLeaveRequestApi = async (payload) => {
  try {
    const response = await apiClient.post("/therapist/leave-request/create", payload);
    return response.data;
  } catch (error) {
    console.error("Error submitting leave request:", error?.response?.data || error.message);
    throw error?.response?.data || error;
  }
};

export const getLeaveRequestsApi = async ({ page = 1, limit = 5 } = {}) => {
  try {
    const response = await apiClient.get("/therapist/leave-requests/get", {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error("Error submitting leave request:", error?.response?.data || error.message);
    throw error?.response?.data || error;
  }
};

export const uploadToCloudinaryFileSystem = async (
  fileUri,
  resourceType = "video",
) => {
  const CLOUD_NAME = "ddd3aphzb";
  const UPLOAD_PRESET = "healers_preset";

  try {
    if (!fileUri) {
      throw new Error("Video URI is required.");
    }

    // console.log("Uploading video:", fileUri);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const file = new File(fileUri);
    const sizeMB = file.size / (1024 * 1024);

    console.log("File exists:", file.exists);
    console.log("File type:", file.type);
    console.log("File size MB:", sizeMB.toFixed(2));
    if (!file.exists) {
      throw new Error("Video file does not exist.");
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    console.log("Cloudinary status:", response.status);

    const data = await response.json();

    // console.log("Cloudinary response:", data);

    if (!response.ok) {
      throw new Error(
        data?.error?.message || "Cloudinary upload failed.",
      );
    }

    console.log(
      "Cloudinary upload successful:",
      data.secure_url,
    );

    return data;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};

export const getChildVideosApi = async (childId, page = 1, limit = 2) => {
  const response = await apiClient.get(
    `/therapist/video/child/${childId}?page=${page}&limit=${limit}`,
  );

  return response.data;
};

export const createWeeklyVideoApi = async (payload) => {
  const response = await apiClient.post("/therapist/video/create", payload);
  return response.data;
};

export const deleteWeeklyVideoApi = async (id) => {
  const response = await apiClient.delete(`/therapist/video/delete/${id}`);
  return response.data;
};

export const createQuarterlyReport = async (data) => {
  try {
    const response = await apiClient.post(
      "/therapist/quarterly-reports",
      data,
    );

    return response.data;
  } catch (error) {
    console.error(
      "createQuarterlyReport error:",
      error?.response?.data || error,
    );

    throw error;
  }
};

export const getQuarterlyReport = async ({
  userId,
  year,
  quarter,
}) => {
  try {
    const response = await apiClient.get(
      "/therapist/quarterly-reports",
      {
        params: {
          userId,
          year,
          quarter,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      "getQuarterlyReport error:",
      error?.response?.data || error,
    );

    throw error;
  }
};

export const getQuarterlyReportsByChild = async ({ userId, year }) => {
  try {
    const response = await apiClient.get(
      "/therapist/quarterly-reports/all",
      {
        params: {
          userId,
          year,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      "getQuarterlyReportsByChild error:",
      error?.response?.data || error,
    );

    throw error;
  }
};
