import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { jwtDecode } from 'jwt-decode';
import {
  Alert,
  AppState,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { updateOnlineStatusApi } from '../api/authApi';
import {
  removePushTokenApi,
  savePushTokenApi,
} from '../api/pushNotificationApi';
import { registerForPushNotifications } from '../utils/pushNotifications';
import {
  clearAuthData,
  getAuthData,
  setAuthData,
} from '../utils/storage';

export const AuthContext = createContext();

const getDecodedToken = (jwtToken) => {
  try {
    return jwtDecode(jwtToken);
  } catch {
    return null;
  }
};

const getTokenRemainingMs = (jwtToken) => {
  if (!jwtToken) return 0;

  const decoded = getDecodedToken(jwtToken);

  if (!decoded?.exp) return 0;

  return Math.max(0, decoded.exp * 1000 - Date.now());
};

const isImpersonationToken = (jwtToken) => {
  return getDecodedToken(jwtToken)?.impersonation === true;
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

  const [adminSession, setAdminSession] = useState(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const appState = useRef(AppState.currentState);
  const tokenRef = useRef(null);
  const userRef = useRef(null);
  const adminSessionRef = useRef(null);

  const logoutInProgressRef = useRef(false);
  const sessionVersionRef = useRef(0);
  const internetAlertShownRef = useRef(false);
  const switchingSessionRef = useRef(false);

  const applySession = useCallback((jwtToken, userData) => {
    sessionVersionRef.current += 1;
    tokenRef.current = jwtToken;
    userRef.current = userData;

    setToken(jwtToken);
    setUser(userData);
  }, []);

  const clearImpersonation = useCallback(() => {
    adminSessionRef.current = null;
    setAdminSession(null);
    setIsImpersonating(false);
  }, []);

  // Prevent online-status changes during impersonation.
  const updateOnlineStatus = useCallback(
    async (isOnline, expectedToken = tokenRef.current) => {
      if (!expectedToken) return false;

      if (isImpersonationToken(expectedToken)) {
        return false;
      }

      if (tokenRef.current !== expectedToken) {
        return false;
      }

      try {
        // Assumes this API reads the active token from storage.
        await updateOnlineStatusApi(isOnline);
        return true;
      } catch (error) {
        console.log(
          "Failed to update online status:",
          error?.response?.data || error?.message,
        );
        return false;
      }
    },
    [],
  );

  const logout = useCallback(
    async (expectedToken) => {
      const currentToken = tokenRef.current;

      if (
        typeof expectedToken === "string"
        && currentToken !== expectedToken
      ) {
        return;
      }

      if (logoutInProgressRef.current) return;

      logoutInProgressRef.current = true;

      try {
        const impersonating = isImpersonationToken(currentToken);

        // If impersonating, clean up using the original admin token.
        const cleanupToken = impersonating
          ? adminSessionRef.current?.token
          : currentToken;

        if (
          cleanupToken
          && getTokenRemainingMs(cleanupToken) > 0
        ) {
          // Online-status API uses the active stored token.
          // Restore the admin token before admin cleanup.
          if (impersonating && adminSessionRef.current) {
            await setAuthData(
              adminSessionRef.current.token,
              adminSessionRef.current.user,
            );

            tokenRef.current = adminSessionRef.current.token;
          }

          await updateOnlineStatus(false, cleanupToken);

          const pushToken = await AsyncStorage.getItem("pushToken");

          if (pushToken) {
            try {
              await removePushTokenApi(
                pushToken,
                cleanupToken,
              );

              await AsyncStorage.removeItem("pushToken");
            } catch (error) {
              console.log(
                "FCM unregister error:",
                error?.response?.data || error?.message,
              );
            }
          }
        }
      } catch (error) {
        console.log("Logout cleanup error:", error);
      } finally {
        tokenRef.current = null;
        userRef.current = null;
        sessionVersionRef.current += 1;

        setToken(null);
        setUser(null);

        clearImpersonation();

        try {
          await clearAuthData();
        } catch (error) {
          console.log("Clear auth error:", error);
        }

        logoutInProgressRef.current = false;
      }
    },
    [clearImpersonation, updateOnlineStatus],
  );

  const returnToAdmin = useCallback(async () => {
    const originalAdmin = adminSessionRef.current;

    if (!originalAdmin?.token || !originalAdmin?.user) {
      throw new Error("No admin session available");
    }

    if (getTokenRemainingMs(originalAdmin.token) <= 0) {
      throw new Error(
        "Admin session expired. Please log in again.",
      );
    }

    if (switchingSessionRef.current) return;

    switchingSessionRef.current = true;

    try {
      await setAuthData(
        originalAdmin.token,
        originalAdmin.user,
      );

      applySession(
        originalAdmin.token,
        originalAdmin.user,
      );

      clearImpersonation();

      console.log("Returned to Admin successfully");
    } finally {
      switchingSessionRef.current = false;
    }
  }, [applySession, clearImpersonation]);

  const handleSessionExpiry = useCallback(
    async (expiredToken) => {
      if (tokenRef.current !== expiredToken) return;

      if (isImpersonationToken(expiredToken)) {
        const originalAdmin = adminSessionRef.current;

        if (
          originalAdmin
          && getTokenRemainingMs(originalAdmin.token) > 0
        ) {
          try {
            await returnToAdmin();
            return;
          } catch (error) {
            console.log(
              "Failed to restore Admin session:",
              error.message,
            );
          }
        }
      }

      await logout(expiredToken);
    },
    [logout, returnToAdmin],
  );

  // Restore session when app starts.
  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const data = await getAuthData();

        if (!mounted) return;

        if (!data?.token || !data?.user) return;

        // Original admin session is deliberately memory-only.
        // A restored impersonation token cannot safely return
        // to Admin after a full app restart.
        if (
          isImpersonationToken(data.token)
          || getTokenRemainingMs(data.token) <= 0
        ) {
          await clearAuthData();
          return;
        }

        if (!mounted) return;

        applySession(data.token, data.user);
      } catch (error) {
        console.log(
          "Failed to load auth state:",
          error?.message,
        );
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
  }, [applySession]);

  // Normal login.
  const login = useCallback(
    async (jwtToken, userData) => {
      if (getTokenRemainingMs(jwtToken) <= 0) {
        throw new Error("Invalid or expired token");
      }

      if (isImpersonationToken(jwtToken)) {
        throw new Error(
          "Impersonation tokens must use loginAsUser",
        );
      }

      await setAuthData(jwtToken, userData);

      clearImpersonation();
      applySession(jwtToken, userData);

      if (AppState.currentState === "active") {
        await updateOnlineStatus(true, jwtToken);
      }
    },
    [applySession, clearImpersonation, updateOnlineStatus],
  );

  // Existing normal user-switch flow.
  const switchUser = useCallback(
    async (jwtToken, userData) => {
      if (getTokenRemainingMs(jwtToken) <= 0) {
        throw new Error("New user token is expired");
      }

      if (
        isImpersonationToken(tokenRef.current)
        || isImpersonationToken(jwtToken)
      ) {
        throw new Error(
          "Normal user switching is disabled during impersonation",
        );
      }

      const previousToken = tokenRef.current;

      if (
        previousToken
        && getTokenRemainingMs(previousToken) > 0
      ) {
        await updateOnlineStatus(false, previousToken);

        const pushToken = await AsyncStorage.getItem("pushToken");

        if (pushToken) {
          try {
            await removePushTokenApi(
              pushToken,
              previousToken,
            );

            await AsyncStorage.removeItem("pushToken");
          } catch (error) {
            console.log(
              "Previous user FCM cleanup failed:",
              error?.message,
            );
          }
        }
      }

      await setAuthData(jwtToken, userData);

      clearImpersonation();
      applySession(jwtToken, userData);
    },
    [applySession, clearImpersonation, updateOnlineStatus],
  );

  // Update user profile in context.
  const updateUser = useCallback(
    async (userData) => {
      const currentToken = tokenRef.current;

      if (!currentToken) return;

      if (isImpersonationToken(currentToken)) {
        throw new Error(
          "Profile changes are disabled during impersonation",
        );
      }

      if (getTokenRemainingMs(currentToken) <= 0) {
        await handleSessionExpiry(currentToken);
        return;
      }

      await setAuthData(currentToken, userData);

      if (tokenRef.current === currentToken) {
        userRef.current = userData;
        setUser(userData);
      }
    },
    [handleSessionExpiry],
  );

  // Admin login as Child or Therapist.
  const loginAsUser = useCallback(
    async (jwtToken, userData) => {
      const currentUser = userRef.current;
      const currentToken = tokenRef.current;

      const currentRole = String(currentUser?.role || "")
        .trim()
        .toLowerCase();

      if (currentRole !== "admin") {
        throw new Error(
          `Only an admin can start impersonation. Current role: ${currentUser?.role || "unknown"}`,
        );
      }

      if (adminSessionRef.current) {
        throw new Error(
          "Already impersonating another user",
        );
      }

      if (
        !currentToken
        || getTokenRemainingMs(currentToken) <= 0
      ) {
        throw new Error("Admin session expired");
      }

      if (getTokenRemainingMs(jwtToken) <= 0) {
        throw new Error(
          "Invalid or expired impersonation token",
        );
      }

      const decoded = getDecodedToken(jwtToken);

      if (
        decoded?.impersonation !== true
        || String(decoded?.impersonatedBy)
          !== String(currentUser?._id || currentUser?.id)
      ) {
        throw new Error(
          "Invalid impersonation session",
        );
      }

      const targetRole = String(userData?.role || "")
        .trim()
        .toLowerCase();

      if (!["child", "therapist"].includes(targetRole)) {
        throw new Error(
          "Only Child and Therapist accounts are supported",
        );
      }

      if (switchingSessionRef.current) return;

      switchingSessionRef.current = true;

      const originalAdmin = {
        token: currentToken,
        user: currentUser,
      };

      try {
        await setAuthData(jwtToken, userData);

        adminSessionRef.current = originalAdmin;
        setAdminSession(originalAdmin);

        applySession(jwtToken, userData);
        setIsImpersonating(true);

        console.log(
          `Viewing as ${userData.role}: ${userData.fullName}`,
        );
      } finally {
        switchingSessionRef.current = false;
      }
    },
    [applySession],
  );

  // JWT expiration timer.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let expirationTimeoutId = null;
    let intervalId = null;

    const expireSession = async () => {
      if (
        cancelled
        || tokenRef.current !== token
      ) {
        return;
      }

      console.log("JWT token expired");

      await handleSessionExpiry(token);
    };

    const checkRemainingTime = () => {
      if (
        cancelled
        || tokenRef.current !== token
      ) {
        return;
      }

      const remainingMs = getTokenRemainingMs(token);

      if (remainingMs <= 0) {
        expireSession();
      }
    };

    const remainingMs = getTokenRemainingMs(token);

    if (remainingMs <= 0) {
      expireSession();
    } else {
      expirationTimeoutId = setTimeout(
        expireSession,
        remainingMs,
      );

      intervalId = setInterval(
        checkRemainingTime,
        1000,
      );
    }

    return () => {
      cancelled = true;

      if (expirationTimeoutId) {
        clearTimeout(expirationTimeoutId);
      }

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [token, handleSessionExpiry]);

  // App foreground/background online status.
  useEffect(() => {
    if (!token || !user) return;

    const checkActiveSession = async () => {
      if (tokenRef.current !== token) return;

      const remainingMs = getTokenRemainingMs(token);

      if (remainingMs <= 0) {
        await handleSessionExpiry(token);
        return;
      }

      if (!isImpersonationToken(token)) {
        await updateOnlineStatus(true, token);
      }
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
          await checkActiveSession();
        }

        if (
          previousAppState === "active"
          && nextAppState.match(/inactive|background/)
        ) {
          if (
            getTokenRemainingMs(token) > 0
            && !isImpersonationToken(token)
          ) {
            await updateOnlineStatus(false, token);
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    token,
    user,
    handleSessionExpiry,
    updateOnlineStatus,
  ]);

  // Network connection monitoring.
  useEffect(() => {
    if (!token) {
      internetAlertShownRef.current = false;
      return;
    }

    const unsubscribe = NetInfo.addEventListener(
      (state) => {
        const isOffline = state.isConnected === false
          || state.isInternetReachable === false;

        if (
          isOffline
          && !internetAlertShownRef.current
        ) {
          internetAlertShownRef.current = true;

          Alert.alert(
            "No Internet Connection",
            "Your internet connection has been lost. You will be logged out.",
            [
              {
                text: "OK",
                onPress: async () => {
                  await logout(token);
                },
              },
            ],
            { cancelable: false },
          );
        }

        if (!isOffline) {
          internetAlertShownRef.current = false;
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [token, logout]);

  // Firebase push notifications.
  useEffect(() => {
    if (!token || !user) return;

    // Never register a device against an impersonated user.
    if (isImpersonationToken(token)) {
      return;
    }

    let cancelled = false;

    const setupPushNotifications = async () => {
      try {
        const pushToken = await registerForPushNotifications();

        if (!pushToken || cancelled) return;

        if (tokenRef.current !== token) return;

        await savePushTokenApi(pushToken, token);

        if (
          cancelled
          || tokenRef.current !== token
        ) {
          await removePushTokenApi(
            pushToken,
            token,
          ).catch(console.error);

          return;
        }

        await AsyncStorage.setItem(
          "pushToken",
          pushToken,
        );

        console.log("FCM registered successfully");
      } catch (error) {
        console.log(
          "FCM registration error:",
          error?.response?.data || error?.message,
        );
      }
    };

    setupPushNotifications();

    return () => {
      cancelled = true;
    };
  }, [token, user?._id, user?.id]);

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

        loginAsUser,
        returnToAdmin,
        isImpersonating,
        adminSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
