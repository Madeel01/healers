import React, { useState, useEffect, useContext } from "react";

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import BottomBar from "../../components/BottomBar";

import TopBar from "../../components/TopBar";

import { colors, commonStyles, fonts } from "../../styles/theme";

import {
  approveLeaveRequest,
  getLeaveRequests,
  rejectLeaveRequest,
} from "../../api/admin/api";
import { AuthContext } from "../../context/AuthContext";

const formatNames = (names) =>
  names.length > 2 ? `${names.slice(0, 2).join(", ")}...` : names.join(", ");

export default function LeaveRequestsScreen({ navigation }) {
  // const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState("Pending");

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    pendingSinceYesterday: 0,
    onLeaveToday: 0,
    onLeaveNames: [],
  });
  const [activeBottomTab, setActiveBottomTab] = useState("Home");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [reasonTarget, setReasonTarget] = useState(null);
  
  const fetchRequests = async (tab = selectedTab) => {
    setLoading(true);

    try {
      const response = await getLeaveRequests({ status: tab.toLowerCase() });

      const data = response?.data?.data || [];

      const formatted = response.data.data.map((item) => ({
        id: item._id,
        name: item.applicantId?.fullName,
        role: item.role,
        dates: formatDateRange(item.startDate, item.endDate),
        leaveType: item.leaveType,
        reason: item.reason,
        status: capitalize(item.status),
        rejectionReason: item.rejectionReason,
        rejectedBy: item.approved_by?.fullName,
      }));

      setRequests(formatted);
      setStats(response.data.stats);
    } catch (error) {
      console.log("Failed to fetch leave requests:", error);

      Alert.alert("Error", "Could not load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

const formatDateRange = (start, end) =>
  new Date(start).toDateString() === new Date(end).toDateString()
    ? formatDate(start)
    : `${formatDate(start)} - ${formatDate(end)}`;

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  useEffect(() => {
    fetchRequests(selectedTab);
  }, [selectedTab]);

  const handleApprove = async (item) => {
    // console.log(item,"called");
    Alert.alert(
      "Approve Request",

      `Approve ${item.name}'s leave request?`,

      [
        { text: "Cancel", style: "cancel" },

        {
          text: "Approve",

          onPress: async () => {
            setActioningId(item.id);

            try {
              await approveLeaveRequest(item.id);

              await fetchRequests(selectedTab);

              Alert.alert(
                "Approved",
                `${item.name}'s leave has been approved.`,
              );
            } catch (error) {
              console.log("Failed to approve:", error);

              const msg = error?.response?.data?.message;

              Alert.alert("Error", msg || "Could not approve this request.");
            } finally {
              setActioningId(null);
            }
          },
        },
      ],
    );
  };

  const openRejectModal = (item) => {
    setRejectTarget(item);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    setIsRejectModalOpen(false);

    setRejectTarget(null);

    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert("Reason required", "Please provide a reason for rejection.");

      return;
    }

    setActioningId(rejectTarget.id);

    try {
      await rejectLeaveRequest(rejectTarget.id, rejectionReason.trim());

      await fetchRequests(selectedTab);

      closeRejectModal();

      Alert.alert(
        "Rejected",
        `${rejectTarget.name}'s leave request has been rejected.`,
      );
    } catch (error) {
      console.log("Failed to reject:", error);

      const msg = error?.response?.data?.message;

      Alert.alert("Error", msg || "Could not reject this request.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
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
              {stats.pendingCount}
            </Text>

            <View style={styles.trendContainer}>
              <MaterialIcons name="trending-up" size={16} color="#006B58" />

              <Text style={styles.trendText}>{stats.pendingSinceYesterday} since yesterday</Text>
            </View>
          </View>

          <View
            style={[
              styles.metricIconBox,
              { backgroundColor: "rgba(0,80,134,.1)" },
            ]}
          >
            <MaterialIcons name="assignment-late" size={26} color="#0B4A6F" />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.metricCard}
          onPress={() => navigation.navigate("StaffOnLeave")}
        >
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricTitle}>Staff on Leave Today</Text>
            <Text style={[styles.metricValue, styles.metricValue2]}>{stats.onLeaveToday}</Text>
            <Text style={styles.metricSubText}>{formatNames(stats.onLeaveNames)}</Text>
          </View>

          <View style={[styles.metricIconBox, { backgroundColor: "rgba(0,107,88,.1)" }]}>
            <MaterialIcons name="event-busy" size={26} color="#006B58" />
          </View>
        </TouchableOpacity>

        <View style={styles.tabContainer}>
          {["Pending", "Approved", "Rejected"].map((tab) => (
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

        {loading && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginVertical: 30 }}
          />
        )}

        {!loading && requests.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No {selectedTab.toLowerCase()} requests found.
            </Text>
          </View>
        )}

        {!loading &&
          requests.map((item) => (
            <View key={item.id} style={styles.requestCard}>
              <View style={styles.userInfoRow}>
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

              <View style={[styles.typeBadge, { backgroundColor: "#F1F4F7" }]}>
                <Text style={[styles.typeBadgeText, { color: "#414750" }]}>
                  {item.reason}
                </Text>
              </View>

              {/* {!!item.reason && (

                <Text style={styles.reasonText}>Reason: {item.reason}</Text>

              )} */}

              {item.status === "Rejected" && (
                <TouchableOpacity
                  style={[styles.rejectButton, { width: "100%" }]}
                  onPress={() => {
                    setReasonTarget(item);
                    setIsReasonModalOpen(true);
                  }}
                >
                  <Text style={styles.rejectButtonText}>View Rejection Reason</Text>
                </TouchableOpacity>
              )}

              {item.status === "Pending" && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.approveButton,
                      actioningId === item.id && { opacity: 0.6 },
                    ]}
                    onPress={() => handleApprove(item)}
                    disabled={actioningId === item.id}
                  >
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.rejectButton,
                      actioningId === item.id && { opacity: 0.6 },
                    ]}
                    onPress={() => openRejectModal(item)}
                    disabled={actioningId === item.id}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
      </ScrollView>

      <Modal
        visible={isRejectModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeRejectModal}
      >
        {isRejectModalOpen && (
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeRejectModal}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reject Leave Request</Text>

                <TouchableOpacity onPress={closeRejectModal}>
                  <MaterialIcons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                {rejectTarget?.name}'s request for {rejectTarget?.leaveType}
              </Text>

              <Text style={styles.fieldLabel}>
                Reason for rejection <Text style={styles.requiredText}>*</Text>
              </Text>

              <TextInput
                style={styles.reasonInput}
                placeholder="Explain why this request is being rejected..."
                placeholderTextColor="#94A3B8"
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.confirmRejectButton,
                  actioningId === rejectTarget?.id && { opacity: 0.6 },
                ]}
                onPress={handleConfirmReject}
                disabled={actioningId === rejectTarget?.id}
              >
                {actioningId === rejectTarget?.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmRejectButtonText}>
                    Confirm Rejection
                  </Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </Modal>
      <Modal
        visible={isReasonModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReasonModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsReasonModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rejection Details</Text>
              <TouchableOpacity onPress={() => setIsReasonModalOpen(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {reasonTarget?.name}'s request ({reasonTarget?.dates})
            </Text>

            <Text style={styles.fieldLabel}>Rejected by</Text>
            <Text style={styles.reasonDisplay}>{reasonTarget?.rejectedBy}</Text>

            <Text style={styles.fieldLabel}>Reason</Text>
            <Text style={styles.reasonDisplay}>{reasonTarget?.rejectionReason}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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

    gap: 5,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: "#FFFFFF",

    borderTopLeftRadius: 28,

    borderTopRightRadius: 28,

    padding: 24,
  },

  modalHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 8,
  },

  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A" },

  modalSubtitle: { fontSize: 14, color: "#64748B", marginBottom: 16 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },

  requiredText: { color: "red" },

  reasonInput: {
    backgroundColor: "#F8FAFC",

    borderWidth: 1,

    borderColor: "#CBD5E1",

    borderRadius: 12,

    paddingHorizontal: 14,

    paddingVertical: 12,

    fontSize: 14,

    color: "#0F172A",

    minHeight: 100,

    marginBottom: 20,
  },

  confirmRejectButton: {
    backgroundColor: "#BA1A1A",

    borderRadius: 14,

    paddingVertical: 14,

    alignItems: "center",

    justifyContent: "center",
  },

  confirmRejectButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  rejectionReasonText: {
    fontSize: 14,
    color: "#DC2626",
    fontFamily: fonts.regular,
    marginBottom: 12,
  },
  reasonDisplay: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 16,
  },
});
