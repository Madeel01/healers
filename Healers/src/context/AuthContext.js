import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { jwtDecode } from 'jwt-decode';
import { AppState } from 'react-native';

import { updateOnlineStatusApi } from '../api/authApi';
import {
  clearAuthData,
  getAuthData,
  setAuthData,
} from '../utils/storage';

export const AuthContext = createContext();

const getTokenRemainingMs = (jwtToken) => {
  try {
    const decoded = jwtDecode(jwtToken);

    if (!decoded.exp) {
      return 0;
    }

    return Math.max(0, decoded.exp * 1000 - Date.now());
  } catch (error) {
    console.log(" JWT Decode Error:", error.message);
    return 0;
  }
};

const formatRemainingTime = (milliseconds) => {
  const totalSeconds = Math.ceil(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    `${String(minutes).padStart(2, "0")}:`
    + `${String(seconds).padStart(2, "0")}`
  );
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const appState = useRef(AppState.currentState);
  const tokenRef = useRef(null);
  const logoutInProgressRef = useRef(false);
  const sessionVersionRef = useRef(0);

  const updateOnlineStatus = useCallback(async (isOnline, expectedToken = tokenRef.current) => {
    if (!expectedToken) return;

    try {
      await updateOnlineStatusApi(isOnline);
    } catch (error) {
      console.log(" Failed to update online status:", error?.response?.data || error?.message);
    }
  }, []);

  const logout = useCallback(async (expectedToken) => {
    const currentToken = tokenRef.current;

    if (expectedToken !== undefined && currentToken !== expectedToken) {
      return;
    }

    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;
    const sessionVersion = sessionVersionRef.current;

    try {
     
      if (currentToken && getTokenRemainingMs(currentToken) > 0) {
        await updateOnlineStatus(false, currentToken);
      }

      if (sessionVersionRef.current !== sessionVersion) {
        return;
      }

      await clearAuthData();

      if (sessionVersionRef.current !== sessionVersion) {
        return;
      }

      tokenRef.current = null;
      sessionVersionRef.current += 1;
      setToken(null);
      setUser(null);
    } catch (error) {
      console.log(" Logout Error:", error);
    } finally {
      logoutInProgressRef.current = false;
    }
  }, [updateOnlineStatus]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {

        const data = await getAuthData();

        if (!mounted) return;

        if (data?.token && data?.user) {
          const remainingMs = getTokenRemainingMs(data.token);

          if (remainingMs <= 0) {
            await clearAuthData();

            if (mounted) {
              tokenRef.current = null;
              setToken(null);
              setUser(null);
            }
          } else {

            tokenRef.current = data.token;
            sessionVersionRef.current += 1;

            setToken(data.token);
            setUser(data.user);
          }
        } else {
        }
      } catch (error) {
        console.log("Failed to load auth state:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

 
  const login = async (jwtToken, userData) => {
    const remainingMs = getTokenRemainingMs(jwtToken);

    if (remainingMs <= 0) {
      throw new Error("Invalid or expired login token");
    }

    await setAuthData(jwtToken, userData);

    sessionVersionRef.current += 1;
    tokenRef.current = jwtToken;
    setToken(jwtToken);
    setUser(userData);
  };

 
  const switchUser = async (jwtToken, userData) => {
    const remainingMs = getTokenRemainingMs(jwtToken);

    if (remainingMs <= 0) {
      throw new Error("New user token is expired");
    }

    const previousToken = tokenRef.current;

    if (previousToken && getTokenRemainingMs(previousToken) > 0) {
      await updateOnlineStatus(false, previousToken);
    }

    await setAuthData(jwtToken, userData);

    sessionVersionRef.current += 1;
    tokenRef.current = jwtToken;

    setToken(jwtToken);
    setUser(userData);
  };

   const updateUser = async (userData) => {
    const currentToken = tokenRef.current;

    if (!currentToken) return;

    if (getTokenRemainingMs(currentToken) <= 0) {
      await logout(currentToken);
      return;
    }

    await setAuthData(currentToken, userData);

    if (tokenRef.current === currentToken) {
      setUser(userData);
    }
  };

  useEffect(() => {
    if (!token) {
      console.log("⏹️ Token timer stopped");
      return;
    }

    let intervalId = null;
    let expirationTimeoutId = null;
    let cancelled = false;
    let isExpiring = false;

    const expireSession = async () => {
      if (
        cancelled
        || isExpiring
        || tokenRef.current !== token
      ) {
        return;
      }

      isExpiring = true;

      clearInterval(intervalId);
      clearTimeout(expirationTimeoutId);

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔴 JWT TOKEN EXPIRED");
      console.log("⏰ Remaining Time: 00:00");
      console.log("🚪 Automatically logging out...");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      await logout(token);
    };

    const checkRemainingTime = () => {
      if (cancelled || tokenRef.current !== token) {
        return;
      }

      const remainingMs = getTokenRemainingMs(token);

      if (remainingMs <= 0) {
        expireSession();
        return;
      }

      const formattedTime = formatRemainingTime(remainingMs);

      console.log(`🟢 Auto Logout In: ${formattedTime}`);
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⏳ JWT AUTO LOGOUT TIMER STARTED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");


    intervalId = setInterval(checkRemainingTime, 1000);

    const remainingMs = getTokenRemainingMs(token);

    if (remainingMs > 0) {
      expirationTimeoutId = setTimeout(
        expireSession,
        remainingMs,
      );
    }

    return () => {
      cancelled = true;

      clearInterval(intervalId);
      clearTimeout(expirationTimeoutId);

      console.log("⏹️ JWT countdown cleanup");
    };
  }, [token, logout]);

  useEffect(() => {
    if (!token || !user) return;

    const checkActiveSession = async () => {
      if (tokenRef.current !== token) return;

      const remainingMs = getTokenRemainingMs(token);

      if (remainingMs <= 0) {
        console.log("🔴 Token expired while app was backgrounded");
        await logout(token);
        return;
      }

      console.log(
        "📱 App active - Remaining:",
        formatRemainingTime(remainingMs),
      );

      await updateOnlineStatus(true, token);
    };

    if (AppState.currentState === "active") {
      checkActiveSession();
    }

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        const previousAppState = appState.current;
        appState.current = nextAppState;

        if (tokenRef.current !== token) return;

        if (
          previousAppState?.match(/inactive|background/)
          && nextAppState === "active"
        ) {
          console.log("📱 App returned to foreground");

          await checkActiveSession();
        }

        if (
          previousAppState === "active"
          && nextAppState.match(/inactive|background/)
        ) {
          console.log("📱 App moved to background");

          if (getTokenRemainingMs(token) > 0) {
            await updateOnlineStatus(false, token);
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [token, user, logout, updateOnlineStatus]);

 
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
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
