import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
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
import Ionicons from '@expo/vector-icons/Ionicons';

import { AssignTheraistChild } from '../../api/admin/api';
import {
  addGoalToProgramApi,
  AddPrograms,
  deleteGoalApi,
  deleteProgramApi,
  getChildPrograms,
} from '../../api/therapist/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { therapistSpecialities } from '../../utils/specialities';

export default function ProgramBuilderScreen({ navigation }) {
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [programModalVisible, setProgramModalVisible] = useState(false);
  const [goalInputText, setGoalInputText] = useState({});
  const [activeGoalInputProgramId, setActiveGoalInputProgramId] = useState(null);

  const getAssignmentId = (item) =>
    `${item.childId}-${item.therapistId}`;

  const selectedAssignment = useMemo(
    () =>
      children.find(
        (item) =>
          getAssignmentId(item) === selectedAssignmentId,
      ) || null,
    [children, selectedAssignmentId],
  );

  const selectedChildId = selectedAssignment?.childId || null;
  const selectedTherapistId = selectedAssignment?.therapistId || null;

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId && selectedTherapistId) {
      fetchProgramsForChild(
        selectedChildId,
        selectedTherapistId,
      );
    } else {
      setPrograms([]);
    }
  }, [selectedChildId, selectedTherapistId]);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);

      const responseData = await AssignTheraistChild();
      const fetchedUsers = responseData?.data || [];

      setChildren(fetchedUsers);

      if (fetchedUsers.length === 0) {
        setSelectedAssignmentId(null);
        return;
      }

      const selectedStillExists = fetchedUsers.some(
        (item) =>
          getAssignmentId(item) === selectedAssignmentId,
      );

      if (!selectedStillExists) {
        setSelectedAssignmentId(
          getAssignmentId(fetchedUsers[0]),
        );
      }
    } catch (error) {
      console.error(
        "Error fetching children:",
        error?.response?.data || error.message,
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchProgramsForChild = async (
    childId,
    therapistId,
  ) => {
    if (!childId || !therapistId) {
      setPrograms([]);
      return;
    }

    try {
      setLoadingPrograms(true);

      const response = await getChildPrograms(
        childId,
        therapistId,
      );

      if (response?.success) {
        setPrograms(response.data || []);
      } else {
        setPrograms([]);
      }
    } catch (error) {
      console.error(
        "Error fetching child programs:",
        error?.response?.data || error.message,
      );
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      const responseData = await AssignTheraistChild();
      const fetchedUsers = responseData?.data || [];

      setChildren(fetchedUsers);

      let assignment = fetchedUsers.find(
        (item) =>
          getAssignmentId(item) === selectedAssignmentId,
      );

      if (!assignment && fetchedUsers.length > 0) {
        assignment = fetchedUsers[0];
        setSelectedAssignmentId(
          getAssignmentId(assignment),
        );
      }

      if (assignment) {
        await fetchProgramsForChild(
          assignment.childId,
          assignment.therapistId,
        );
      } else {
        setPrograms([]);
        setSelectedAssignmentId(null);
      }
    } catch (error) {
      console.error(
        "Error on refreshing:",
        error?.response?.data || error.message,
      );
    } finally {
      setRefreshing(false);
    }
  }, [selectedAssignmentId]);

  const handleSelectAssignment = (item) => {
    setSelectedAssignmentId(
      getAssignmentId(item),
    );
  };

  const handleAddProgram = async (department) => {
    if (!selectedAssignment) {
      Alert.alert(
        "Error",
        "Please select a child and therapist.",
      );
      return;
    }

    try {
      const payload = {
        therapistId: selectedAssignment.therapistId,
        childId: selectedAssignment.childId,
        programName:
          department.title
          || department.label
          || "Untitled Program",
        description: "describe behavior, engagement,",
        goals: [],
      };

      const response = await AddPrograms(payload);

      if (response?.success) {
        if (response.program) {
          setPrograms((prev) => [
            response.program,
            ...prev,
          ]);
        } else {
          await fetchProgramsForChild(
            selectedAssignment.childId,
            selectedAssignment.therapistId,
          );
        }

        setProgramModalVisible(false);
      }
    } catch (error) {
      console.error(
        "Failed to add program:",
        error?.response?.data || error.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
        || "Failed to add program.",
      );
    }
  };

  const handleDeleteProgram = (program) => {
    const programId = program._id || program.id;
    const programName =
      program.programName
      || program.title
      || "this program";

    Alert.alert(
      "Are you sure?",
      `Do you really want to delete "${programName}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteProgramApi(
                programId,
              );

              if (res?.success) {
                setPrograms((prev) =>
                  prev.filter(
                    (item) =>
                      (item._id || item.id) !== programId,
                  ),
                );
              }
            } catch (error) {
              console.error(
                "Failed to delete program:",
                error?.response?.data || error.message,
              );
            }
          },
        },
      ],
    );
  };

  const handleDeleteGoal = async (
    programId,
    goalId,
  ) => {
    try {
      const response = await deleteGoalApi(
        programId,
        goalId,
      );

      if (response?.success) {
        setPrograms((prev) =>
          prev.map((program) => {
            const currentProgramId =
              program._id || program.id;

            if (currentProgramId !== programId) {
              return program;
            }

            return {
              ...program,
              programGoals: (
                program.programGoals
                || program.goals
                || []
              ).filter(
                (goal) =>
                  (goal._id || goal.id) !== goalId,
              ),
            };
          }),
        );
      }
    } catch (error) {
      console.error(
        "Failed to delete goal:",
        error?.response?.data || error.message,
      );
    }
  };

  const handleGoalInputChange = (
    programId,
    text,
  ) => {
    setGoalInputText((prev) => ({
      ...prev,
      [programId]: text,
    }));
  };

  const handleSaveGoal = async (programId) => {
    const text =
      goalInputText[programId]?.trim();

    if (!text) {
      return;
    }

    try {
      const response =
        await addGoalToProgramApi(
          programId,
          text,
        );

      if (
        response?.success
        && response?.program
      ) {
        setPrograms((prev) =>
          prev.map((program) => {
            const currentProgramId =
              program._id || program.id;

            return currentProgramId === programId
              ? response.program
              : program;
          }),
        );

        setGoalInputText((prev) => ({
          ...prev,
          [programId]: "",
        }));

        setActiveGoalInputProgramId(null);
      }
    } catch (error) {
      console.error(
        "Failed to save goal:",
        error?.response?.data || error.message,
      );
    }
  };

  const filteredModalChildren = children.filter(
    (item) => {
      const search =
        modalSearch.toLowerCase().trim();

      if (!search) {
        return true;
      }

      return (
        item.childName
          ?.toLowerCase()
          .includes(search)
        || item.therapistName
          ?.toLowerCase()
          .includes(search)
        || item.combinedName
          ?.toLowerCase()
          .includes(search)
        || item.specialty
          ?.toLowerCase()
          .includes(search)
      );
    },
  );

  const filteredPrograms = programs.filter(
    (program) => {
      const title =
        program?.programName
        ?? program?.title
        ?? "";

      return title
        .toLowerCase()
        .includes(
          searchQuery
            .toLowerCase()
            .trim(),
        );
    },
  );

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Program Builder"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#004E9F"]}
            tintColor="#004E9F"
          />
        }
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>
            Program Builder
          </Text>

          <Text style={styles.bannerSubtitle}>
            Managing Therapist Program add child program
          </Text>
        </View>

        <View style={styles.childHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            Select Child - Therapist
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              setModalVisible(true)}
          >
            <Text style={styles.viewAllText}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {loadingChildren
          ? (
            <ActivityIndicator
              size="small"
              color="#004E9F"
              style={{
                marginBottom: 20,
              }}
            />
          )
          : children.length > 0
          ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.childChipsRow
              }
            >
              {children.map((item) => {
                const uniqueId =
                  getAssignmentId(item);

                const isSelected =
                  uniqueId
                  === selectedAssignmentId;

                return (
                  <TouchableOpacity
                    key={uniqueId}
                    style={[
                      styles.childChip,
                      isSelected
                        ? styles.childChipSelected
                        : styles.childChipUnselected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      handleSelectAssignment(
                        item,
                      )}
                  >
                    <Text
                      style={[
                        styles.childChipText,
                        isSelected
                          ? styles.childChipTextSelected
                          : styles.childChipTextUnselected,
                      ]}
                    >
                      {item.combinedName
                        || `${item.childName} - ${item.therapistName}`}
                    </Text>

                    {!!item.specialty && (
                      <Text
                        style={
                          styles.childSpecialty
                        }
                      >
                        {item.specialty
                          .replace(
                            /_/g,
                            " ",
                          )}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )
          : (
            <View style={styles.childChipsRow}>
              <Text style={styles.emptyText}>
                No user found
              </Text>
            </View>
          )}

        {selectedAssignment && (
          <View style={styles.selectedInfoCard}>
            <View style={styles.selectedInfoRow}>
              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Child
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.childName}
                </Text>
              </View>

              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Therapist
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.therapistName}
                </Text>
              </View>
            </View>

            <View style={styles.selectedInfoRow}>
              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Specialty
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.specialty
                    ?.replace(/_/g, " ")
                    || "-"}
                </Text>
              </View>

              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Assigned Children
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.assignedChildren
                    || 0}
                  /
                  {selectedAssignment.maxChildren
                    || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.searchCard}>
          <View
            style={
              styles.searchInputContainer
            }
          >
            <Feather
              name="search"
              size={18}
              color="#94A3B8"
              style={styles.searchIcon}
            />

            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.allLabelsBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.allLabelsText}>
                All Labels
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addProgramBtn}
              activeOpacity={0.8}
              disabled={!selectedAssignment}
              onPress={() =>
                setProgramModalVisible(true)}
            >
              <Text style={styles.addProgramText}>
                Add program
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.allProgramTitle}>
          All Programs
        </Text>

        <View style={styles.programList}>
          {loadingPrograms
            ? (
              <ActivityIndicator
                size="small"
                color="#004E9F"
                style={{
                  marginTop: 20,
                }}
              />
            )
            : filteredPrograms.length === 0
            ? (
              <Text style={styles.emptyText}>
                No programs added yet. Click "Add program" above.
              </Text>
            )
            : filteredPrograms.map(
              (program) => {
                const programId =
                  program._id
                  || program.id;

                const programGoalsList =
                  program.programGoals
                  || program.goals
                  || [];

                return (
                  <View
                    key={String(programId)}
                    style={styles.programCard}
                  >
                    <View
                      style={
                        styles.programHeaderRow
                      }
                    >
                      <Text style={styles.cardTitle}>
                        {program.programName
                          || program.title}
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                          handleDeleteProgram(
                            program,
                          )}
                      >
                        <Feather
                          name="trash-2"
                          size={20}
                          color="#BA1A1A"
                        />
                      </TouchableOpacity>
                    </View>

                    <Text
                      style={
                        styles.cardDescription
                      }
                    >
                      {program.description}
                    </Text>

                    <Text style={styles.cardTitle}>
                      {program.therapistTitle
                        || selectedAssignment
                          ?.therapistName
                        || "Therapist"}
                    </Text>

                    <Text
                      style={
                        styles.cardDescription
                      }
                    >
                      {program.therapistDescription
                        || "describe behavior, engagement,"}
                    </Text>

                    {programGoalsList.map(
                      (goal, goalIndex) => {
                        const goalId =
                          goal._id
                          || goal.id
                          || `${programId}-${goalIndex}`;

                        return (
                          <View
                            key={String(goalId)}
                            style={styles.goalBox}
                          >
                            <View
                              style={
                                styles.goalLeftRow
                              }
                            >
                              <View
                                style={
                                  styles.radioCircle
                                }
                              />

                              <Text
                                style={
                                  styles.goalTitle
                                }
                              >
                                {goal.title}
                              </Text>
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() =>
                                handleDeleteGoal(
                                  programId,
                                  goal._id
                                  || goal.id,
                                )}
                            >
                              <Feather
                                name="trash-2"
                                size={18}
                                color="#BA1A1A"
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      },
                    )}

                    {activeGoalInputProgramId
                      === programId && (
                      <View
                        style={
                          styles.goalInputRow
                        }
                      >
                        <TextInput
                          style={
                            styles.goalTextInput
                          }
                          placeholder="Enter goal title..."
                          placeholderTextColor="#94A3B8"
                          value={
                            goalInputText[
                              programId
                            ] || ""
                          }
                          onChangeText={(text) =>
                            handleGoalInputChange(
                              programId,
                              text,
                            )}
                          autoFocus
                        />

                        <TouchableOpacity
                          style={
                            styles.saveGoalBtn
                          }
                          onPress={() =>
                            handleSaveGoal(
                              programId,
                            )}
                        >
                          <Text
                            style={
                              styles.saveGoalBtnText
                            }
                          >
                            Add
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.addGoalBtn}
                      activeOpacity={0.8}
                      onPress={() =>
                        setActiveGoalInputProgramId(
                          programId,
                        )}
                    >
                      <Feather
                        name="plus-circle"
                        size={18}
                        color="#8BF6D9"
                      />

                      <Text
                        style={
                          styles.addGoalBtnText
                        }
                      >
                        Add Another Goal
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              },
            )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select Child - Therapist
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setModalVisible(false)}
                  >
                    <Feather
                      name="x"
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={
                    styles.modalSearchContainer
                  }
                >
                  <Feather
                    name="search"
                    size={16}
                    color="#94A3B8"
                    style={{
                      marginRight: 8,
                    }}
                  />

                  <TextInput
                    style={
                      styles.modalSearchInput
                    }
                    placeholder="Search child or therapist..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                <ScrollView
                  style={{
                    maxHeight: 300,
                  }}
                  showsVerticalScrollIndicator
                >
                  {filteredModalChildren.map(
                    (item) => {
                      const uniqueId =
                        getAssignmentId(item);

                      const isSelected =
                        uniqueId
                        === selectedAssignmentId;

                      return (
                        <TouchableOpacity
                          key={uniqueId}
                          style={[
                            styles.modalOption,
                            isSelected
                              && styles.modalOptionSelected,
                          ]}
                          onPress={() => {
                            handleSelectAssignment(
                              item,
                            );
                            setModalVisible(
                              false,
                            );
                          }}
                        >
                          <View
                            style={
                              styles.modalOptionInfo
                            }
                          >
                            <Text
                              style={[
                                styles.modalOptionText,
                                isSelected
                                  && styles.modalOptionTextSelected,
                              ]}
                            >
                              {item.combinedName
                                || `${item.childName} - ${item.therapistName}`}
                            </Text>

                            {!!item.specialty && (
                              <Text
                                style={
                                  styles.modalOptionSubtext
                                }
                              >
                                {item.specialty
                                  .replace(
                                    /_/g,
                                    " ",
                                  )}
                              </Text>
                            )}
                          </View>

                          {isSelected && (
                            <Feather
                              name="check"
                              size={18}
                              color="#0B598F"
                            />
                          )}
                        </TouchableOpacity>
                      );
                    },
                  )}

                  {filteredModalChildren.length
                    === 0 && (
                    <Text style={styles.emptyText}>
                      No user found
                    </Text>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={programModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setProgramModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setProgramModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select Department
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setProgramModalVisible(
                        false,
                      )}
                  >
                    <Feather
                      name="x"
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{
                    maxHeight: 260,
                  }}
                  showsVerticalScrollIndicator
                >
                  {therapistSpecialities.map(
                    (department) => (
                      <TouchableOpacity
                        key={department.id}
                        style={
                          styles.modalOption
                        }
                        onPress={() =>
                          handleAddProgram(
                            department,
                          )}
                      >
                        <Text
                          style={
                            styles.modalOptionText
                          }
                        >
                          {department.label}
                        </Text>

                        <Feather
                          name="plus"
                          size={18}
                          color="#00725E"
                        />
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BottomBar />
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
    paddingBottom: 20,
  },
  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.white,
    lineHeight: 24,
  },
  bannerSubtitle: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.white,
    lineHeight: 22,
  },
  childHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.blackFont,
    lineHeight: 24,
  },
  viewAllText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#004E9F",
    lineHeight: 24,
  },
  childChipsRow: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  childChip: {
    minHeight: 50,
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  childChipSelected: {
    backgroundColor: "#8BF6D9",
  },
  childChipUnselected: {
    backgroundColor: "#F1F4FA",
    borderWidth: 1,
    borderColor: "#D7E3FF",
  },
  childChipText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    lineHeight: 20,
    color: "#004E9F",
  },
  childChipTextSelected: {
    color: "#004E9F",
  },
  childChipTextUnselected: {
    color: "#004E9F",
  },
  childSpecialty: {
    marginTop: 1,
    fontSize: 9,
    fontFamily: fonts.regular,
    color: "#64748B",
    textTransform: "capitalize",
  },
  selectedInfoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  selectedInfoRow: {
    flexDirection: "row",
    gap: 12,
  },
  selectedInfoBox: {
    flex: 1,
  },
  selectedInfoLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginBottom: 3,
  },
  selectedInfoValue: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#0F172A",
    textTransform: "capitalize",
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInputContainer: {
    backgroundColor: "#F7FAFD",
    borderRadius: 10,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  allLabelsBtn: {
    flex: 1,
    backgroundColor: "#F58B2A",
    height: 44,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  allLabelsText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  addProgramBtn: {
    flex: 1,
    backgroundColor: "#00725E",
    height: 44,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addProgramText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#8BF6D9",
    lineHeight: 20,
  },
  allProgramTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    lineHeight: 26,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    fontFamily: fonts.regular,
    marginTop: 10,
  },
  programList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  programCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#94A2B6",
  },
  programHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    lineHeight: 24,
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 5,
  },
  goalBox: {
    backgroundColor: "rgba(139,246,217,.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  goalLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#717781",
  },
  goalTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#006B58",
    lineHeight: 18,
  },
  goalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  goalTextInput: {
    flex: 1,
    height: 42,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  saveGoalBtn: {
    backgroundColor: "#006B58",
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveGoalBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  addGoalBtn: {
    backgroundColor: "#006B58",
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addGoalBtnText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: "#8BF6D9",
    lineHeight: 24,
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
  modalOptionInfo: {
    flex: 1,
    paddingRight: 10,
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
  },
  modalOptionSubtext: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#64748B",
    textTransform: "capitalize",
  },
});