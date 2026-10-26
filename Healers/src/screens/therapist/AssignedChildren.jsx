import React, {
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';

import {
  getChildPrograms,
  getChildStatsApi,
  therapistUsers,
  updateGoalProgressApi,
} from '../../api/therapist/api';
import { AuthContext } from '../../context/AuthContext';
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

export default function AssignedChildrenScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { width } = useWindowDimensions();

  const containerWidth = width - wp(42);
  const gap = wp(12);
  const chipWidth = (containerWidth - gap) / 2;
  const [searchQuery, setSearchQuery] = useState("");
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [activeSliderGoalId, setActiveSliderGoalId] = useState(null);
  const [sliderValues, setSliderValues] = useState({});
  const [savingGoalId, setSavingGoalId] = useState(null);
  const [sessionStats, setSessionStats] = useState({ nextSession: null, attendancePercentage: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchProgramsForSelectedChild(selectedChildId);
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);
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
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchProgramsForSelectedChild = async (childId) => {
    try {
      setLoadingPrograms(true);
      const therapistId = user?._id || user?.id;
      const response = await getChildPrograms(childId, therapistId);
      if (response?.success) {
        setPrograms(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching programs for child:", error);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const handleOpenSlider = (uniqueKey, currentProgress) => {
    setActiveSliderGoalId(uniqueKey);
    setSliderValues((prev) => ({
      ...prev,
      [uniqueKey]: currentProgress || 0,
    }));
  };

  const handleSaveProgress = async (programId, goalId, uniqueKey) => {
    const newProgress = Math.round(sliderValues[uniqueKey] || 0);
    try {
      setSavingGoalId(uniqueKey);
      const response = await updateGoalProgressApi(programId, goalId, newProgress);

      if (response?.success) {
        setPrograms((prev) =>
          prev.map((prog) => {
            const currentProgId = prog._id || prog.id;
            if (currentProgId === programId) {
              return {
                ...prog,
                programGoals: (prog.programGoals || []).map((goal) => {
                  const currentGoalId = goal._id || goal.id;
                  if (currentGoalId === goalId) {
                    return { ...goal, progress: newProgress };
                  }
                  return goal;
                }),
              };
            }
            return prog;
          })
        );
        setActiveSliderGoalId(null);
      }
    } catch (error) {
      console.error("Failed to save progress:", error);
    } finally {
      setSavingGoalId(null);
    }
  };

  const activeChild = children.find((c) => (c._id || c.id) === selectedChildId);

  const filteredChildren = children?.filter((child) => {
    const childName = child?.fullName ?? child?.name ?? "";
    return childName.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const filteredModalChildren = children?.filter((child) => {
    const childName = child?.fullName ?? child?.name ?? "";
    return childName.toLowerCase().includes(modalSearch.toLowerCase().trim());
  });

  useEffect(() => {
    if (selectedChildId) {
      fetchProgramsForSelectedChild(selectedChildId);
      fetchChildStats(selectedChildId);
    }
  }, [selectedChildId]);

  const fetchChildStats = async (childId) => {
    try {
      setLoadingStats(true);
      const response = await getChildStatsApi(childId);
      if (response?.success) {
        setSessionStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching child stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const formatNextSession = (session) => {
    if (!session) return "No upcoming session";

    const dateObj = new Date(session.date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    let timeString = session.startTime;
    if (timeString && timeString.includes(":")) {
      const [hours, minutes] = timeString.split(":");
      const dateForTime = new Date();
      dateForTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));

      timeString = dateForTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    return `${formattedDate}, ${timeString}`;
  };

  return (
    <View style={[styles.mainContainer, commonStyles.container]}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by child name..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            scrollEnabled={false}
            multiline={false}
            numberOfLines={1}
          />
        </View>

        <View style={styles.casesHeader}>
          <Text style={styles.casesTitle}>Active Cases ({children.length})</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setModalVisible(true)}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loadingChildren
          ? <ActivityIndicator size="small" color="#004E9F" style={{ marginBottom: hp(20) }} />
          : filteredChildren.length > 0
          ? (
            <View style={styles.chipsGrid}>
              {filteredChildren.slice(0, 4).map((child) => {
                const childId = child._id || child.id;
                const isSelected = childId === selectedChildId;
                return (
                  <TouchableOpacity
                    key={childId}
                    style={[
                      styles.childChip,
                      { width: chipWidth },
                      isSelected
                        ? styles.chipSelected
                        : styles.chipUnselected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedChildId(childId)}
                  >
                    <Text style={styles.chipText}>
                      {child.fullName || child.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
          : (
            <View style={styles.noUserContainer}>
              <Text style={styles.noUserText}>No child found</Text>
            </View>
          )}

        <View style={styles.profileCard}>
          <View style={styles.childAvatarWrapper}>
            {activeChild?.avatar
              ? (
                <Image
                  source={{ uri: activeChild.avatar }}
                  style={styles.childAvatar}
                />
              )
              : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(activeChild?.fullName || activeChild?.name || "C")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
          </View>

          <Text style={styles.childName}>
            {activeChild?.fullName || activeChild?.name || "Selected Child"}
          </Text>

          <View style={styles.badgesRow}>
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeText}>Age {activeChild?.age || "-"}</Text>
            </View>
            <View style={styles.therapistBadge}>
              <Text style={styles.therapistBadgeText}>Therapist : {user?.fullName || user?.name || "Dr Sarah"}</Text>
            </View>
          </View>

          <View style={styles.sessionBox}>
            {loadingStats
              ? (
                <ActivityIndicator
                  size="small"
                  color="#004E9F"
                  style={{ flex: 1 }}
                />
              )
              : (
                <>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionLabel}>
                      Next Session
                    </Text>

                    <Text style={styles.sessionValue}>
                      {formatNextSession(sessionStats.nextSession)}
                    </Text>
                  </View>

                  <View style={styles.sessionRight}>
                    <Text style={styles.sessionLabel}>
                      Attendance
                    </Text>

                    <Text style={styles.attendanceValue}>
                      {sessionStats.attendancePercentage}%
                    </Text>
                  </View>
                </>
              )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Ionicons name="trophy-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionCardTitle}>Goals & Milestones</Text>
          </View>

          {loadingPrograms
            ? <ActivityIndicator size="small" color="#004E9F" style={{ marginVertical: 20 }} />
            : programs.length === 0
            ? <Text style={styles.emptyText}>No programs or goals assigned to this child yet.</Text>
            : (
              programs.map((program) => {
                const programId = program._id || program.id;
                const goalsList = program.programGoals || program.goals || [];

                return goalsList.map((goal) => {
                  const goalId = goal._id || goal.id;
                  const uniqueKey = `${programId}_${goalId}`;
                  const currentProgress = goal.progress || 0;
                  const isEditingSlider = activeSliderGoalId === uniqueKey;
                  const currentSliderVal = sliderValues[uniqueKey] ?? currentProgress;
                  const displayedProgress = isEditingSlider ? currentSliderVal : currentProgress;

                  return (
                    <View key={uniqueKey} style={styles.goalItemCard}>
                      <View style={styles.goalTitleRow}>
                        <Text style={styles.goalTitle}>{goal.title || "Goal Title"}</Text>
                        <View style={styles.progressBadge}>
                          <Text style={styles.progressBadgeText}>
                            {Math.round(displayedProgress)}%
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.goalSubtext}>
                        {program.programName ? `Program: ${program.programName}` : "General Goal"}
                      </Text>

                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${displayedProgress}%`,
                              backgroundColor: displayedProgress > 50 ? "#8BF6D9" : "#0284C7",
                            },
                          ]}
                        />

                        {/* Slider appears strictly during edit mode */}
                        {isEditingSlider && (
                          <Slider
                            style={styles.inlineSlider}
                            minimumValue={0}
                            maximumValue={100}
                            step={1}
                            value={displayedProgress}
                            minimumTrackTintColor="transparent"
                            maximumTrackTintColor="transparent"
                            thumbTintColor="#004E9F"
                            onValueChange={(val) => {
                              setSliderValues((prev) => ({ ...prev, [uniqueKey]: val }));
                            }}
                          />
                        )}
                      </View>

                      {/* Dynamic Controls */}
                      {isEditingSlider
                        ? (
                          <View style={styles.sliderActionsRow}>
                            <TouchableOpacity
                              style={styles.cancelSliderBtn}
                              onPress={() => setActiveSliderGoalId(null)}
                            >
                              <Text style={styles.cancelSliderText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.saveSliderBtn}
                              onPress={() => handleSaveProgress(programId, goalId, uniqueKey)}
                              disabled={savingGoalId === uniqueKey}
                            >
                              {savingGoalId === uniqueKey
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Text style={styles.saveSliderText}>Save Progress</Text>}
                            </TouchableOpacity>
                          </View>
                        )
                        : (
                          <TouchableOpacity
                            style={styles.addProgressBtn}
                            activeOpacity={0.8}
                            onPress={() => handleOpenSlider(uniqueKey, currentProgress)}
                          >
                            <Text style={styles.addProgressBtnText}>EDIT PROGRESS</Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  );
                });
              })
            )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Child</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSearchContainer}>
                  <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search child..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={true}>
                  {filteredModalChildren.map((child) => {
                    const childId = child._id || child.id;
                    const isSelected = childId === selectedChildId;
                    return (
                      <TouchableOpacity
                        key={childId}
                        style={[
                          styles.modalOption,
                          isSelected && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedChildId(childId);
                          setModalVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            isSelected && styles.modalOptionTextSelected,
                          ]}
                        >
                          {child.fullName || child.name}
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
    </View>
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
    paddingHorizontal: wp(20),
    paddingTop: hp(8),
    paddingBottom: hp(20),
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4FA",
    borderRadius: wp(999),
    paddingHorizontal: wp(16),
    paddingVertical: hp(8),
    marginBottom: hp(20),
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#0F172A",
    height: hp(48),
    paddingVertical: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  casesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(14),
  },
  casesTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#414753",
    lineHeight: 24,
  },
  viewAllText: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#004E9F",
    lineHeight: 24,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: wp(12),
    columnGap: wp(12),
    marginBottom: hp(20),
  },
  childChip: {
    borderRadius: wp(32),
    paddingVertical: hp(14),
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: "#8BF6D9",
  },
  chipUnselected: {
    backgroundColor: "#F1F4FA",
    borderWidth: 1,
    borderColor: "#D7E3FF",
  },
  chipText: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#004E9F",
  },
  noUserContainer: {
    padding: wp(16),
    alignItems: "center",
  },
  noUserText: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(37),
    padding: wp(20),
    alignItems: "center",
    marginBottom: hp(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  childAvatarWrapper: {
    backgroundColor: "#FFFFFF",
    width: wp(128),
    height: hp(128),
    borderRadius: wp(24),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  childAvatar: {
    width: wp(120),
    height: hp(120),
    borderRadius: wp(24),
  },
  avatarFallback: {
    width: wp(120),
    height: hp(120),
    borderRadius: wp(24),
    backgroundColor: "#004E9F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: fontSize(48),
    fontFamily: fonts.bold || "System",
    color: "#FFFFFF",
  },
  childName: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
    marginBottom: hp(8),
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: hp(20),
  },
  ageBadge: {
    backgroundColor: "rgba(22,105,169,.1)",
    paddingHorizontal: wp(12),
    paddingVertical: hp(2),
    borderRadius: wp(999),
  },
  ageBadgeText: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#005086",
    lineHeight: 18,
  },
  therapistBadge: {
    backgroundColor: "rgba(255,183,129,.2)",
    paddingHorizontal: wp(12),
    paddingVertical: hp(2),
    borderRadius: wp(999),
  },
  therapistBadgeText: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#7A3E00",
    lineHeight: 18,
  },

  sessionBox: {
    width: "100%",
    backgroundColor: "#F1F4FA",
    borderRadius: wp(18),
    padding: wp(12),
    flexDirection: "row",
    gap: wp(8),
  },

  sessionLeft: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },

  sessionRight: {
    flexShrink: 0,
    alignItems: "flex-end",
  },

  sessionLabel: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
    marginBottom: hp(5),
  },

  sessionValue: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#181C21",
    lineHeight: 20,
    flexShrink: 1,
    flexWrap: "wrap",
  },

  attendanceValue: {
    fontSize: fontSize(14),
    fontFamily: fonts.bold,
    color: "#004E9F",
    lineHeight: 20,
  },

  attendanceValue: {
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: "#004E9F",
    lineHeight: 24,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(24),
    padding: wp(20),
    marginBottom: hp(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp(16),
  },
  sectionCardTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 24,
  },
  emptyText: {
    color: "#94A3B8",
    textAlign: "center",
    marginVertical: 12,
    fontFamily: fonts.regular,
  },
  goalItemCard: {
    borderWidth: 1,
    borderColor: "#EBEEF1",
    borderRadius: wp(24),
    padding: wp(16),
    marginBottom: hp(12),
  },
  goalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(4),
  },
  goalTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
  },
  progressBadge: {
    paddingHorizontal: wp(8),
    paddingVertical: hp(2),
    borderRadius: wp(4),
    backgroundColor: "#8BF6D9",
  },
  progressBadgeText: {
    fontSize: fontSize(10),
    fontFamily: fonts.bold,
    color: "#00725E",
    lineHeight: 24,
  },
  goalSubtext: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#C1C7D2",
    lineHeight: 16,
    marginBottom: hp(10),
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#EBEEF1",
    borderRadius: wp(999),
    marginBottom: hp(12),
    position: "relative",
    justifyContent: "center",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: wp(999),
    position: "absolute",
    left: 0,
    top: 0,
  },
  inlineSlider: {
    width: "100%",
    height: hp(40),
    position: "absolute",
    alignSelf: "center",
  },
  addProgressBtn: {
    backgroundColor: "#E5E8EB",
    alignSelf: "flex-start",
    paddingHorizontal: wp(8),
    paddingVertical: hp(2),
    borderRadius: wp(4),
  },
  addProgressBtnText: {
    fontSize: fontSize(10),
    fontFamily: fonts.bold,
    color: "#717781",
    lineHeight: 18,
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cancelSliderBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: hp(8),
    borderRadius: wp(8),
    alignItems: "center",
  },
  cancelSliderText: {
    color: "#475569",
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    lineHeight: 16,
  },
  saveSliderBtn: {
    flex: 1,
    backgroundColor: "#00725E",
    paddingVertical: hp(8),
    borderRadius: wp(8),
    alignItems: "center",
  },
  saveSliderText: {
    color: "#FFFFFF",
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp(20),
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(16),
    padding: wp(16),
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(12),
  },
  modalTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 22,
  },
  modalSearchContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: wp(8),
    height: hp(43),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(10),
    marginBottom: hp(12),
  },
  modalSearchInput: {
    flex: 1,
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: hp(10),
    paddingHorizontal: wp(10),
    borderRadius: wp(8),
  },
  modalOptionSelected: {
    backgroundColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  modalOptionTextSelected: {
    fontFamily: fonts.bold,
    color: "#0B598F",
    lineHeight: 20,
  },
});
