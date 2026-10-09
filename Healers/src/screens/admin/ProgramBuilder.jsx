import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

import {
  getProgramTherapistChildrenApi,
  getProgramTherapistsApi,
  getServices,
} from '../../api/admin/api';
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

const PAGE_SIZE = 5;

const mergeUnique = (previous, incoming, idKey) => {
  const seen = new Set(previous.map((item) => String(item[idKey])));

  return [
    ...previous,
    ...incoming.filter((item) => {
      const id = String(item[idKey]);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
};

export default function ProgramBuilderScreen({ navigation }) {
  const [therapists, setTherapists] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const [therapistSearch, setTherapistSearch] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [therapistPage, setTherapistPage] = useState(1);
  const [childPage, setChildPage] = useState(1);
  const [therapistHasMore, setTherapistHasMore] = useState(false);
  const [childHasMore, setChildHasMore] = useState(false);
  const [loadingTherapists, setLoadingTherapists] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [services, setServices] = useState([]);
  const [programModalVisible, setProgramModalVisible] = useState(false);
  const [goalInputText, setGoalInputText] = useState({});
  const [activeGoalInputProgramId, setActiveGoalInputProgramId] = useState(null);
  const [savingProgram, setSavingProgram] = useState(false);
  const [savingGoalId, setSavingGoalId] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const therapistRequestRef = useRef(0);
  const childRequestRef = useRef(0);
  const programRequestRef = useRef(0);
  const therapistBusyRef = useRef(false);
  const childBusyRef = useRef(false);
  const selectedTherapistId = selectedTherapist?.therapistId || null;
  const selectedChildId = selectedChild?.childId || null;

  const selectedAssignment = useMemo(() => (
    selectedTherapistId && selectedChildId
      ? {
        therapistId: selectedTherapistId,
        therapistName: selectedTherapist.fullName,
        childId: selectedChildId,
        childName: selectedChild.fullName,
      }
      : null
  ), [selectedTherapist, selectedChild, selectedTherapistId, selectedChildId]);

  const fetchTherapists = useCallback(async (page, search, replace = false) => {
    if (!replace && therapistBusyRef.current) return;
    const requestId = replace ? ++therapistRequestRef.current : therapistRequestRef.current;
    therapistBusyRef.current = true;
    setLoadingTherapists(true);

    try {
      const response = await getProgramTherapistsApi({ page, limit: PAGE_SIZE, search });
      if (requestId !== therapistRequestRef.current) return;
      const next = response?.data || [];
      setTherapists((prev) => replace ? next : mergeUnique(prev, next, "therapistId"));
      setTherapistPage(page);
      setTherapistHasMore(Boolean(response?.hasMore));
      if (replace) {
        setSelectedTherapist((previous) => {
          if (!previous) return null;
          return next.find((item) => item.therapistId === previous.therapistId) || previous;
        });
      }
    } catch (error) {
      if (requestId === therapistRequestRef.current) {
        console.error("Fetch therapists:", error?.response?.data || error.message);
        if (replace) setTherapists([]);
      }
    } finally {
      if (requestId === therapistRequestRef.current) {
        therapistBusyRef.current = false;
        setLoadingTherapists(false);
      }
    }
  }, []);

  const fetchChildren = useCallback(async (therapistId, page, search, replace = false) => {
    if (!therapistId || (!replace && childBusyRef.current)) return;
    const requestId = replace ? ++childRequestRef.current : childRequestRef.current;
    childBusyRef.current = true;
    setLoadingChildren(true);

    try {
      const response = await getProgramTherapistChildrenApi({
        therapistId,
        page,
        limit: PAGE_SIZE,
        search,
      });

      if (requestId !== childRequestRef.current) return;
      const next = response?.data || [];
      setChildren((prev) => replace ? next : mergeUnique(prev, next, "childId"));
      setChildPage(page);
      setChildHasMore(Boolean(response?.hasMore));
    } catch (error) {
      if (requestId === childRequestRef.current) {
        console.error("Fetch children:", error?.response?.data || error.message);
        if (replace) setChildren([]);
      }
    } finally {
      if (requestId === childRequestRef.current) {
        childBusyRef.current = false;
        setLoadingChildren(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTherapists([]);
      setTherapistPage(1);
      setTherapistHasMore(false);
      therapistBusyRef.current = false;
      fetchTherapists(1, therapistSearch.trim(), true);
    }, 350);

    return () => {
      clearTimeout(timer);
      ++therapistRequestRef.current;
    };
  }, [therapistSearch, refreshVersion, fetchTherapists]);

  useEffect(() => {
    ++childRequestRef.current;
    childBusyRef.current = false;
    setChildren([]);
    setChildPage(1);
    setChildHasMore(false);
    if (!selectedTherapistId) {
      setLoadingChildren(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchChildren(selectedTherapistId, 1, childSearch.trim(), true);
    }, 350);

    return () => {
      clearTimeout(timer);
      ++childRequestRef.current;
    };
  }, [selectedTherapistId, childSearch, refreshVersion, fetchChildren]);

  const fetchProgramsForChild = useCallback(async (childId, therapistId) => {
    const requestId = ++programRequestRef.current;

    if (!childId || !therapistId) {
      setPrograms([]);
      setLoadingPrograms(false);
      return;
    }

    setLoadingPrograms(true);

    try {
      const response = await getChildPrograms(childId, therapistId);
      if (requestId !== programRequestRef.current) return;
      if (!response?.success) {
        setPrograms([]);
        return;
      }

      const group = (response.data || []).find(
        (item) => String(item.therapist?._id) === String(therapistId),
      );

      const childEntry = group?.children?.find(
        (item) => String(item.child?._id) === String(childId),
      );

      setPrograms(childEntry?.programs || []);
    } catch (error) {
      if (requestId === programRequestRef.current) {
        console.error("Fetch programs:", error?.response?.data || error.message);
        setPrograms([]);
      }
    } finally {
      if (requestId === programRequestRef.current) setLoadingPrograms(false);
    }
  }, []);

  useEffect(() => {
    fetchProgramsForChild(selectedChildId, selectedTherapistId);

    return () => {
      ++programRequestRef.current;
    };
  }, [selectedChildId, selectedTherapistId, refreshVersion, fetchProgramsForChild]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await getServices({ search: "" });
        if (active) setServices((response?.data || []).filter((service) => service.isActive === true));
      } catch (error) {
        console.error("Fetch services:", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const selectTherapist = (therapist) => {
    ++childRequestRef.current;
    ++programRequestRef.current;
    childBusyRef.current = false;
    setLoadingChildren(false);
    setSelectedTherapist(therapist);
    setSelectedChild(null);
    setChildSearch("");
    setChildren([]);
    setPrograms([]);
    setActiveGoalInputProgramId(null);
  };

  const selectChild = (child) => {
    ++programRequestRef.current;
    setPrograms([]);
    setSelectedChild(child);
    setActiveGoalInputProgramId(null);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      setRefreshVersion((prev) => prev + 1);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleAddProgram = async (department) => {
    if (!selectedAssignment || savingProgram) {
      if (!selectedAssignment) Alert.alert("Select Child", "Please select a therapist and child first.");
      return;
    }

    setSavingProgram(true);

    try {
      const response = await AddPrograms({
        therapistId: selectedAssignment.therapistId,
        childId: selectedAssignment.childId,
        programName: department.title || department.label || "Untitled Program",
        description: "describe behavior, engagement,",
        goals: [],
      });

      if (response?.success) {
        setProgramModalVisible(false);
        await fetchProgramsForChild(selectedAssignment.childId, selectedAssignment.therapistId);
      } else {
        Alert.alert("Error", response?.message || "Failed to add program.");
      }
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to add program.");
    } finally {
      setSavingProgram(false);
    }
  };

  const handleDeleteProgram = (program) => {
    const programId = program._id || program.id;

    Alert.alert(
      "Are you sure?",
      `Delete "${program.programName || program.title || "this program"}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },

        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await deleteProgramApi(programId);
              if (response?.success) {
                setPrograms((prev) => prev.filter((item) => String(item._id || item.id) !== String(programId)));
              } else Alert.alert("Error", response?.message || "Could not delete program.");
            } catch (error) {
              Alert.alert("Error", error?.response?.data?.message || "Could not delete program.");
            }
          },
        },
      ],
    );
  };

  const handleDeleteGoal = async (programId, goalId) => {
    try {
      const response = await deleteGoalApi(programId, goalId);

      if (response?.success) {
        setPrograms((prev) =>
          prev.map((program) =>
            String(program._id || program.id) !== String(programId) ? program : {
              ...program,

              programGoals: (program.programGoals || program.goals || []).filter(
                (goal) => String(goal._id || goal.id) !== String(goalId),
              ),
            }
          )
        );
      } else Alert.alert("Error", response?.message || "Could not delete goal.");
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Could not delete goal.");
    }
  };

  const handleSaveGoal = async (programId) => {
    const title = (goalInputText[programId] || "").trim();
    if (!title || savingGoalId) return;
    setSavingGoalId(programId);

    try {
      const response = await addGoalToProgramApi(programId, title);

      if (response?.success && response?.program) {
        setPrograms((prev) =>
          prev.map((program) => String(program._id || program.id) === String(programId) ? response.program : program)
        );
        setGoalInputText((prev) => ({ ...prev, [programId]: "" }));
        setActiveGoalInputProgramId(null);
      } else if (response?.success && selectedAssignment) {
        await fetchProgramsForChild(selectedAssignment.childId, selectedAssignment.therapistId);
        setGoalInputText((prev) => ({ ...prev, [programId]: "" }));
        setActiveGoalInputProgramId(null);
      } else Alert.alert("Error", response?.message || "Failed to save goal.");
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to save goal.");
    } finally {
      setSavingGoalId(null);
    }
  };

  const filteredPrograms = programs.filter((program) =>
    String(program.programName || program.title || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <TopBar navigation={navigation} headerTitle="Program Builder" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004E9F" />}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>Program Builder</Text>
          <Text style={styles.bannerSubtitle}>Manage therapist and child programs</Text>
        </View>

        <View style={styles.selectorSection}>
          <Text style={styles.sectionHeaderTitle}>Select Therapist</Text>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search therapist name or email..."
              placeholderTextColor="#94A3B8"
              value={therapistSearch}
              onChangeText={setTherapistSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.horizontalOptions}
          >
            {therapists.map((therapist) => {
              const active = selectedTherapistId === therapist.therapistId;

              return (
                <TouchableOpacity
                  key={therapist.therapistId}
                  style={[
                    styles.sliderChip,
                    active && styles.sliderChipSelected,
                  ]}
                  onPress={() => selectTherapist(therapist)}
                  activeOpacity={0.8}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sliderTitle,
                      active && styles.sliderTitleSelected,
                    ]}
                  >
                    {therapist.fullName}
                  </Text>
                  {active && (
                    <Feather
                      name="check-circle"
                      size={16}
                      color="#00725E"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingTherapists && <ActivityIndicator style={styles.loader} color="#004E9F" />}

          {!loadingTherapists && therapists.length === 0 && (
            <Text style={styles.emptyText}>No active therapists found.</Text>
          )}

          {!loadingTherapists && therapistHasMore && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => fetchTherapists(therapistPage + 1, therapistSearch.trim())}
            >
              <Text style={styles.loadMoreText}>Load More Therapists (+5)</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.selectorSection}>
          <Text style={styles.sectionHeaderTitle}>Select Child</Text>

          {!selectedTherapistId ? <Text style={styles.emptyText}>Select a therapist first.</Text> : (
            <>
              <Text style={styles.selectionHint}>Children assigned to {selectedTherapist.fullName}</Text>

              <View style={styles.searchInputContainer}>
                <Feather name="search" size={18} color="#94A3B8" />

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search child name or email..."
                  placeholderTextColor="#94A3B8"
                  value={childSearch}
                  onChangeText={setChildSearch}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.horizontalOptions}
              >
                {children.map((child) => {
                  const active = selectedChildId === child.childId;
                  return (
                    <TouchableOpacity
                      key={child.childId}
                      style={[styles.sliderChip, active && styles.sliderChipSelected]}
                      onPress={() => selectChild(child)}
                      activeOpacity={0.8}
                    >
                      <Text numberOfLines={2} style={[styles.sliderTitle, active && styles.sliderTitleSelected]}>
                        {child.fullName}
                      </Text>
                      {active && <Feather name="check-circle" size={16} color="#00725E" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {loadingChildren && <ActivityIndicator style={styles.loader} color="#004E9F" />}

              {!loadingChildren && children.length === 0 && (
                <Text style={styles.emptyText}>No active assigned children found.</Text>
              )}

              {!loadingChildren && childHasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => fetchChildren(selectedTherapistId, childPage + 1, childSearch.trim())}
                >
                  <Text style={styles.loadMoreText}>Load More Children (+5)</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {selectedAssignment && (
          <View style={styles.selectedInfoCard}>
            <View style={styles.selectedInfoRow}>
              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>Therapist</Text>

                <Text style={styles.selectedInfoValue}>{selectedAssignment.therapistName}</Text>
              </View>

              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>Child</Text>

                <Text style={styles.selectedInfoValue}>{selectedAssignment.childName}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.searchCard}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={18} color="#94A3B8" />

            <TextInput
              style={styles.searchInput}
              placeholder="Search programs..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.actionButtonsRow}>
            <View style={styles.allLabelsBtn}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />

              <Text style={styles.allLabelsText}>All Labels</Text>
            </View>

            <TouchableOpacity
              style={[styles.addProgramBtn, !selectedAssignment && styles.disabledButton]}
              disabled={!selectedAssignment}
              onPress={() => setProgramModalVisible(true)}
            >
              <Text style={styles.addProgramText}>Add program</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.allProgramTitle}>All Programs</Text>

        <View style={styles.programList}>
          {loadingPrograms
            ? <ActivityIndicator color="#004E9F" />
            : !selectedAssignment
            ? <Text style={styles.emptyText}>Select a therapist and child to view programs.</Text>
            : filteredPrograms.length === 0
            ? <Text style={styles.emptyText}>No programs added yet. Click "Add program" above.</Text>
            : filteredPrograms.map((program) => {
              const programId = String(program._id || program.id);

              const goals = program.programGoals || program.goals || [];

              return (
                <View key={programId} style={styles.programCard}>
                  <View style={styles.programHeaderRow}>
                    <Text style={[styles.cardTitle, { flex: 1 }]}>{program.programName || program.title}</Text>

                    <TouchableOpacity onPress={() => handleDeleteProgram(program)}>
                      <Feather name="trash-2" size={20} color="#BA1A1A" />
                    </TouchableOpacity>
                  </View>

                  {!!program.description && <Text style={styles.cardDescription}>{program.description}</Text>}

                  <Text style={styles.cardTitle}>{program.therapistTitle || selectedAssignment.therapistName}</Text>

                  {!!program.therapistDescription && (
                    <Text style={styles.cardDescription}>{program.therapistDescription}</Text>
                  )}

                  {goals.map((goal, index) => {
                    const goalId = String(goal._id || goal.id || `${programId}-${index}`);

                    return (
                      <View key={goalId} style={styles.goalBox}>
                        <View style={styles.goalLeftRow}>
                          <View style={styles.radioCircle} />

                          <Text style={styles.goalTitle}>{goal.title}</Text>
                        </View>

                        <TouchableOpacity onPress={() => handleDeleteGoal(programId, goalId)}>
                          <Feather name="trash-2" size={18} color="#BA1A1A" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {activeGoalInputProgramId === programId && (
                    <View style={styles.goalInputRow}>
                      <TextInput
                        style={styles.goalTextInput}
                        placeholder="Enter goal title..."
                        placeholderTextColor="#94A3B8"
                        value={goalInputText[programId] || ""}
                        onChangeText={(text) => setGoalInputText((prev) => ({ ...prev, [programId]: text }))}
                      />

                      <TouchableOpacity
                        style={styles.saveGoalBtn}
                        disabled={Boolean(savingGoalId)}
                        onPress={() => handleSaveGoal(programId)}
                      >
                        <Text style={styles.saveGoalBtnText}>{savingGoalId === programId ? "Saving..." : "Add"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity style={styles.addGoalBtn} onPress={() => setActiveGoalInputProgramId(programId)}>
                    <Feather name="plus-circle" size={18} color="#8BF6D9" />

                    <Text style={styles.addGoalBtnText}>Add Another Goal</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>
      </ScrollView>

      <Modal
        visible={programModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProgramModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setProgramModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Department</Text>

                  <TouchableOpacity onPress={() => setProgramModalVisible(false)}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                  {services.map((department) => (
                    <TouchableOpacity
                      key={String(department.id)}
                      style={styles.modalOption}
                      disabled={savingProgram}
                      onPress={() => handleAddProgram(department)}
                    >
                      <Text style={styles.modalOptionText}>{department.label || department.title}</Text>

                      {savingProgram
                        ? <ActivityIndicator size="small" />
                        : <Feather name="plus" size={18} color="#00725E" />}
                    </TouchableOpacity>
                  ))}

                  {services.length === 0 && <Text style={styles.emptyText}>No active departments available.</Text>}
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
  horizontalOptions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingRight: 16,
  },
  sliderChip: {
    padding: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sliderChipSelected: {
    backgroundColor: "#E6FAF4",
    borderColor: "#00725E",
  },
  sliderTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#0F172A",
    lineHeight: 24,
  },
  sliderTitleSelected: {
    color: "#006B58",
    fontFamily: fonts.bold,
  },
  sliderSubtitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  mainContainer: {
    flex: 1,
  },

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 18,
  },

  bannerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.white,
  },

  bannerSubtitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.white,
    marginTop: 5,
  },

  selectorSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.blackFont,
    marginBottom: 12,
  },

  selectionHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginBottom: 10,
  },

  searchInputContainer: {
    backgroundColor: "#F7FAFD",
    borderRadius: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#0F172A",
    paddingVertical: 8,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },

  optionSelected: {
    borderColor: "#00725E",
    backgroundColor: "#E6FAF4",
  },

  optionInfo: {
    flex: 1,
    paddingRight: 8,
  },

  optionTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#0F172A",
  },

  optionTitleSelected: {
    color: "#006B58",
    fontFamily: fonts.bold,
  },

  optionSubtitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 4,
  },

  loader: {
    marginVertical: 12,
  },

  loadMoreBtn: {
    padding: 12,
    alignItems: "center",
  },

  loadMoreText: {
    color: "#004E9F",
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },

  selectedInfoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  },

  searchCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 22,
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
  },

  addProgramBtn: {
    flex: 1,
    backgroundColor: "#00725E",
    height: 44,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.45,
  },

  addProgramText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#8BF6D9",
  },

  allProgramTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    paddingHorizontal: 20,
    marginBottom: 18,
  },

  emptyText: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
    fontFamily: fonts.regular,
    marginVertical: 12,
  },

  programList: {
    paddingHorizontal: 20,
    gap: 16,
  },

  programCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#94A2B6",
  },

  programHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    marginBottom: 4,
  },

  cardDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 7,
  },

  goalBox: {
    backgroundColor: "rgba(139,246,217,.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: "center",
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
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#8BF6D9",
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
  },

  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  modalOptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
  },
});
