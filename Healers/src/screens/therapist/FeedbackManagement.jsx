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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

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
  const matchedRange = MONTH_RANGES.find((item) => item.months && item.months[0] === currentMonth);
  return matchedRange ? matchedRange.label : "January - February";
};

const CHILDREN_DATA = [
  {
    id: "1",
    name: "Ali Raza",
    parent: "Nawaz",
    sessions: [
      {
        id: "101",
        name: "Ali Raza",
        time: "2:10 AM",
        date: "JULY 01",
        month: "July",
        category: "SPEECH & LANGUAGE",
        status: "Feedback Done",
        isDone: true,
      },
      {
        id: "102",
        name: "Ali Raza",
        time: "2:10 AM",

        date: "JULY 02",
        month: "July",
        category: "INTEGRATION",
        status: "Pending",
        isDone: false,
      },
      {
        id: "103",
        name: "Ali Raza",
        time: "2:10 AM",

        date: "AUGUST 03",
        month: "August",
        category: "INTEGRATION",
        status: "Feedback Done",
        isDone: true,
      },
      {
        id: "104",
        name: "Ali Raza",
        time: "2:10 AM",

        date: "AUGUST 14",
        month: "August",
        category: "INTEGRATION",
        status: "Pending",
        isDone: false,
      },
      {
        id: "105",
        name: "Ali Raza",
        time: "2:10 AM",

        date: "SEPTEMBER 05",
        month: "September",
        category: "INTEGRATION",
        status: "Pending",
        isDone: false,
      },
    ],
  },
  {
    id: "2",
    name: "Fatima Noor",
    parent: "Tariq",
    sessions: [
      {
        id: "201",
        name: "Fatima Noor",
        time: "11:30 AM",
        date: "JULY 01",
        month: "July",
        category: "BEHAVIORAL",
        status: "Feedback Done",
        isDone: true,
      },
      {
        id: "202",
        name: "Fatima Noor",
        time: "",
        date: "AUGUST 12",
        month: "August",
        category: "SPEECH & LANGUAGE",
        status: "Pending",
        isDone: false,
      },
      {
        id: "203",
        name: "Fatima Noor",
        time: "2:10 AM",

        date: "SEPTEMBER 03",
        month: "September",
        category: "BEHAVIORAL",
        status: "Feedback Done",
        isDone: true,
      },
    ],
  },
  {
    id: "3",
    name: "Hassan Khan",
    parent: "Aslam",
    sessions: [
      {
        id: "301",
        name: "Hassan Khan",
        time: "02:00 PM",
        date: "JULY 02",
        month: "July",
        category: "OCCUPATIONAL",
        status: "Feedback Done",
        isDone: true,
      },
      {
        id: "302",
        name: "Hassan Khan",
        time: "04:30 PM",
        date: "AUGUST 04",
        month: "August",
        category: "OCCUPATIONAL",
        status: "Feedback Done",
        isDone: true,
      },
      {
        id: "303",
        name: "Hassan Khan",
        time: "2:10 AM",

        date: "SEPTEMBER 06",
        month: "September",
        category: "INTEGRATION",
        status: "Pending",
        isDone: false,
      },
    ],
  },
  {
    id: "4",
    name: "Zainab Ali",
    parent: "Usman",
    sessions: [
      {
        id: "401",
        name: "Zainab Ali",
        time: "2:10 AM",

        date: "JULY 05",
        month: "July",
        category: "ARTICULATION",
        status: "Pending",
        isDone: false,
      },
      {
        id: "402",
        name: "Zainab Ali",
        time: "05:00 PM",
        date: "OCTOBER 10",
        month: "October",
        category: "ARTICULATION",
        status: "Feedback Done",
        isDone: true,
      },
    ],
  },
];

