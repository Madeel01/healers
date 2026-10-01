import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';

import { getUnreadNotificationCountApi } from '../api/authApi';
import { AuthContext } from '../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../styles/theme';
import NotificationModal from './NotificationModal';

export default function TopBar({ headerTitle }) {
  const { user } = useContext(AuthContext);

  const navigation = useNavigation();
  const userName = user?.fullName || user?.name || "";
  const profileImage = user?.profileImage || "";
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const fetchNotificationUnreadCount = async () => {
    try {
      const response = await getUnreadNotificationCountApi();

      if (response?.success) {
        setNotificationUnreadCount(response.count || 0);
      }
    } catch (error) {
      console.log("fetchNotificationUnreadCount error:", error);
    }
  };
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    fetchNotificationUnreadCount();

    const intervalUnread = setInterval(() => {
      fetchNotificationUnreadCount();
    }, 10000);

    return () => {
      clearInterval(intervalUnread);
    };
  }, [isFocused]);
  const bellShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notificationUnreadCount > 0) {
      const shakeAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(bellShake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(bellShake, {
            toValue: -1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(bellShake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(bellShake, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.delay(1200),
        ]),
      );

      shakeAnimation.start();

      return () => {
        shakeAnimation.stop();
        bellShake.setValue(0);
      };
    }

    bellShake.stopAnimation();
    bellShake.setValue(0);
  }, [notificationUnreadCount]);

  return (
    <>
      <View style={styles.fixedHeader}>
        <View style={[commonStyles.flexClass, { gap: 10 }]}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#0B4A6F" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 12 }]}
            activeOpacity={0.7}
            onPress={() => setShowNotificationModal(true)}
          >
            <View style={styles.notificationWrapper}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: bellShake.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ["-12deg", "12deg"],
                      }),
                    },
                  ],
                }}
              >
                <Feather
                  name="bell"
                  size={20}
                  color="#64748B"
                />
              </Animated.View>

              {notificationUnreadCount > 0 && <View style={styles.redDot} />}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation?.navigate("ChildProfile")}
          >
            {profileImage
              ? (
                <Image
                  source={{
                    uri: profileImage,
                  }}
                  style={styles.avatarHeader}
                />
              )
              : (
                <View style={styles.avatarFallback}>
                  <Text
                    style={styles.avatarFallbackText}
                  >
                    {(userName || "User")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
          </TouchableOpacity>
        </View>
      </View>

      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,.1)",
    marginBottom: 10,
  },
  headerIconButton: {
    padding: 6,
    position: "relative",
  },
  notificationWrapper: {
    position: "relative",
  },
  redDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "#DC2626",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#0B4A6F",
    lineHeight: 24,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarHeader: {
    width: 32,
    height: 32,
    borderRadius: 999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "80%",
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  notifListContainer: {
    paddingTop: 16,
  },
  notifCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  unreadNotifCard: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },
  notifIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#1E293B",
  },
  notifMessage: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  notifTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
});
