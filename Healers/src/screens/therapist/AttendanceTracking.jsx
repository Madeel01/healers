import React, {
  useCallback,
  useContext,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';

import {
  getAttendanceApi,
  therapistUsers,
  updateAttendanceStatusApi,
} from '../../api/therapist/api';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_RANGES = [
  ...MONTH_NAMES.map((month, index) => {
    const nextMonth = MONTH_NAMES[(index + 1) % 12];
    return {
      label: `${month} - ${nextMonth}`,
      months: [month, nextMonth],
      monthIndex: index + 1,
    };
  }),
];

export default function AttendanceTrackingScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const filterType = route?.params?.filterType;

  console.log("filterType", filterType);
  const currentMonthIdx = new Date().getMonth();
  const defaultRangeLabel = MONTH_RANGES[currentMonthIdx]?.label || "All Months";

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [selectedRange, setSelectedRange] = useState(defaultRangeLabel);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const [childDropdownVisible, setChildDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchChildren();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId) {
        fetchAttendanceData();
      }
    }, [selectedChildId, selectedRange]),
  );
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.filterType === "today") {
        setSelectedRange("Today");
        setSelectedChildId(null);
      }
    }, [route?.params]),
  );
  const fetchChildren = async () => {
    try {
      const response = await therapistUsers({ filter: user?.id });
      const fetchedUsers = response?.data || [];
      setChildren(fetchedUsers);

      if (fetchedUsers.length > 0 && !selectedChildId) {
        const initialId = fetchedUsers[0]._id || fetchedUsers[0].id;
        setSelectedChildId(initialId);
      }
    } catch (error) {
      console.error("Error fetching children:", error);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);

      const params = {};

      if (selectedChildId) {
        params.childId = selectedChildId;
      }

      if (selectedRange === "Today") {
        const now = new Date();
        params.month = now.getMonth() + 1;
        params.year = now.getFullYear();
        params.filter = true;
      } else {
        const activeConfig = MONTH_RANGES.find((r) => r.label === selectedRange);
        if (activeConfig?.monthIndex) {
          params.month = activeConfig.monthIndex;
          params.year = new Date().getFullYear();
          params.filter = false;
        }
      }

      const res = await getAttendanceApi(params);
      if (res?.success) {
        setAttendanceRecords(res.data || []);
      }
    } catch (error) {
      console.error("Error fetching scheduling data:", error);
    } finally {
      setLoading(false);
    }
  };
  // const fetchAttendanceData = async () => {
  //   try {
  //     setLoading(true);
  //     const activeConfig = MONTH_RANGES.find((r) => r.label === selectedRange);

  //     const params = { childId: selectedChildId };
  //     if (activeConfig?.monthIndex) {
  //       params.month = activeConfig.monthIndex;
  //       params.year = new Date().getFullYear();
  //     }

  //     const res = await getAttendanceApi(params);
  //     if (res?.success) {
  //       setAttendanceRecords(res.data || []);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching scheduling data:", error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const activeChild = children.find((c) => (c._id || c.id) === selectedChildId) || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formattedAppointments = attendanceRecords.flatMap((record) => {
    const childObj = record.childId || {};
    const childName = childObj.fullName || childObj.name || "Unknown Child";

    return (record.appointments || []).map((appt) => {
      const rawDateVal = appt.date?.$date || appt.date;
      const dateObj = new Date(rawDateVal);

      const monthName = MONTH_NAMES[dateObj.getMonth()];
      const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

      const apptDateTime = new Date(dateObj);
      if (appt.startTime) {
        const [hours, minutes] = appt.startTime.split(":").map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          apptDateTime.setHours(hours, minutes, 0, 0);
        }
      }

      const now = new Date();
      const isFutureDate = apptDateTime > now;

      const rawStatus = appt.attendance_status || "Pending";
      const displayStatus = rawStatus === "Complete" ? "Present" : rawStatus;

      const isTodayAppointment = dateObj.getDate() === now.getDate()
        && dateObj.getMonth() === now.getMonth()
        && dateObj.getFullYear() === now.getFullYear();

      return {
        id: appt._id?.$oid || appt._id,
        attendanceDocId: record._id?.$oid || record._id,
        childName,
        dateObj,
        isTodayAppointment,
        date: formattedDate,
        time: appt.startTime ? `${appt.startTime} - ${appt.endTime}` : (appt.time || "-"),
        month: monthName,
        status: displayStatus,
        isFutureDate,
      };
    });
  }).filter((item) => {
    // If "Today" filter is active, only retain today's appointments
    if (selectedRange === "Today") {
      return item.isTodayAppointment;
    }
    return true;
  });
  // const formattedAppointments = attendanceRecords.flatMap((record) => {
  //   return (record.appointments || []).map((appt) => {
  //     const rawDateVal = appt.date?.$date || appt.date;
  //     const dateObj = new Date(rawDateVal);

  //     const monthName = MONTH_NAMES[dateObj.getMonth()];
  //     const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

  //     const apptDateTime = new Date(dateObj);
  //     if (appt.startTime) {
  //       const [hours, minutes] = appt.startTime.split(":").map(Number);
  //       if (!isNaN(hours) && !isNaN(minutes)) {
  //         apptDateTime.setHours(hours, minutes, 0, 0);
  //       }
  //     }

  //     const now = new Date();
  //     const isFutureDate = apptDateTime > now;

  //     const rawStatus = appt.attendance_status || "Pending";
  //     const displayStatus = rawStatus === "Complete" ? "Present" : rawStatus;

  //     return {
  //       id: appt._id?.$oid || appt._id,
  //       attendanceDocId: record._id?.$oid || record._id,
  //       date: formattedDate,
  //       time: appt.startTime ? `${appt.startTime} - ${appt.endTime}` : (appt.time || "-"),
  //       month: monthName,
  //       status: displayStatus,
  //       isFutureDate,
  //     };
  //   });
  // });

  const visibleAppointments = showFullHistory
    ? formattedAppointments
    : formattedAppointments.slice(0, 5);

  const handleToggleStatus = async (attendanceDocId, appointmentId, targetStatus, currentStatus, isFutureDate) => {
    if (isFutureDate) return;

    const nextStatus = currentStatus === targetStatus ? "Pending" : targetStatus;
    const dbStatus = nextStatus === "Present" ? "Complete" : nextStatus;

    setAttendanceRecords((prevRecords) =>
      prevRecords.map((doc) => {
        const docId = doc._id?.$oid || doc._id;
        if (docId !== attendanceDocId) return doc;
        return {
          ...doc,
          appointments: doc.appointments.map((appt) => {
            const apptId = appt._id?.$oid || appt._id;
            return apptId === appointmentId
              ? { ...appt, attendance_status: dbStatus }
              : appt;
          }),
        };
      })
    );

    try {
      await updateAttendanceStatusApi({
        attendanceId: attendanceDocId,
        appointmentId,
        status: dbStatus,
      });
    } catch (error) {
      console.error("Failed to update attendance_status:", error);
      fetchAttendanceData();
    }
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <TopBar navigation={navigation} headerTitle="Attendance Tracking" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedRange !== "Today" && (
          <>
            <View style={styles.searchRow}>
              <TouchableOpacity
                style={styles.searchBarContainer}
                activeOpacity={0.8}
                onPress={() => setChildDropdownVisible(true)}
              >
                <Feather name="search" size={18} color="#717781" style={styles.searchIcon} />
                <Text style={styles.selectedChildText}>
                  {activeChild?.fullName || activeChild?.name || "Select Child"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterBtn}
                activeOpacity={0.8}
                onPress={() => setChildDropdownVisible(true)}
              >
                <Ionicons name="options-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.childInfoCard}>
              <Text style={styles.childSectionTitle}>Child Information</Text>
              <View style={styles.inputRow}>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValueText}>{activeChild?.fullName || activeChild?.name || "-"}</Text>
                  </View>
                </View>

                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Parents</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValueText}>
                      {activeChild?.fatherName || activeChild?.parentName || "-"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
        <View style={styles.dateHeaderBanner}>
          <TouchableOpacity
            style={styles.dateDropdownBtn}
            activeOpacity={0.7}
            onPress={() => selectedRange === "Today" ? "" : setMonthDropdownVisible(true)}
          >
            <Text style={styles.dateDropdownText}>{selectedRange}</Text>
            <Feather name="chevron-down" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.statusPillBadge}>
            <Text style={styles.statusPillText}>Status</Text>
          </View>
        </View>

        <View style={styles.attendanceContainer}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            : visibleAppointments.length > 0
            ? (
              <>
                {visibleAppointments.map((item, index) => {
                  const isPresent = item.status === "Present";
                  const isAbsent = item.status === "Absent";
                  const isPending = item.status === "Pending";
                  const isDisabled = item.isFutureDate;

                  let toggleGroupBg = "hsl(60, 26%, 93%)";
                  if (isPresent) toggleGroupBg = "#E0F7F1";
                  if (isAbsent) toggleGroupBg = "rgba(186,26,26,0.10)";
                  if (isDisabled) toggleGroupBg = "rgba(0,0,0,.20)";

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.attendanceRow,
                        index < visibleAppointments.length - 1 && styles.borderBottom,
                        isDisabled && styles.disabledRow,
                      ]}
                    >
                      <View style={styles.dateColumn}>
                        {selectedRange === "Today" && (
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: "#1E293B", marginBottom: 2 }}>
                            {item.childName}
                          </Text>
                        )}
                        <Text style={[styles.dateText, isDisabled && styles.disabledText]}>{item.date}</Text>
                        <Text style={[styles.timeText, isDisabled && styles.disabledText]}>
                          {formatTo12Hour(item.time)}
                        </Text>
                      </View>

                      {/* Toggle Switch Pill */}
                      <View style={[styles.toggleGroup, { backgroundColor: toggleGroupBg }]}>
                        <TouchableOpacity
                          style={[
                            styles.toggleIconBtn,
                            isPresent && styles.presentActiveBg,
                            !isPresent && styles.inactiveToggleBg,
                          ]}
                          activeOpacity={isDisabled ? 1 : 0.7}
                          disabled={isDisabled}
                          onPress={() =>
                            handleToggleStatus(
                              item.attendanceDocId,
                              item.id,
                              "Present",
                              item.status,
                              item.isFutureDate,
                            )}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={isPresent ? "#006B58" : "#8A9099"}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.toggleIconBtn,
                            isAbsent && styles.absentActiveBg,
                            !isAbsent && styles.inactiveToggleBg,
                          ]}
                          activeOpacity={isDisabled ? 1 : 0.7}
                          disabled={isDisabled}
                          onPress={() =>
                            handleToggleStatus(item.attendanceDocId, item.id, "Absent", item.status, item.isFutureDate)}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={isAbsent ? "#BA1A1A" : "#8A9099"}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.statusBadgeColumn}>
                        {isPresent && (
                          <View style={styles.presentBadge}>
                            <Text style={[styles.presentBadgeText, styles.statusBadgeText]}>Present</Text>
                          </View>
                        )}
                        {isAbsent && (
                          <View style={styles.absentBadge}>
                            <Text style={[styles.absentBadgeText, styles.statusBadgeText]}>Absent</Text>
                          </View>
                        )}
                        {(isPending && !isDisabled) && (
                          <View style={styles.pendingBadge}>
                            <Text style={[styles.pendingBadgeText, styles.statusBadgeText]}>Pending</Text>
                          </View>
                        )}
                        {isDisabled && (
                          <View style={styles.pendingBadge}>
                            <Text style={[styles.pendingBadgeText, styles.statusBadgeText]}>Not Yet</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}

                {formattedAppointments.length > 5 && (
                  <TouchableOpacity
                    style={styles.fullHistoryBtn}
                    activeOpacity={0.7}
                    onPress={() => setShowFullHistory(!showFullHistory)}
                  >
                    <Text style={styles.fullHistoryText}>
                      {showFullHistory ? "HIDE HISTORY" : "VIEW FULL HISTORY"}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )
            : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No attendance records found</Text>
              </View>
            )}
        </View>
      </ScrollView>

      {/* Modals */}
      <Modal
        visible={childDropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChildDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setChildDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                <Text style={styles.dropdownMenuTitle}>Select Child</Text>
                {children.map((child) => {
                  const id = child._id || child.id;
                  const isSelected = id === selectedChildId;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                      onPress={() => {
                        setSelectedChildId(id);
                        setChildDropdownVisible(false);
                      }}
                    >
                      <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                        {child.fullName || child.name}
                      </Text>
                      {isSelected && <Feather name="check" size={18} color="#0B598F" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={monthDropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMonthDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMonthDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                <Text style={styles.dropdownMenuTitle}>Select Month Range</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {MONTH_RANGES.map((rangeObj) => {
                    const isSelected = rangeObj.label === selectedRange;
                    return (
                      <TouchableOpacity
                        key={rangeObj.label}
                        style={[styles.dropdownOption, isSelected && styles.dropdownOptionSelected]}
                        onPress={() => {
                          setSelectedRange(rangeObj.label);
                          setMonthDropdownVisible(false);
                        }}
                      >
                        <Text style={[styles.dropdownOptionText, isSelected && styles.dropdownOptionTextSelected]}>
                          {rangeObj.label}
                        </Text>
                        {isSelected && <Feather name="check" size={18} color="#0B598F" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <TherapistBottomBar activeTab="AttendanceTracking" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  selectedChildText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 20,
  },
  filterBtn: {
    backgroundColor: "#1669A9",
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  childInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: "#C1C7D2",
    marginBottom: 16,
  },
  childSectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 24,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldBox: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#717781",
    marginBottom: 4,
    lineHeight: 18,
  },
  fieldValueContainer: {
    backgroundColor: "#F7FAFD",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 12,
    height: 38,
    justifyContent: "center",
  },
  fieldValueText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
  },

  dateHeaderBanner: {
    backgroundColor: "#005086",
    borderRadius: 0,
    marginHorizontal: -16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateDropdownText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  statusPillBadge: {
    backgroundColor: "#8BF6D9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.primary,
    lineHeight: 16,
  },

  attendanceContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E3E6",
    overflow: "hidden",
  },
  attendanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  dateColumn: {
    width: 100,
  },
  dateText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#181C1E",
    lineHeight: 16,
  },
  timeText: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
  },

  toggleGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(139,246,217,.3)",
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  toggleIconBtn: {
    width: 32,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  presentActiveBg: {
    backgroundColor: "#FFFFFF",
  },
  absentActiveBg: {
    backgroundColor: "#FFFFFF",
  },
  inactiveToggleBg: {
    backgroundColor: "transparent",
  },

  statusBadgeColumn: {
    width: 85,
    alignItems: "flex-end",
  },
  presentBadge: {
    backgroundColor: "rgba(0,107,88,.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,107,88,.2)",
  },
  statusBadgeText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  presentBadgeText: {
    color: "#006B58",
  },
  absentBadge: {
    backgroundColor: "rgba(186,26,26,.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(186,26,26,.2)",
  },
  absentBadgeText: {
    color: "#BA1A1A",
  },
  pendingBadge: {
    backgroundColor: "#E0E3E6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C1C7D2",
  },
  pendingBadgeText: {
    color: "#717781",
  },

  fullHistoryBtn: {
    backgroundColor: "#F1F4F7",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#E0E3E6",
  },
  fullHistoryText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 15,
  },

  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#64748B",
    lineHeight: 18,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dropdownMenu: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownMenuTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    lineHeight: 20,
  },
  dropdownOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: "#F1F5F9",
  },
  dropdownOptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: "#0B598F",
    lineHeight: 20,
  },
});
