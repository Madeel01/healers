import React, {
  useCallback,
  useContext,
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';

import {
  feedbackManagement,
  therapistUsers,
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
  return matchedRange ? matchedRange.label : "All Months";
};

export default function FeedbackManagementScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const [selectedRange, setSelectedRange] = useState(getCurrentMonthRangeLabel);
  const [childDropdownVisible, setChildDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [children, setChildren] = useState([]);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loadingChildrenFeedback, setLoadingFeedback] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [stats, setStats] = useState({
    totalChildren: 0,
    totalSessions: 0,
    totalFeedbackDone: 0,
  });
  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchFeedbackData();
    }
  }, [selectedChildId, selectedRange]);

  useFocusEffect(
    useCallback(() => {
      if (children.length === 0) {
        fetchChildren();
      }
    }, [children.length]),
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId) {
        fetchFeedbackData();
      }
    }, [selectedChildId, selectedRange]),
  );

  const fetchChildren = async () => {
    try {
      const ID = user?.id;
      const responseData = await therapistUsers({ filter: ID });
      const fetchedUsers = responseData?.data || [];
      setChildren(fetchedUsers);

      if (fetchedUsers.length > 0 && !selectedChildId) {
        const initialChildId = fetchedUsers[0]._id || fetchedUsers[0].id;
        setSelectedChildId(initialChildId);
      }
    } catch (error) {
      console.error("Error fetching children:", error);
    }
  };

  const fetchFeedbackData = async () => {
    try {
      setLoadingFeedback(true);
      const ID = user?.id;

      const response = await feedbackManagement(ID, selectedChildId, selectedRange);
      if (response?.success) {
        const { data, stats } = response;
        if (stats) {
          setStats({
            totalChildren: stats.totalChildren || 0,
            totalSessions: stats.totalSessions || 0,
            totalFeedbackDone: stats.totalFeedbackDone || 0,
          });
        }

        if (data && data.length > 0) {
          setFeedbackData(data);

          if (!selectedChildId || !data.some((c) => c.id === selectedChildId)) {
            setSelectedChildId(data[0].id);
          }
        } else {
          setFeedbackData([]);
        }
      }
    } catch (error) {
      console.error("Error fetching feedback data:", error);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const activeChild = children.find((item) => item._id === selectedChildId);

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
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
            <Text style={styles.selectedChildText}>{activeChild?.name || activeChild?.fullName}</Text>
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
                <Text style={styles.fieldValueText}>{activeChild?.name || activeChild?.fullName}</Text>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Parents</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValueText}>N/A</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalChildren}</Text>
            <Text style={styles.statLabel}>TOTAL{"\n"}CHILDREN</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {stats.totalFeedbackDone < 10
                ? `0${stats.totalFeedbackDone}`
                : stats.totalFeedbackDone}
            </Text>
            <Text style={styles.statLabel}>GIVE{"\n"}FEEDBACK</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>TOTAL{"\n"}SESSIONS</Text>
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
          <View
            style={styles.feedbackPillBtn}
          >
            <Text style={styles.feedbackPillText}>Feedback</Text>
          </View>
        </View>

        {loadingChildrenFeedback
          ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary || "#006B5D"} />
              <Text style={styles.loadingText}>Loading sessions...</Text>
            </View>
          )
          : (
            (() => {
              const activeChild = feedbackData.find((item) => item.id === selectedChildId) || feedbackData[0];
              const sessions = activeChild?.sessions || [];

              const isFutureDate = (dateVal, timeStr) => {
                if (!dateVal) return false;

                const now = new Date();

                const sessionDate = new Date(dateVal);

                if (timeStr && typeof timeStr === "string") {
                  const startTimePart = timeStr.includes("-")
                    ? timeStr.split("-")[0].trim()
                    : timeStr.trim();

                  const [hours, minutes] = startTimePart.split(":").map(Number);

                  if (!isNaN(hours) && !isNaN(minutes)) {
                    sessionDate.setHours(hours, minutes, 0, 0);
                    return sessionDate > now;
                  }
                }

                sessionDate.setHours(23, 59, 59, 999);
                return sessionDate > now;
              };

              return (
                <View style={styles.sessionList}>
                  {sessions.length > 0
                    ? (
                      sessions.map((item) => {
                        const isUpcoming = isFutureDate(item.rawDate, item.time || item.date);
                        return (
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
                                    <MaterialCommunityIcons
                                      name="dots-horizontal-circle-outline"
                                      size={22}
                                      color="#717781"
                                    />
                                  </View>
                                )}

                              <View style={styles.sessionDetails}>
                                <View style={styles.nameTimeRow}>
                                  <Text style={styles.childItemName}>{item.name}</Text>
                                  {item.time !== "" && <Text style={styles.timeText}>{formatTo12Hour(item.time)}</Text>}
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
                                    <TouchableOpacity
                                      style={styles.viewBtn}
                                      activeOpacity={0.8}
                                      onPress={() =>
                                        navigation.navigate("AddFeedback", {
                                          session: item,
                                          childId: selectedChildId,
                                          isViewOnly: true,
                                        })}
                                    >
                                      <Text style={styles.viewBtnText}>View</Text>
                                    </TouchableOpacity>
                                  </>
                                )
                                : (
                                  <>
                                    <View style={styles.badgePending}>
                                      <Text style={styles.badgePendingText}>Pending</Text>
                                    </View>

                                    <TouchableOpacity
                                      style={[
                                        styles.addFeedbackBtn,
                                        isUpcoming && styles.disabledBtn,
                                      ]}
                                      disabled={isUpcoming}
                                      activeOpacity={0.8}
                                      onPress={() =>
                                        navigation.navigate("AddFeedback", {
                                          session: item,
                                          childId: selectedChildId,
                                        })}
                                    >
                                      <Text style={styles.addFeedbackBtnText}>Add Feedback</Text>
                                    </TouchableOpacity>
                                  </>
                                )}
                            </View>
                          </View>
                        );
                      })
                    )
                    : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No sessions found for {selectedRange}</Text>
                      </View>
                    )}
                </View>
              );
            })()
          )}
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
                {children.map((child) => {
                  const isSelected = child._id === selectedChildId;
                  return (
                    <TouchableOpacity
                      key={child._id}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedChildId(child._id);
                        setChildDropdownVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {child?.name || child?.fullName}
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
  disabledBtn: {
    backgroundColor: "#A0AEC0",
    opacity: 0.6,
  },
});
