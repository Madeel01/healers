import React, { useState } from 'react';

import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const initialRequests = [
  {
    id: "1",
    name: "Dr. Julian Brooks",
    role: "Lead Pediatric Therapist",
    avatar: "https://i.pravatar.cc/150?img=11",
    dates: "Oct 12 - Oct 15",
    leaveType: "Annual Leave",
    typeColor: "#414750",
    typeBg: "#F1F4F7",
    status: "Pending",
  },
  {
    id: "2",
    name: "Sarah Mitchell",
    role: "Speech & Language Pathologist",
    avatar: "https://i.pravatar.cc/150?img=5",
    dates: "Oct 18 - Oct 19",
    leaveType: "Medical Leave",
    typeColor: "#9A3412",
    typeBg: "#FFEDD5",
    status: "Pending",
  },
  {
    id: "3",
    name: "Marcus Chen",
    role: "Behavior Analyst",
    avatar: "https://i.pravatar.cc/150?img=12",
    dates: "Oct 24 - Oct 24",
    leaveType: "Personal Day",
    typeColor: "#0F766E",
    typeBg: "#CCFBF1",
    status: "Approved",
  },
];

export default function LeaveRequestsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState("Pending");
  const [requests, setRequests] = useState(initialRequests);
  const [activeBottomTab, setActiveBottomTab] = useState("Home");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const handleUpdateStatus = (id, newStatus) => {
    setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));
  };

  const filteredRequests = requests.filter((item) => {
    if (selectedTab === "Pending") return item.status === "Pending";
    if (selectedTab === "Approved") return item.status === "Approved";
    if (selectedTab === "History") return true;
    return true;
  });

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Leave Requests"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricTitle}>Pending Requests</Text>
            <Text style={styles.metricValue}>
              {requests.filter((r) => r.status === "Pending").length}
            </Text>
            <View style={styles.trendContainer}>
              <MaterialIcons name="trending-up" size={16} color="#006B58" />
              <Text style={styles.trendText}>4 since yesterday</Text>
            </View>
          </View>
          <View style={[styles.metricIconBox, { backgroundColor: "rgba(0,80,134,.1)" }]}>
            <MaterialIcons name="assignment-late" size={26} color="#0B4A6F" />
          </View>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricTitle}>Staff on Leave Today</Text>
            <Text style={[styles.metricValue, styles.metricValue2]}>03</Text>
            <Text style={styles.metricSubText}>Therapists, Support Staff</Text>
          </View>
          <View style={[styles.metricIconBox, { backgroundColor: "rgba(0,107,88,.1)" }]}>
            <MaterialIcons name="event-busy" size={26} color="#006B58" />
          </View>
        </View>

        <View style={styles.tabContainer}>
          {["Pending", "Approved", "History"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                selectedTab === tab && styles.tabButtonActive,
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredRequests.length === 0
          ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No {selectedTab.toLowerCase()} requests found.
              </Text>
            </View>
          )
          : (
            filteredRequests.map((item) => (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.userInfoRow}>
                  <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userRole}>{item.role}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === "Approved"
                        ? { backgroundColor: "#D1FAE5" }
                        : item.status === "Rejected"
                        ? { backgroundColor: "#FEE2E2" }
                        : { backgroundColor: "#FEF3C7" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.status === "Approved"
                          ? { color: "#059669" }
                          : item.status === "Rejected"
                          ? { color: "#DC2626" }
                          : { color: "#D97706" },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <MaterialIcons name="event" size={18} color={colors.primary} />
                  <Text style={styles.dateText}>{item.dates}</Text>
                </View>

                <View style={[styles.typeBadge, { backgroundColor: item.typeBg }]}>
                  <Text style={[styles.typeBadgeText, { color: item.typeColor }]}>
                    {item.leaveType}
                  </Text>
                </View>

                {item.status === "Pending" && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => handleUpdateStatus(item.id, "Approved")}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleUpdateStatus(item.id, "Rejected")}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
      </ScrollView>

      <BottomBar
        activeTab={activeBottomTab}
        setActiveTab={setActiveBottomTab}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    elevation: 2,
    shadowColor: "rgba(22,105,169,.2)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  metricTextContainer: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },
  metricValue: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginVertical: 4,
    lineHeight: 40,
  },
  metricValue2: {
    color: "#006B58",
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  trendText: {
    fontSize: 14,
    color: "#006B58",
    fontFamily: fonts.semiBold,
  },
  metricSubText: {
    fontSize: 14,
    color: "rgba(65,71,80,.6)",
    fontFamily: fonts.semiBold,
  },
  metricIconBox: {
    padding: 16,
    paddingBottom: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#E5E8EB",
    borderRadius: 12,
    padding: 4,
    marginVertical: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    elevation: 1,
  },
  tabText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#414750",
  },
  tabTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  emptyState: {
    padding: 30,
    alignItems: "center",
  },
  emptyStateText: {
    color: "#414750",
    fontSize: 14,
    fontWeight: "500",
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "rgba(0,0,0,.4)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap:5,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    marginRight: 7,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 20,
  },
  userRole: {
    fontSize: 14,
    color: "#414750",
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  dateText: {
    fontSize: 16,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
    width: "100%",
  },
  typeBadgeText: {
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
  },
  approveButton: {
    width: "48%",
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  rejectButton: {
    width: "48%",
    borderWidth: 1.5,
    borderColor: "#BA1A1A",
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    color: "#BA1A1A",
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
});
