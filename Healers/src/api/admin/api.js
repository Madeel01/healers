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
