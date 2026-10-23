import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';

import {
  approveLeaveRequest,
  getLeaveRequests,
  markAllLeavesSeen,
  rejectLeaveRequest,
} from '../../api/admin/api';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

const formatNames = (names) => names.length > 2 ? `${names.slice(0, 2).join(", ")}...` : names.join(", ");

export default function LeaveRequestsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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
  const isFocused = useIsFocused();
  const LIMIT = 10;

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const fetchRequests = async (tab = selectedTab, pageNum = 1) => {
    const isFirst = pageNum === 1;
    const requestId = ++requestIdRef.current;

    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await getLeaveRequests({
        status: tab.toLowerCase(),
        page: pageNum,
        limit: LIMIT,
      });
      if (requestId !== requestIdRef.current) return;

      const list = (response?.data?.data || []).map((item) => ({
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

      setRequests((prev) =>
        isFirst
          ? list
          : [...prev, ...list.filter((i) => !prev.some((p) => p.id === i.id))]
      );
      if (response.data.stats) setStats(response.data.stats);
      setPage(pageNum);
      setHasMore(Boolean(response.data.hasMore));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.log("Failed to fetch leave requests:", error);
      Alert.alert("Error", "Could not load leave requests.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!isFocused) return;

    const markSeen = async () => {
      try {
        await markAllLeavesSeen();
      } catch (error) {
        console.log("Failed to mark leave requests as seen:", error);
      }
    };

    markSeen();
  }, [isFocused]);

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
      : "";

  const formatDateRange = (start, end) =>
    new Date(start).toDateString() === new Date(end).toDateString()
      ? formatDate(start)
      : `${formatDate(start)} - ${formatDate(end)}`;

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  useEffect(() => {
    setRequests([]);
    setHasMore(true);
    setPage(1);
    fetchRequests(selectedTab, 1);
  }, [selectedTab]);

  const handleApprove = async (item) => {
    // console.log(item,"called");
    Alert.alert("Approve Request", `Approve ${item.name}'s leave request?`, [
      { text: "Cancel", style: "cancel" },

      {
        text: "Approve",

        onPress: async () => {
          setActioningId(item.id);

          try {
            await approveLeaveRequest(item.id);

            await fetchRequests(selectedTab);

            Alert.alert("Approved", `${item.name}'s leave has been approved.`);
          } catch (error) {
            console.log("Failed to approve:", error);

            const msg = error?.response?.data?.message;

            Alert.alert("Error", msg || "Could not approve this request.");
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
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
  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;

    if (nearBottom && hasMore && !loading && !loadingMore) {
      fetchRequests(selectedTab, page + 1);
    }
  };

  return (
    <View style={[styles.mainContainer, commonStyles.container]}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricTitle}>Pending Requests</Text>

            <Text style={styles.metricValue}>{stats.pendingCount}</Text>

            <View style={styles.trendContainer}>
              {stats.pendingCount >= stats.pendingSinceYesterday
                ? <MaterialIcons name="trending-up" size={16} color="#006B58" />
                : <MaterialIcons name="trending-down" size={16} color="#6b0005" />}

              <Text
                style={[
                  styles.trendText,
                  {
                    color: stats.pendingCount >= stats.pendingSinceYesterday
                      ? "#006B58"
                      : "#6b0005",
                  },
                ]}
              >
                {stats.pendingSinceYesterday} since yesterday
              </Text>
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
            <Text style={[styles.metricValue, styles.metricValue2]}>
              {stats.onLeaveToday}
            </Text>
            <Text style={styles.metricSubText}>
              {formatNames(stats.onLeaveNames)}
            </Text>
          </View>

          <View
            style={[
              styles.metricIconBox,
              { backgroundColor: "rgba(0,107,88,.1)" },
            ]}
          >
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

        {loading && requests.length === 0 && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
        )}

        {!loading && requests.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No {selectedTab.toLowerCase()} requests found.
            </Text>
          </View>
        )}

        {requests.map((item) => (
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
              <MaterialIcons name="event" size={fontSize(18)} color={colors.primary} />

              <Text style={styles.dateText}>{item.dates}</Text>
            </View>

            <View style={[styles.typeBadge, { backgroundColor: "#F1F4F7" }]}>
              <Text style={[styles.typeBadgeText, { color: "#414750" }]}>
                {item.reason}
              </Text>
            </View>

            {
              /* {!!item.reason && (

                <Text style={styles.reasonText}>Reason: {item.reason}</Text>

              )} */
            }

            {item.status === "Rejected" && (
              <TouchableOpacity
                style={[styles.rejectButton, { width: "100%" }]}
                onPress={() => {
                  setReasonTarget(item);
                  setIsReasonModalOpen(true);
                }}
              >
                <Text style={styles.rejectButtonText}>
                  View Rejection Reason
                </Text>
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
        {loadingMore && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />}
      </ScrollView>

      <Modal
        visible={isRejectModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeRejectModal}
        style={{ paddingBottom: insets.bottom }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
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
                  {actioningId === rejectTarget?.id
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : (
                      <Text style={styles.confirmRejectButtonText}>
                        Confirm Rejection
                      </Text>
                    )}
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={isReasonModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReasonModalOpen(false)}
        style={{paddingBottom:insets.bottom}}
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
            <Text style={styles.reasonDisplay}>
              {reasonTarget?.rejectionReason}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollArea: { flex: 1 },

  scrollContent: {
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
    paddingBottom: hp(24),
  },

  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(24),
    padding: wp(24),

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: hp(14),

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
    fontSize: fontSize(16),

    fontFamily: fonts.semiBold,

    color: colors.blackFont,

    lineHeight: 20,
  },

  metricValue: {
    fontSize: fontSize(32),

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
    fontSize: fontSize(14),

    color: "#006B58",

    fontFamily: fonts.semiBold,
  },

  metricSubText: {
    fontSize: fontSize(14),

    color: "rgba(65,71,80,.6)",

    fontFamily: fonts.semiBold,
  },

  metricIconBox: {
    padding: wp(16),
    borderRadius: wp(12),

    justifyContent: "center",

    alignItems: "center",
  },

  tabContainer: {
    flexDirection: "row",

    backgroundColor: "#E5E8EB",

    borderRadius: wp(12),

    padding: wp(4),

    marginVertical: hp(12),
  },

  tabButton: {
    flex: 1,

    paddingVertical: hp(10),

    alignItems: "center",

    borderRadius: wp(8),
  },

  tabButtonActive: {
    backgroundColor: "#FFFFFF",

    elevation: 1,
  },

  tabText: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#414750",
    lineHeight: 24,
  },

  tabTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  emptyState: {
    padding: wp(30),

    alignItems: "center",
  },

  emptyStateText: {
    color: "#414750",

    fontSize: fontSize(14),
    fontFamily: fonts.medium,
  },

  requestCard: {
    backgroundColor: "#FFFFFF",

    borderRadius: wp(24),

    padding: wp(20),

    marginBottom: hp(16),

    elevation: 2,

    shadowColor: "rgba(0,0,0,.4)",

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.04,

    shadowRadius: 6,
  },

  userInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: hp(14),

    gap: 5,
  },

  userName: {
    fontSize: fontSize(16),

    fontFamily: fonts.semiBold,

    color: "#181C1E",

    lineHeight: 20,
  },

  userRole: {
    fontSize: fontSize(14),

    color: "#414750",

    fontFamily: fonts.regular,

    lineHeight: 20,
  },

  statusBadge: {
    paddingHorizontal: wp(8),

    paddingVertical: hp(4),

    borderRadius: 6,
  },

  statusBadgeText: {
    fontSize: fontSize(11),
    lineHeight: 16,
    fontFamily: fonts.semiBold,
  },

  dateRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    marginBottom: 5,
  },

  dateText: {
    fontSize: fontSize(16),
    lineHeight: 24,
    color: colors.primary,

    fontFamily: fonts.semiBold,
  },

  typeBadge: {
    alignSelf: "flex-start",

    paddingHorizontal: wp(12),

    paddingVertical: hp(6),

    borderRadius: wp(12),

    marginBottom: hp(16),

    width: "100%",
  },

  typeBadgeText: {
    fontSize: fontSize(14),
    lineHeight: 18,
    fontFamily: fonts.regular,
  },

  cardActions: {
    flexDirection: "row",

    gap: 12,
  },

  approveButton: {
    width: "48%",

    paddingHorizontal: wp(24),

    backgroundColor: colors.primary,

    paddingVertical: hp(8),

    borderRadius: wp(12),

    alignItems: "center",
  },

  approveButtonText: {
    color: "#FFFFFF",

    fontFamily: fonts.semiBold,

    fontSize: fontSize(16),

    lineHeight: 24,
  },

  rejectButton: {
    width: "48%",

    borderWidth: 1.5,

    borderColor: "#BA1A1A",

    paddingVertical: hp(8),

    borderRadius: wp(12),

    alignItems: "center",
  },

  rejectButtonText: {
    color: "#BA1A1A",

    fontFamily: fonts.semiBold,

    fontSize: fontSize(16),

    lineHeight: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: "#FFFFFF",

    borderTopLeftRadius: wp(28),

    borderTopRightRadius: wp(28),

    padding: wp(24),
  },

  modalHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 8,
  },

  modalTitle: { fontSize: fontSize(20), fontFamily: fonts.bold, color: "#0F172A" },

  modalSubtitle: { fontSize: fontSize(14), color: "#64748B", marginBottom: hp(10) },

  fieldLabel: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#475569",
    marginBottom: 6,
  },

  requiredText: { color: "red" },

  reasonInput: {
    backgroundColor: "#F8FAFC",

    borderWidth: 1,

    borderColor: "#CBD5E1",

    borderRadius: wp(12),

    paddingHorizontal: wp(14),

    paddingVertical: hp(12),

    fontSize: fontSize(14),

    color: "#0F172A",

    minHeight: hp(100),

    marginBottom: hp(20),
  },

  confirmRejectButton: {
    backgroundColor: "#BA1A1A",

    borderRadius: wp(14),

    paddingVertical: hp(14),

    alignItems: "center",

    justifyContent: "center",
  },

  confirmRejectButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    lineHeight: 18,
  },
  rejectionReasonText: {
    fontSize: fontSize(14),
    color: "#DC2626",
    fontFamily: fonts.regular,
    marginBottom: 12,
  },
  reasonDisplay: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    paddingVertical: hp(12),
    fontSize: fontSize(14),
    color: "#0F172A",
    marginBottom: hp(16),
  },
});
