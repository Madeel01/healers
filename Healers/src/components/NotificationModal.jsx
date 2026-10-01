import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import {
  getUnreadNotificationsApi,
  markAllNotificationsAsReadApi,
  markNotificationAsReadApi,
} from '../api/authApi';
import { colors } from '../styles/theme';

const TYPE_CONFIG = {
  System: {
    icon: "settings",
    color: "#6366F1",
    background: "#EEF2FF",
  },

  Appointment: {
    icon: "calendar",
    color: "#0284C7",
    background: "#E0F2FE",
  },

  Therapy: {
    icon: "activity",
    color: "#10B981",
    background: "#D1FAE5",
  },

  Message: {
    icon: "message-square",
    color: "#8B5CF6",
    background: "#EDE9FE",
  },

  Reminder: {
    icon: "clock",
    color: "#F59E0B",
    background: "#FEF3C7",
  },

  Alert: {
    icon: "alert-circle",
    color: "#EF4444",
    background: "#FEE2E2",
  },

  General: {
    icon: "bell",
    color: "#64748B",
    background: "#F1F5F9",
  },
};

const getTypeConfig = (type) => {
  return TYPE_CONFIG[type] || TYPE_CONFIG.General;
};

const formatNotificationDate = (date) => {
  if (!date) {
    return "";
  }

  const notificationDate = new Date(date);

  if (Number.isNaN(notificationDate.getTime())) {
    return "";
  }

  const now = new Date();

  const diff = now.getTime() - notificationDate.getTime();

  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  return notificationDate.toLocaleDateString();
};

export default function NotificationModal({ visible, onClose, onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const response = await getUnreadNotificationsApi();

      if (response?.success) {
        const data = response?.data || [];

        setNotifications(data);

        onUnreadChange?.(data.length);
      } else {
        setNotifications([]);
        onUnreadChange?.(0);
      }
    } catch (error) {
      console.log(
        "fetch notifications error:",
        error?.response?.data || error?.message,
      );

      setNotifications([]);
      onUnreadChange?.(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const handleNotificationPress = async (notification) => {
    if (!notification?._id) {
      return;
    }

    try {
      setMarkingId(notification._id);

      setNotifications((prev) =>
        prev.filter(
          (item) =>
            String(item._id)
              !== String(notification._id),
        )
      );

      onUnreadChange?.(Math.max(notifications.length - 1, 0));
      await markNotificationAsReadApi(notification._id);
    } catch (error) {
      console.log(
        "mark notification read error:",
        error?.response?.data
          || error?.message,
      );

      fetchNotifications();
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) {
      return;
    }

    try {
      setMarkingAll(true);

      const response = await markAllNotificationsAsReadApi();

      if (response?.success) {
        setNotifications([]);

        onUnreadChange?.(0);
      }
    } catch (error) {
      console.log(
        "mark all notifications read error:",
        error?.response?.data
          || error?.message,
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const renderNotification = (item) => {
    const config = getTypeConfig(item.type);
    const isMarking = markingId === item._id;

    return (
      <TouchableOpacity
        key={String(item._id)}
        style={styles.notificationCard}
        activeOpacity={0.75}
        disabled={isMarking}
        onPress={() => handleNotificationPress(item)}
      >
        <View
          style={[
            styles.notificationIcon,
            {
              backgroundColor: config.background,
            },
          ]}
        >
          {isMarking
            ? (
              <ActivityIndicator
                size="small"
                color={config.color}
              />
            )
            : (
              <Feather
                name={config.icon}
                size={20}
                color={config.color}
              />
            )}
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationTitleRow}>
            <Text
              style={styles.notificationTitle}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: config.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  {
                    color: config.color,
                  },
                ]}
              >
                {item.type || "General"}
              </Text>
            </View>
          </View>

          <Text
            style={styles.notificationMessage}
            numberOfLines={3}
          >
            {item.message}
          </Text>

          {item.attachment?.url
            ? (
              <View style={styles.attachmentRow}>
                <Feather
                  name={item.attachment.type
                      === "image"
                    ? "image"
                    : "paperclip"}
                  size={14}
                  color="#64748B"
                />

                <Text
                  style={styles.attachmentText}
                  numberOfLines={1}
                >
                  {item.attachment.name
                    || "Attachment"}
                </Text>
              </View>
            )
            : null}

          <Text style={styles.notificationTime}>
            {formatNotificationDate(
              item.createdAt,
            )}
          </Text>
        </View>

        <View style={styles.unreadDot} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                Notifications
              </Text>

              <Text style={styles.headerSubtitle}>
                Unread notifications
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Feather
                name="x"
                size={22}
                color="#475569"
              />
            </TouchableOpacity>
          </View>

          {notifications.length > 0 && (
            <View style={styles.actionsRow}>
              <View style={styles.countContainer}>
                <Text style={styles.countText}>
                  {notifications.length} {notifications.length === 1
                    ? "Unread"
                    : "Unread"}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                disabled={markingAll}
                onPress={handleMarkAllRead}
              >
                {markingAll
                  ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                    />
                  )
                  : (
                    <Text
                      style={styles.markAllText}
                    >
                      Mark all as read
                    </Text>
                  )}
              </TouchableOpacity>
            </View>
          )}

          {loading
            ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />

                <Text style={styles.loadingText}>
                  Loading notifications...
                </Text>
              </View>
            )
            : notifications.length === 0
            ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Feather
                    name="bell-off"
                    size={34}
                    color="#94A3B8"
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  No unread notifications
                </Text>

                <Text style={styles.emptyText}>
                  You're all caught up!
                </Text>
              </View>
            )
            : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {notifications.map(
                  renderNotification,
                )}
              </ScrollView>
            )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    minHeight: "65%",
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0F172A",
  },

  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  countContainer: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  countText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },

  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  list: {
    flex: 1,
  },

  listContent: {
    padding: 16,
    paddingBottom: 30,
  },

  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  notificationContent: {
    flex: 1,
    paddingRight: 4,
  },

  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginRight: 6,
  },

  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },

  notificationMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },

  notificationTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
  },

  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
    gap: 5,
  },

  attachmentText: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginTop: 6,
    marginLeft: 4,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },

  emptyText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
  },
});
