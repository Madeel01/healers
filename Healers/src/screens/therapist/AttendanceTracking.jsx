import React, { useState } from 'react';

import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

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
  { label: "All Months", months: [] },
  ...MONTH_NAMES.map((month, index) => {
    const nextMonth = MONTH_NAMES[(index + 1) % 12];
    return {
      label: `${month} - ${nextMonth}`,
      months: [month, nextMonth],
    };
  }),
];

const getCurrentMonthRangeLabel = () => {
  const currentMonthIndex = new Date().getMonth();
  const currentMonth = MONTH_NAMES[currentMonthIndex];
  const matchedRange = MONTH_RANGES.find(
    (item) => item.months && item.months[0] === currentMonth,
  );
  return matchedRange ? matchedRange.label : "July - August";
};

const INITIAL_CHILDREN_DATA = [
  {
    id: "1",
    name: "Ali Raza",
    parent: "Nawaz",
    attendance: [
      { id: "101", date: "Jul 01", time: "09:00 AM", month: "July", status: "Present" },
      { id: "102", date: "Jul 03", time: "09:00 AM", month: "July", status: "Absent" },
      { id: "103", date: "Jul 05", time: "09:00 AM", month: "July", status: "Present" },
      { id: "104", date: "Jul 08", time: "09:00 AM", month: "July", status: "Pending" },
      { id: "105", date: "Jul 10", time: "09:00 AM", month: "July", status: "Present" },
      { id: "106", date: "Aug 02", time: "09:00 AM", month: "August", status: "Present" },
    ],
  },
  {
    id: "2",
    name: "Fatima Noor",
    parent: "Tariq",
    attendance: [
      { id: "201", date: "Jul 02", time: "10:30 AM", month: "July", status: "Present" },
      { id: "202", date: "Jul 04", time: "10:30 AM", month: "July", status: "Present" },
      { id: "203", date: "Aug 12", time: "11:00 AM", month: "August", status: "Absent" },
    ],
  },
  {
    id: "3",
    name: "Hassan Khan",
    parent: "Aslam",
    attendance: [
      { id: "301", date: "Jul 01", time: "02:00 PM", month: "July", status: "Present" },
      { id: "302", date: "Aug 04", time: "02:00 PM", month: "August", status: "Present" },
      { id: "303", date: "Sep 06", time: "02:00 PM", month: "September", status: "Pending" },
    ],
  },
];

export default function AttendanceTrackingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [childrenData, setChildrenData] = useState(INITIAL_CHILDREN_DATA);
  const [selectedChildId, setSelectedChildId] = useState("1");
  const [selectedRange, setSelectedRange] = useState(getCurrentMonthRangeLabel);

  const [childDropdownVisible, setChildDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);

  const activeChild = childrenData.find((item) => item.id === selectedChildId) || childrenData[0];

  const activeRangeConfig = MONTH_RANGES.find((r) => r.label === selectedRange) || MONTH_RANGES[0];

  const filteredAttendance = activeChild.attendance.filter((record) => {
    if (activeRangeConfig.label === "All Months") return true;
    return activeRangeConfig.months.some(
      (m) => m.toLowerCase() === record.month.toLowerCase(),
    );
  });

  const handleToggleStatus = (recordId, newStatus) => {
    setChildrenData((prevData) =>
      prevData.map((child) => {
        if (child.id !== activeChild.id) return child;
        return {
          ...child,
          attendance: child.attendance.map((rec) => rec.id === recordId ? { ...rec, status: newStatus } : rec),
        };
      })
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
        { paddingTop: insets.top },
      ]}
    >
      <TopBar navigation={navigation} headerTitle="Attendance Tracking" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBarContainer}
            activeOpacity={0.8}
            onPress={() => setChildDropdownVisible(true)}
          >
            <Feather
              name="search"
              size={18}
              color="#717781"
              style={styles.searchIcon}
            />
            <Text style={styles.selectedChildText}>{activeChild.name}</Text>
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
          <Text style={styles.childSectionTitle}>child</Text>
          <View style={styles.inputRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Name</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValueText}>{activeChild.name}</Text>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Parents</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValueText}>{activeChild.parent}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.dateHeaderBanner}>
          <TouchableOpacity
            style={styles.dateDropdownBtn}
            activeOpacity={0.7}
            onPress={() => setMonthDropdownVisible(true)}
          >
            <Text style={styles.dateDropdownText}>{selectedRange}</Text>
            <Feather name="chevron-down" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.statusPillBadge}>
            <Text style={styles.statusPillText}>Status</Text>
          </View>
        </View>

        <View style={styles.attendanceContainer}>
          {filteredAttendance.length > 0
            ? (
              filteredAttendance.map((item, index) => {
                const isPresent = item.status === "Present";
                const isAbsent = item.status === "Absent";
                const isPending = item.status === "Pending";

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.attendanceRow,
                      index < filteredAttendance.length - 1 && styles.borderBottom,
                    ]}
                  >
                    <View style={styles.dateColumn}>
                      <Text style={styles.dateText}>{item.date}</Text>
                      <Text style={styles.timeText}>{item.time}</Text>
                    </View>

                    <View style={styles.toggleGroup}>
                      <TouchableOpacity
                        style={[
                          styles.toggleIconBtn,
                          isPresent && styles.presentActiveBg,
                          !isPresent && styles.inactiveToggleBg,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleToggleStatus(item.id, "Present")}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={isPresent ? "#006B58" : "#717781"}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.toggleIconBtn,
                          isAbsent && styles.absentActiveBg,
                          !isAbsent && styles.inactiveToggleBg,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleToggleStatus(item.id, "Absent")}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={isAbsent ? "#BA1A1A" : "#717781"}
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
                      {isPending && (
                        <View style={styles.pendingBadge}>
                          <Text style={[styles.pendingBadgeText, styles.statusBadgeText]}>Pending</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )
            : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No attendance records for {selectedRange}
                </Text>
              </View>
            )}

          <TouchableOpacity style={styles.fullHistoryBtn} activeOpacity={0.7}>
            <Text style={styles.fullHistoryText}>VIEW FULL HISTORY</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
                {childrenData.map((child) => {
                  const isSelected = child.id === selectedChildId;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedChildId(child.id);
                        setChildDropdownVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {child.name}
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
                <ScrollView
                  style={{ maxHeight: 300 }}
                  showsVerticalScrollIndicator={true}
                >
                  {MONTH_RANGES.map((rangeObj) => {
                    const isSelected = rangeObj.label === selectedRange;
                    return (
                      <TouchableOpacity
                        key={rangeObj.label}
                        style={[
                          styles.dropdownOption,
                          isSelected && styles.dropdownOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedRange(rangeObj.label);
                          setMonthDropdownVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            isSelected && styles.dropdownOptionTextSelected,
                          ]}
                        >
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
    width: 80,
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
