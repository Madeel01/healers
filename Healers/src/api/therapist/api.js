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
  resourceType = "video"
) => {
  const CLOUD_NAME = "ddd3aphzb";
  const UPLOAD_PRESET = "healers_preset";

  try {
    if (!fileUri) {
      throw new Error("Video URI is required.");
    }

    console.log("Uploading video:", fileUri);

    const uploadUrl =
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const file = new File(fileUri);

    console.log("File exists:", file.exists);
    console.log("File type:", file.type);
    console.log("File size:", file.size);

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

    console.log("Cloudinary response:", data);

    if (!response.ok) {
      throw new Error(
        data?.error?.message || "Cloudinary upload failed."
      );
    }

    console.log(
      "Cloudinary upload successful:",
      data.secure_url
    );

    return data;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};
// export const uploadToCloudinary = async (fileUri, resourceType = "video") => {
//   try {
//     const filename = fileUri.split("/").pop();
//     const match = /\.(\w+)$/.exec(filename);
//     const extension = match ? match[1] : resourceType === "video" ? "mp4" : "jpeg";
//     const mimeType = `${resourceType}/${extension}`;

//     const formData = new FormData();
//     // Use object format with uri, name, and type
//     formData.append("file", {
//       uri: fileUri,
//       name: filename || `upload.${extension}`,
//       type: mimeType,
//     });
//     formData.append("upload_preset", UPLOAD_PRESET);

//     const response = await fetch(
//       `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
//       {
//         method: "POST",
//         body: formData,
//         // DO NOT set 'Content-Type': 'multipart/form-data' here!
//       },
//     );

//     const data = await response.json();

//     if (!response.ok) {
//       throw new Error(data.error?.message || "Cloudinary upload failed");
//     }

//     return data.secure_url;
//   } catch (error) {
//     console.error("Cloudinary Upload Error:", error);
//     throw error;
//   }
// };

export const getChildVideosApi = async (childId) => {
  const response = await apiClient.get(`/therapist/video/child/${childId}`);
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
