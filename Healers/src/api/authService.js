import * as LocalAuthentication from 'expo-local-authentication';

import AsyncStorage from '@react-native-async-storage/async-storage';

import apiClient from './apiClient';

// Helper: Lightweight UUID generator replacing expo-crypto
const generateUUID = () =>
  'bio-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);


export const registerUser = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  if (response.data.token) {
    await AsyncStorage.setItem('userToken', response.data.token);
    await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const loginUser = async (identifier, password) => {
  const response = await apiClient.post('/auth/login', { identifier, password });
  if (response.data.token) {
    await AsyncStorage.setItem('userToken', response.data.token);
    await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logoutUser = async () => {
  await AsyncStorage.multiRemove(['userToken', 'userData', 'deviceBiometricKey']);
};


export const enableBiometricAuth = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    throw new Error('Biometrics not available or not set up on this device.');
  }

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Scan fingerprint/FaceID to enable Biometric Login',
    fallbackLabel: 'Cancel',
  });

  if (!authResult.success) {
    throw new Error('Biometric authentication failed or canceled.');
  }

  const biometricKey = generateUUID();

  const response = await apiClient.post('/auth/register-biometric', { biometricKey });

  await AsyncStorage.setItem('deviceBiometricKey', biometricKey);

  return response.data;
};

export const loginWithBiometrics = async () => {
  const savedBiometricKey = await AsyncStorage.getItem('deviceBiometricKey');

  if (!savedBiometricKey) {
    throw new Error(
      'Biometric login is not registered on this device. Please log in with password first.'
    );
  }

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Scan fingerprint/Face ID to login',
    fallbackLabel: 'Use Password',
  });

  if (!authResult.success) {
    throw new Error('Biometric scan failed.');
  }

  const response = await apiClient.post('/auth/login-biometric', {
    biometricKey: savedBiometricKey,
  });

  if (response.data.token) {
    await AsyncStorage.setItem('userToken', response.data.token);
    await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
  }

  return response.data;
};