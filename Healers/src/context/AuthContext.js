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
  const internetAlertShownRef = useRef(false);

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

    if (
      typeof expectedToken === "string"
      && currentToken !== expectedToken
    ) {
      return;
    }

    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;

    const pushToken = await AsyncStorage.getItem("pushToken");

    if (pushToken && currentToken) {
      try {
        await removePushTokenApi(pushToken, currentToken);

        await AsyncStorage.removeItem("pushToken");

        console.log("FCM token unregistered");
      } catch (error) {
        console.log(
          "FCM unregister error:",
          error?.response?.data || error?.message,
        );
      }
    }

    try {
      tokenRef.current = null;

      sessionVersionRef.current += 1;

      setToken(null);
      setUser(null);
      const pushToken = await AsyncStorage.getItem("pushToken");
      // if (pushToken && currentToken && getTokenRemainingMs(currentToken) > 0) {
      //   try {
      //     await Promise.race([
      //       removePushToken(pushToken),
      //       new Promise((resolve) => setTimeout(resolve, 3000)),
      //     ]);
      //   } catch (error) {
      //     console.log("Push token removal failed:", error?.message);
      //   }
      //   await AsyncStorage.removeItem("pushToken");
      // }

      await clearAuthData();

      if (currentToken) {
        NetInfo.fetch()
          .then((state) => {
            if (
              state.isConnected === true
              && state.isInternetReachable !== false
            ) {
              return updateOnlineStatus(false, currentToken);
            }
          })
          .catch((error) => {
            console.log("Online status update failed:", error);
          });
      }
    } catch (error) {
      console.log("Logout Error:", error);
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

  const login = useCallback(
    async (jwtToken, userData) => {
      if (getTokenRemainingMs(jwtToken) <= 0) {
        throw new Error("Invalid or expired token");
      }

      await setAuthData(jwtToken, userData);

      sessionVersionRef.current += 1;
      tokenRef.current = jwtToken;

      setToken(jwtToken);
      setUser(userData);

      if (AppState.currentState === "active") {
        await updateOnlineStatus(true, jwtToken);
      }
    },
    [updateOnlineStatus],
  );

  const switchUser = async (jwtToken, userData) => {
    const remainingMs = getTokenRemainingMs(jwtToken);

    if (remainingMs <= 0) {
      throw new Error("New user token is expired");
    }

    const previousToken = tokenRef.current;

    if (previousToken && getTokenRemainingMs(previousToken) > 0) {
      await updateOnlineStatus(false, previousToken);
    }


    if (previousToken) {
      const pushToken = await AsyncStorage.getItem("pushToken");

      if (pushToken) {
        try {
          await removePushTokenApi(pushToken, previousToken);
          await AsyncStorage.removeItem("pushToken");
        } catch (error) {
          console.log("Previous user FCM cleanup failed:", error);
        }
      }
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

      // console.log(`🟢 Auto Logout In: ${formattedTime}`);
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

  useEffect(() => {
    if (!token) {
      internetAlertShownRef.current = false;
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOffline = state.isConnected === false
        || state.isInternetReachable === false;

      if (isOffline && !internetAlertShownRef.current) {
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
    });

    return () => {
      unsubscribe();
    };
  }, [token, logout]);

  useEffect(() => {
    if (!token || !user) return;

    let cancelled = false;

    const setupPushNotifications = async () => {
      try {
        const pushToken = await registerForPushNotifications();

        if (!pushToken || cancelled) return;

        // Ensure this session is still active
        if (tokenRef.current !== token) return;

        await savePushTokenApi(pushToken, token);

        if (cancelled || tokenRef.current !== token) {
          // Undo registration from a stale session
          await removePushTokenApi(pushToken, token)
            .catch(console.error);
          return;
        }

        await AsyncStorage.setItem("pushToken", pushToken);

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
  }, [token, user?._id]);

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