export default function FeedbackManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [selectedChildId, setSelectedChildId] = useState("1");
  const [selectedRange, setSelectedRange] = useState(getCurrentMonthRangeLabel);

  const [childDropdownVisible, setChildDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);

  const activeChild = CHILDREN_DATA.find((item) => item.id === selectedChildId) || CHILDREN_DATA[0];

  const activeRangeConfig = MONTH_RANGES.find((r) => r.label === selectedRange) || MONTH_RANGES[0];

  const filteredSessions = activeChild.sessions.filter((session) => {
    if (activeRangeConfig.label === "All Months") return true;
    return activeRangeConfig.months.some(
      (m) => m.toLowerCase() === session.month.toLowerCase(),
    );
  });

  const totalSessionsCount = filteredSessions.length;
  const feedbackDoneCount = filteredSessions.filter((s) => s.isDone).length;
  const formattedFeedbackCount = feedbackDoneCount < 10 ? `0${feedbackDoneCount}` : `${feedbackDoneCount}`;

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar navigation={navigation} headerTitle="Feedback Management" />

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
            <Feather name="search" size={20} color="#717781" style={styles.searchIcon} />
            <Text style={styles.selectedChildText}>{activeChild.name}</Text>
            <Feather name="chevron-down" size={18} color="#717781" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterBtn}
            activeOpacity={0.8}
            onPress={() => setChildDropdownVisible(true)}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />
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

        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>TOTAL{"\n"}CHILD</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{formattedFeedbackCount}</Text>
            <Text style={styles.statLabel}>GIVE{"\n"}FEEDBACK</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalSessionsCount}</Text>
            <Text style={styles.statLabel}>TOTAL{"\n"}SESSION</Text>
          </View>
        </View>

        <View style={styles.dateHeaderBanner}>
          <TouchableOpacity
            style={styles.dateDropdownBtn}
            activeOpacity={0.7}
            onPress={() => setMonthDropdownVisible(true)}
          >
            <Text style={styles.dateDropdownText}>{selectedRange}</Text>
            <Feather name="chevron-down" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.feedbackPillBtn} activeOpacity={0.8}
          onPress={()=>navigation.navigate('AddFeedback')}>
            <Text style={styles.feedbackPillText}>Feedback</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sessionList}>
          {filteredSessions.length > 0
            ? (
              filteredSessions.map((item) => (
                <View key={item.id} style={styles.sessionCard}>
                  <View style={styles.sessionLeft}>
                    {item.isDone
                      ? (
                        <View style={styles.iconCircleDone}>
                          <Ionicons name="checkmark-circle-outline" size={22} color="#006B58" />
                        </View>
                      )
                      : (
                        <View style={styles.iconCirclePending}>
                          <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={22} color="#717781" />
                        </View>
                      )}

                    <View style={styles.sessionDetails}>
                      <View style={styles.nameTimeRow}>
                        <Text style={styles.childItemName}>{item.name}</Text>
                        {item.time !== ""
                          && <Text style={styles.timeText}>{item.time}</Text>}
                      </View>
                      <Text style={styles.categoryText}>
                        <Text style={styles.dateHighlight}>{item.date}</Text> • {item.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sessionRight}>
                    {item.isDone
                      ? (
                        <>
                          <View style={styles.badgeDone}>
                            <Text style={styles.badgeDoneText}>Feedback Done</Text>
                          </View>
                          <TouchableOpacity style={styles.viewBtn} activeOpacity={0.8}>
                            <Text style={styles.viewBtnText}>View</Text>
                          </TouchableOpacity>
                        </>
                      )
                      : (
                        <>
                          <View style={styles.badgePending}>
                            <Text style={styles.badgePendingText}>Pending</Text>
                          </View>
                          <TouchableOpacity style={styles.addFeedbackBtn} activeOpacity={0.8}>
                            <Text style={styles.addFeedbackBtnText}>Add Feedback</Text>
                          </TouchableOpacity>
                        </>
                      )}
                  </View>
                </View>
              ))
            )
            : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No sessions found for {selectedRange}</Text>
              </View>
            )}
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
                {CHILDREN_DATA.map((child) => {
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
                      {isSelected && <Feather name="check" size={18} color="#1669A9" />}
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
                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
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
                        {isSelected && <Feather name="check" size={18} color="#006B5D" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <TherapistBottomBar activeTab="FeedbackManagement" />
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
    paddingBottom: 24,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  selectedChildText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: "#0F172A",
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
    padding: 24,
    borderWidth: 1,
    borderColor: "#C1C7D2",
    marginBottom: 16,
  },
  childSectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.regular,
    color: "#717781",
    marginBottom: 6,
    lineHeight: 16,
  },
  fieldValueContainer: {
    backgroundColor: "#F1F4F7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C1C7D2",
    paddingHorizontal: 12,
    height: 40,
    justifyContent: "center",
  },
  fieldValueText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 20,
  },

  statsCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  statNumber: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    marginBottom: 5,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: "rgba(256,256,256,.8)",
    textAlign: "center",
    lineHeight: 15,
    letterSpacing: 0.5,
  },

  dateHeaderBanner: {
    backgroundColor: "#00725E",
    borderRadius: 0,
    marginHorizontal: -16,
    paddingHorizontal: 16,
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
    fontFamily: fonts.regular,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  feedbackPillBtn: {
    backgroundColor: "#8BF6D9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  feedbackPillText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#006B58",
    lineHeight: 16,
  },

  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E0E3E6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sessionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircleDone: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#8BF6D9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconCirclePending: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#E5E8EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sessionDetails: {
    flex: 1,
  },
  nameTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  childItemName: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
  },
  timeText: {
    fontSize: 8,
    fontFamily: fonts.regular,
    color: "#737277",
    lineHeight: 20,
  },
  categoryText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: "#F58B2A",
    lineHeight: 10,
  },
  dateHighlight: {
    color: "#00725E",
  },

  sessionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 5,
  },
  badgeDone: {
    backgroundColor: "#00725E",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDoneText: {
    fontSize: 6,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
  },
  viewBtn: {
    backgroundColor: "#F58B2A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewBtnText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  badgePending: {
    backgroundColor: "#006B5D",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePendingText: {
    fontSize: 6,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
  },
  addFeedbackBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addFeedbackBtnText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },

  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#64748B",
  },

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
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  dropdownOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: "#F1F5F9",
  },
  dropdownOptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#334155",
  },
  dropdownOptionTextSelected: {
    fontFamily: fonts.bold,
    color: "#1669A9",
  },
});
