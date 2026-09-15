import axios from 'axios';

import AsyncStorage from '@react-native-async-storage/async-storage';

const YOUR_COMPUTER_IP = '192.168.88.38';

const BASE_URL = `http://${YOUR_COMPUTER_IP}:5000/api`;

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      
    }
    return Promise.reject(error);
  }
);

export default apiClient;