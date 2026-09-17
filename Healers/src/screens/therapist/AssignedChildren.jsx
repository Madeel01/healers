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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';

import {
  getChildPrograms,
  therapistUsers,
  updateGoalProgressApi,
} from '../../api/therapist/api';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function AssignedChildrenScreen({ navigation }) {
  const { user } = useContext(AuthContext);
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

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <TopBar navigation={navigation} headerTitle={"Assigned Children"} />

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
          />
        </View>

        <View style={styles.casesHeader}>
          <Text style={styles.casesTitle}>Active Cases ({children.length})</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setModalVisible(true)}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loadingChildren
          ? <ActivityIndicator size="small" color="#004E9F" style={{ marginBottom: 20 }} />
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
                      isSelected ? styles.chipSelected : styles.chipUnselected,
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
              <Text style={styles.ageBadgeText}>Age {activeChild?.age || "8"}</Text>
            </View>
            <View style={styles.therapistBadge}>
              <Text style={styles.therapistBadgeText}>Therapist : {user?.fullName || user?.name || "Dr Sarah"}</Text>
            </View>
          </View>

          <View style={styles.sessionBox}>
            <View>
              <Text style={styles.sessionLabel}>Next Session</Text>
              <Text style={styles.sessionValue}>Today, 09:00 AM</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.sessionLabel}>Attendance</Text>
              <Text style={styles.attendanceValue}>90%</Text>
            </View>
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

                      {/* Progress Bar Container */}
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

      <TherapistBottomBar activeTab="AssignedChildren" />

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
    paddingTop: 8,
    paddingBottom: 20,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4FA",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#0F172A",
    height: 45,
  },
  casesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  casesTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#414753",
    lineHeight: 24,
  },
  viewAllText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#004E9F",
    lineHeight: 24,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 20,
  },
  childChip: {
    width: "48%",
    borderRadius: 32,
    paddingVertical: 16,
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
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#004E9F",
  },
  noUserContainer: {
    padding: 16,
    alignItems: "center",
  },
  noUserText: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 37,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  childAvatarWrapper: {
    backgroundColor: "#FFFFFF",
    width: 128,
    height: 128,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  childAvatar: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: "#004E9F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 48,
    fontFamily: fonts.bold || "System",
    color: "#FFFFFF",
  },
  childName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  ageBadge: {
    backgroundColor: "rgba(22,105,169,.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ageBadgeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#005086",
    lineHeight: 24,
  },
  therapistBadge: {
    backgroundColor: "rgba(255,183,129,.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  therapistBadgeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#7A3E00",
    lineHeight: 24,
  },
  sessionBox: {
    width: "100%",
    backgroundColor: "#F1F4FA",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 24,
    marginBottom: 2,
  },
  sessionValue: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C21",
    lineHeight: 24,
  },
  attendanceValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#004E9F",
    lineHeight: 24,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionCardTitle: {
    fontSize: 16,
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
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  goalTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#8BF6D9",
  },
  progressBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#00725E",
    lineHeight: 24,
  },
  goalSubtext: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#C1C7D2",
    lineHeight: 16,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#EBEEF1",
    borderRadius: 999,
    marginBottom: 12,
    position: "relative",
    justifyContent: "center",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    position: "absolute",
    left: 0,
    top: 0,
  },
  inlineSlider: {
    width: "100%",
    height: 40,
    position: "absolute",
    alignSelf: "center",
  },
  addProgressBtn: {
    backgroundColor: "#E5E8EB",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addProgressBtnText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#717781",
    lineHeight: 24,
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
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelSliderText: {
    color: "#475569",
    fontSize: 13,
    fontFamily: fonts.medium || "System",
  },
  saveSliderBtn: {
    flex: 1,
    backgroundColor: "#00725E",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  saveSliderText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: fonts.bold || "System",
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
    padding: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 22,
  },
  modalSearchContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    height: 43,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
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
    color: "#0B598F",
    lineHeight: 20,
  },
});
