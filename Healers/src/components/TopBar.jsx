import React, { useState } from 'react';

import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  commonStyles,
  fonts,
} from '../styles/theme';

const mockNotifications = [
  {
    id: "1",
    title: "New Leave Request",
    message: "Dr. Julian Brooks applied for Annual Leave.",
    time: "10 mins ago",
    unread: true,
    icon: "event-note",
    color: "#D97706",
  },
  {
    id: "2",
    title: "Session Completed",
    message: "Sarah Mitchell completed speech therapy session with Alex.",
    time: "1 hour ago",
    unread: true,
    icon: "check-circle",
    color: "#059669",
  },
  {
    id: "3",
    title: "Fee Payment Received",
    message: "Received PKR 15,000 for Patient #1042.",
    time: "2 hours ago",
    unread: false,
    icon: "payments",
    color: "#0B4A6F",
  },
];

export default function TopBar({ navigation, isNotificationOpen, onToggleNotification,headerTitle }) {
  const insets = useSafeAreaInsets();
  const [internalModalVisible, setInternalModalVisible] = useState(false);
  const [notifications] = useState(mockNotifications);

  const isModalVisible = isNotificationOpen !== undefined ? isNotificationOpen : internalModalVisible;
  const setModalVisible = onToggleNotification || setInternalModalVisible;

  const unreadCount = notifications.filter((n) => n.unread).length;

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
            style={styles.headerIconButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="notifications-outline" size={22} color="#334155" />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>

          <Image
            source={{ uri: "https://i.pravatar.cc/150?img=32" }}
            style={styles.avatarHeader}
          />
        </View>
      </View>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingTop: insets.top + 10 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.notifListContainer}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.notifCard,
                    item.unread && styles.unreadNotifCard,
                  ]}
                >
                  <View
                    style={[
                      styles.notifIconContainer,
                      { backgroundColor: item.color + "20" },
                    ]}
                  >
                    <MaterialIcons
                      name={item.icon}
                      size={20}
                      color={item.color}
                    />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifMessage}>{item.message}</Text>
                    <Text style={styles.notifTime}>{item.time}</Text>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
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
    marginBottom:10
  },
  headerIconButton: {
    padding: 6,
    position: "relative",
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
    position: "absolute",
    top: 6,
    right: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#0B4A6F",
    lineHeight:24,
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  notifListContainer: { paddingTop: 16 },
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
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  notifMessage: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
    lineHeight: 18,
  },
  notifTime: { fontSize: 11, color: "#94A3B8", marginTop: 6 },
});
