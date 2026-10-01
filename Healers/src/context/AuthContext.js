import React, {
  createContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AppState } from 'react-native';

import { updateOnlineStatusApi } from '../api/authApi';
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

  const appState = useRef(AppState.currentState);

  const updateOnlineStatus = async (isOnline) => {
    try {
      if (!token) {
        return;
      }

      await updateOnlineStatusApi(isOnline);
    } catch (error) {
      console.log(
        "Failed to update online status:",
        error?.response?.data || error?.message,
      );
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await getAuthData();

        if (data?.token && data?.user) {
          setToken(data.token);
          setUser(data.user);
        }
      } catch (e) {
        console.error("Failed to load auth state", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    updateOnlineStatus(true);

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        const previousAppState = appState.current;

        if (
          previousAppState.match(/inactive|background/)
          && nextAppState === "active"
        ) {
          await updateOnlineStatus(true);
        }

        if (
          previousAppState === "active"
          && nextAppState.match(/inactive|background/)
        ) {
          await updateOnlineStatus(false);
        }

        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [token, user]);

  const login = async (jwtToken, userData) => {
    await setAuthData(jwtToken, userData);

    setToken(jwtToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      if (token) {
        await updateOnlineStatus(false);
      }
    } catch (error) {
      console.log(
        "Failed to update offline status:",
        error?.response?.data || error?.message,
      );
    }

    await clearAuthData();

    setToken(null);
    setUser(null);
  };
  const switchUser = async (jwtToken, userData) => {
    try {
      await updateOnlineStatus(false);
    } catch (error) {
      console.log(
        "Failed to update previous user offline status:",
        error?.response?.data || error?.message,
      );
    }

    await clearAuthData();

    setToken(null);
    setUser(null);

    await setAuthData(jwtToken, userData);

    setToken(jwtToken);
    setUser(userData);
  };
  const updateUser = async (userData) => {
    if (!token) {
      return;
    }

    await setAuthData(token, userData);

    setUser(userData);
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
        switchUser,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
