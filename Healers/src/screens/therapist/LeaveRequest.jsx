import React, {
  useCallback,
  useContext,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

import {
  createLeaveRequestApi,
  getLeaveRequestsApi,
} from '../../api/therapist/api';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Annual Leave",
  "Maternity / Paternity Leave",
  "Unpaid Leave",
  "Emergency Leave",
];

export default function LeaveRequestScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  // Leave records list state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal display state
  const [isApplyModalVisible, setIsApplyModalVisible] = useState(false);

  // Form input state
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startDateSelected, setStartDateSelected] = useState(false);
  const [endDateSelected, setEndDateSelected] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Pickers & Sub-modals
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("start");

  const fetchLeaveRequests = async (pageNumber = 1, isRefreshing = false) => {
    if (loadingMore || (!hasMore && pageNumber !== 1)) return;

    try {
      if (pageNumber === 1 && !isRefreshing) {
        setFetchingList(true);
      } else if (pageNumber > 1) {
        setLoadingMore(true);
      }

      const response = await getLeaveRequestsApi({ page: pageNumber, limit: 5 });
      const newData = response?.data || [];

      if (pageNumber === 1) {
        setLeaveRequests(newData);
      } else {
        setLeaveRequests((prevData) => [...prevData, ...newData]);
      }

      // If retrieved items are fewer than limit (5), end of data is reached
      setHasMore(newData.length === 5);
      setPage(pageNumber);
    } catch (error) {
      Alert.alert("Error", error?.message || "Failed to load leave requests.");
    } finally {
      setFetchingList(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setHasMore(true);
      fetchLeaveRequests(1);
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    fetchLeaveRequests(1, true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !fetchingList && !refreshing) {
      fetchLeaveRequests(page + 1);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const resetForm = () => {
    setLeaveType("");
    setStartDate(new Date());
    setEndDate(new Date());
    setStartDateSelected(false);
    setEndDateSelected(false);
    setReason("");
  };

  const handleOpenDatePicker = (mode) => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      if (pickerMode === "start") {
        setStartDate(selectedDate);
        setStartDateSelected(true);
      } else {
        setEndDate(selectedDate);
        setEndDateSelected(true);
      }
    }
  };

  const handleSubmit = async () => {
    if (!leaveType) {
      Alert.alert("Validation Error", "Please select a leave type.");
      return;
    }
    if (!startDateSelected || !endDateSelected) {
      Alert.alert("Validation Error", "Please select both start and end dates.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Validation Error", "Please enter a reason for the leave request.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        role: "Therapist",
        leaveType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: reason.trim(),
        applicantId: user?.ID,
      };

      const response = await createLeaveRequestApi(payload);

      if (response?.success) {
        Alert.alert("Success", "Leave request submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              setIsApplyModalVisible(false);
              resetForm();
              setHasMore(true);
              fetchLeaveRequests(1);
            },
          },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", error?.message || "Failed to submit leave request.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return { bg: "#DCFCE7", text: "#15803D" };
      case "rejected":
        return { bg: "#FEE2E2", text: "#B91C1C" };
      default:
        return { bg: "#FEF3C7", text: "#B45309" };
    }
  };

  const renderLeaveCard = ({ item }) => {
    const badgeStyle = getStatusBadgeStyle(item.status);
    const statusKey = item.status?.toLowerCase();
    const isApproved = statusKey === "approved";
    const isRejected = statusKey === "rejected";

    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardType}>{item.leaveType}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
            <Text style={[styles.statusText, { color: badgeStyle.text }]}>
              {item.status ? item.status.toUpperCase() : "PENDING"}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.dateRow}>
            <Feather name="calendar" size={14} color="#64748B" />
            <Text style={styles.dateText}>
              {formatDate(item.startDate)} - {formatDate(item.endDate)}
            </Text>
          </View>

          <Text style={styles.reasonText} numberOfLines={2}>
            <Text style={{ fontWeight: "600" }}>Reason:</Text>
            {item.reason}
          </Text>

          {/* Display Approver Name if Approved */}
          {isApproved && item.approved_by && (
            <View style={styles.approvedByContainer}>
              <Feather name="check-circle" size={14} color="#15803D" />
              <Text style={styles.approvedByText}>
                {" "}Approved by:{" "}
                <Text style={styles.adminNameText}>
                  {item.approved_by.fullName || item.approved_by.name || "Admin"}
                </Text>
              </Text>
            </View>
          )}

          {/* Display Rejection Reason if Rejected */}
          {isRejected && (
            <View style={[styles.rejectionContainer, { display: "flex",flexDirection:"row",gap:5 }]}>
              <Feather name="alert-circle" size={14} style={{marginTop:3}} color="#B91C1C" />
              <Text style={styles.rejectionText}>
                {" "}
                <Text style={{ fontFamily: fonts.semiBold }}>Rejection Reason:</Text>{" "}
                <Text style={styles.rejectionReasonText}>
                  {item.rejectionReason || "No specific reason provided."}
                </Text>
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <TopBar navigation={navigation} headerTitle="Leave Requests" />

      <View style={styles.headerBanner}>
        <Text style={styles.bannerTitle}>Leave Requests</Text>
        <TouchableOpacity
          style={styles.applyBtn}
          activeOpacity={0.85}
          onPress={() => setIsApplyModalVisible(true)}
        >
          <Feather name="plus" size={18} color={colors.primary} />
          <Text style={styles.applyBtnText}>Apply Leave</Text>
        </TouchableOpacity>
      </View>

      {fetchingList
        ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )
        : (
          <FlatList
            data={leaveRequests}
            keyExtractor={(item, index) => item._id || item.id || index.toString()}
            renderItem={renderLeaveCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore
              ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )
              : null}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="file-text" size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Leave Requests Found</Text>
                <Text style={styles.emptySubText}>
                  Click "Apply Leave" above to create your first leave request.
                </Text>
              </View>
            }
          />
        )}

      {/* Apply Leave Form Modal */}
      <Modal
        visible={isApplyModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsApplyModalVisible(false)}
      >
        <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
          <View style={styles.modalHeaderBar}>
            <Text style={styles.modalHeaderTitle}>Apply Leave</Text>
            <TouchableOpacity onPress={() => setIsApplyModalVisible(false)}>
              <Feather name="x" size={24} color="#181C1E" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>
              <Text style={styles.sectionTitle}>Submit The Request</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Enter Type</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  activeOpacity={0.8}
                  onPress={() => setTypeModalVisible(true)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !leaveType && styles.placeholderText,
                    ]}
                  >
                    {leaveType || "Select Category"}
                  </Text>
                  <Feather name="chevron-down" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  activeOpacity={0.8}
                  onPress={() => handleOpenDatePicker("start")}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !startDateSelected && styles.placeholderText,
                    ]}
                  >
                    {startDateSelected ? formatDate(startDate) : "Enter Date"}
                  </Text>
                  <Feather name="calendar" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  activeOpacity={0.8}
                  onPress={() => handleOpenDatePicker("end")}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !endDateSelected && styles.placeholderText,
                    ]}
                  >
                    {endDateSelected ? formatDate(endDate) : "Enter Date"}
                  </Text>
                  <Feather name="calendar" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Reason*</Text>
                <View style={styles.textAreaWrapper}>
                  <TextInput
                    style={styles.textAreaInput}
                    placeholder="Describe your reason..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={reason}
                    onChangeText={setReason}
                  />
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.8}
                  onPress={() => setIsApplyModalVisible(false)}
                  disabled={loading}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitBtn}
                  activeOpacity={0.85}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#FFFFFF" size="small" />
                    : <Text style={styles.submitBtnText}>Submit Request</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {showPicker && (
            <DateTimePicker
              value={pickerMode === "start" ? startDate : endDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onValueChange={handleDateChange}
            />
          )}

          {showPicker && Platform.OS === "ios" && (
            <Modal transparent={true} animationType="slide">
              <View style={styles.iosPickerOverlay}>
                <View style={styles.iosPickerContainer}>
                  <View style={styles.iosPickerHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <Text style={styles.iosDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={pickerMode === "start" ? startDate : endDate}
                    mode="date"
                    display="spinner"
                    onValueChange={handleDateChange}
                  />
                </View>
              </View>
            </Modal>
          )}

          <Modal
            visible={typeModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setTypeModalVisible(false)}
          >
            <TouchableWithoutFeedback onPress={() => setTypeModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Select Leave Type</Text>
                      <TouchableOpacity onPress={() => setTypeModalVisible(false)}>
                        <Feather name="x" size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={{ maxHeight: 280 }}>
                      {LEAVE_TYPES.map((type, index) => {
                        const isSelected = leaveType === type;
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.modalOption,
                              isSelected && styles.modalOptionSelected,
                            ]}
                            onPress={() => {
                              setLeaveType(type);
                              setTypeModalVisible(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.modalOptionText,
                                isSelected && styles.modalOptionTextSelected,
                              ]}
                            >
                              {type}
                            </Text>
                            {isSelected && <Feather name="check" size={18} color="#005B41" />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </SafeAreaView>
      </Modal>

      <TherapistBottomBar activeTab="Children" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerBanner: {
    backgroundColor: "#006B58",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 28,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  applyBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 20,
    paddingBottom: 30,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardType: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  cardBody: {
    gap: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  reasonText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  approvedByContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  approvedByText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#15803D",
  },
  adminNameText: {
    fontFamily: fonts.bold,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#334155",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 30,
  },
  modalHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#181C1E",
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    marginBottom: 24,
    lineHeight: 32,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    marginBottom: 8,
    lineHeight: 20,
  },
  dropdownInput: {
    height: 52,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
  },
  placeholderText: {
    color: "#94A3B8",
    lineHeight: 20,
  },
  textAreaWrapper: {
    minHeight: 120,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textAreaInput: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    padding: 0,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 20,
  },
  submitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B598F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.white,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 22,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  modalOptionTextSelected: {
    fontFamily: fonts.bold,
    color: "#005B41",
    lineHeight: 20,
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  iosPickerContainer: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 20,
  },
  iosPickerHeader: {
    padding: 16,
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iosDoneText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0B598F",
    lineHeight: 20,
  },
});
