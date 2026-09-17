import apiClient from '../apiClient';

export const Overview = async () => {
  const response = await apiClient.get("/admin/overview");
  return response.data;
};
export const therapistUsers = async (params = {}) => {
  const response = await apiClient.get("/admin/get_therapists",{ params });
  return response.data;
}
export const getUsers = async (params = {}) => {
  const response = await apiClient.get("/admin/users",{ params });
  return response.data;
}
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
