import React, {
  createContext,
  useEffect,
  useState,
} from 'react';

import {
  clearAuthData,
  getAuthData,
  setAuthData,
} from '../utils/storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await getAuthData();
        // console.log("data",data)
        if (data.token && data.user) {
          setToken(data.token);
          setUser(data.user);
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (jwtToken, userData) => {
    await setAuthData(jwtToken, userData);
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = async () => {
    await clearAuthData();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        userRole: user?.role || null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};