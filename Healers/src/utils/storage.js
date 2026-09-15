import AsyncStorage from '@react-native-async-storage/async-storage';

export const setAuthData = async (token, user) => {
  try {
    await AsyncStorage.multiSet([
      ['jwt_token', token],
      ['user_info', JSON.stringify(user)],
    ]);
  } catch (error) {
    console.error('Error saving auth data:', error);
  }
};

export const getAuthData = async () => {
  try {
    const token = await AsyncStorage.getItem('jwt_token');
    const userJson = await AsyncStorage.getItem('user_info');

    return {
      token,
      user: userJson ? JSON.parse(userJson) : null,
    };
  } catch (error) {
    console.error('Error getting auth data:', error);
    return { token: null, user: null };
  }
};

export const clearAuthData = async () => {
  try {
    await AsyncStorage.multiRemove(['jwt_token', 'user_info', 'deviceBiometricKey']);
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};