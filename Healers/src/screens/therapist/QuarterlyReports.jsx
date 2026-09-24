import React, {
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
  createQuarterlyReport,
  getChildPrograms,
  getQuarterlyReport,
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

const currentYear = new Date().getFullYear();

const QUARTERS_LIST = [
  {
    id: `Q1-${currentYear}`,
    label: `Q1 ${currentYear}`,
    quarter: "Q1",
    year: currentYear,
  },
  {
    id: `Q2-${currentYear}`,
    label: `Q2 ${currentYear}`,
    quarter: "Q2",
    year: currentYear,
  },
  {
    id: `Q3-${currentYear}`,
    label: `Q3 ${currentYear}`,
    quarter: "Q3",
    year: currentYear,
  },
  {
    id: `Q4-${currentYear}`,
    label: `Q4 ${currentYear}`,
    quarter: "Q4",
    year: currentYear,
  },
];

export default function QuarterlyReportsScreen({
  navigation,
}) {
  const { user } = useContext(AuthContext);

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childModalVisible, setChildModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState(
    `Q${
      Math.floor(
        new Date().getMonth() / 3,
      ) + 1
    }-${currentYear}`,
  );
  const [programs, setPrograms] = useState([]);
  const [reportPrograms, setReportPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [sentToParents, setSentToParents] = useState(true);
  const [savingReport, setSavingReport] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);

      const ID = user?.id || user?._id;

      const responseData = await therapistUsers({
        filter: ID,
      });

      const fetchedUsers = responseData?.data || [];

      setChildren(fetchedUsers);

      if (
        fetchedUsers.length > 0
        && !selectedChildId
      ) {
        const initialChildId = fetchedUsers[0]?._id
          || fetchedUsers[0]?.id;

        setSelectedChildId(initialChildId);
      }
    } catch (error) {
      console.error(
        "Error fetching children:",
        error,
      );

      Alert.alert(
        "Error",
        "Could not load children.",
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    if (selectedChildId) {
      fetchProgramsForSelectedChild(
        selectedChildId,
      );
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (selectedChildId && selectedQuarter) {
      loadQuarterlyReport(selectedChildId, selectedQuarter);
    }
  }, [selectedChildId, selectedQuarter]);

  const fetchProgramsForSelectedChild = async (childId) => {
    try {
      setLoadingPrograms(true);

      const therapistId = user?._id || user?.id;

      const response = await getChildPrograms(
        childId,
        therapistId,
      );

      if (response?.success) {
        const fetchedPrograms = response?.data || [];

        setPrograms(fetchedPrograms);

        const formattedPrograms = fetchedPrograms.map(
          (program) => ({
            programId: program?._id,

            programName: program?.programName || "",

            goals: (program?.programGoals || [])
              .flat()
              .map((goal) => ({
                goalId: goal?._id || null,

                goalName: goal?.goalName
                  || goal?.name
                  || goal?.title
                  || "",
              }))
              .filter((goal) => goal.goalName),

            // One report for the whole program
            report: "",
          }),
        );

        setReportPrograms(formattedPrograms);

        setReportPrograms(
          formattedPrograms,
        );
      } else {
        setPrograms([]);
        setReportPrograms([]);
      }
    } catch (error) {
      console.error(
        "Error fetching programs for child:",
        error,
      );

      setPrograms([]);
      setReportPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const updateProgramReport = (programId, text) => {
    setReportPrograms((previous) =>
      previous.map((program) =>
        program.programId === programId
          ? {
            ...program,
            report: text,
          }
          : program
      )
    );
  };

  const loadQuarterlyReport = async (
    childId,
    quarterId,
  ) => {
    try {
      setLoadingReport(true);

      const [
        quarter,
        year,
      ] = quarterId.split("-");

      const response = await getQuarterlyReport({
        userId: childId,

        year: Number(year),

        quarter,
      });

      if (
        response?.success
        && response?.data
      ) {
        /*
         * Existing report found.
         */

        setReportPrograms(
          response.data.programs || [],
        );

        setSentToParents(
          response.data.sentToParents
            ?? true,
        );
      } else {
        /*
         * No existing report.
         *
         * Keep programs fetched from
         * child programs.
         */

        setSentToParents(true);
      }
    } catch (error) {
      console.error(
        "Error loading quarterly report:",
        error?.response?.data
          || error,
      );

      /*
       * If report doesn't exist,
       * don't show an error to user.
       */
    } finally {
      setLoadingReport(false);
    }
  };

 
  const updateGoalDescription = (
    programId,
    goalId,
    goalName,
    text,
  ) => {
    setReportPrograms((previous) =>
      previous.map((program) => {
        if (
          program.programId
            !== programId
        ) {
          return program;
        }

        return {
          ...program,

          goals: (
            program.goals || []
          ).map((goal) => {
            const sameGoal = goal.goalId === goalId
              || (
                !goal.goalId
                && goal.goalName
                  === goalName
              );

            if (!sameGoal) {
              return goal;
            }

            return {
              ...goal,
              description: text,
            };
          }),
        };
      })
    );
  };

 
  const handleSubmit = async () => {
    try {
      if (!selectedChildId) {
        Alert.alert(
          "Required",
          "Please select a child.",
        );
        return;
      }

      if (!selectedQuarter) {
        Alert.alert(
          "Required",
          "Please select a quarter.",
        );
        return;
      }

      if (savingReport) {
        return;
      }

      const [
        quarter,
        year,
      ] = selectedQuarter.split("-");

      setSavingReport(true);

      const payload = {
        userId: selectedChildId,

        year: Number(year),

        quarter,

        programs: reportPrograms,

        sentToParents,

        status: "submitted",
      };

      console.log(
        "QUARTERLY REPORT PAYLOAD:",
        JSON.stringify(
          payload,
          null,
          2,
        ),
      );

      const response = await createQuarterlyReport(
        payload,
      );

      if (response?.success) {
        Alert.alert(
          "Success",
          "Quarterly report submitted successfully.",
          [
            {
              text: "OK",
              onPress: () => {
                if (
                  navigation?.goBack
                ) {
                  navigation.goBack();
                }
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          response?.message
            || "Failed to save quarterly report.",
        );
      }
    } catch (error) {
      console.error(
        "Submit quarterly report error:",
        error?.response?.data
          || error,
      );

      Alert.alert(
        "Error",
        error?.response?.data
          ?.message
          || "Failed to submit quarterly report.",
      );
    } finally {
      setSavingReport(false);
    }
  };

 
  const handleCancel = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };


  const filteredModalChildren = children?.filter((child) => {
    const childName = child?.fullName
      ?? child?.name
      ?? "";

    return childName
      .toLowerCase()
      .includes(
        modalSearch
          .toLowerCase()
          .trim(),
      );
  });


  const selectedChild = children.find(
    (child) =>
      (child?._id
        || child?.id)
        === selectedChildId,
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
        headerTitle="Quarterly Reports"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={styles.headerBanner}
        >
          <Text
            style={styles.bannerTitle}
          >
            Quarterly Reports Updates
          </Text>
        </View>

        <View
          style={styles.filterSection}
        >
          <View
            style={styles.sectionHeaderRow}
          >
            <Text
              style={styles.filterSectionTitle}
            >
              Enter Child
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                setChildModalVisible(
                  true,
                )}
            >
              <Text
                style={styles.viewAllText}
              >
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
                contentContainerStyle={styles.childChipsRow}
              >
                {children.map((child) => {
                  const childId = child?._id
                    || child?.id;

                  const isSelected = selectedChildId
                    === childId;

                  return (
                    <TouchableOpacity
                      key={childId}
                      style={[
                        styles.chip,

                        isSelected
                          ? styles.chipActive
                          : styles.chipInactive,
                      ]}
                      activeOpacity={0.8}
                      onPress={() =>
                        setSelectedChildId(
                          childId,
                        )}
                    >
                      <Text
                        style={styles.chipText}
                      >
                        {child?.fullName
                          || child?.name
                          || "Child"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )
            : (
              <View
                style={styles.noUserContainer}
              >
                <Text
                  style={styles.noUserText}
                >
                  No user found
                </Text>
              </View>
            )}

          <View
            style={[
              styles.sectionHeaderRow,
              {
                marginTop: 20,
              },
            ]}
          >
            <Text
              style={styles.filterSectionTitle}
            >
              Quarterly Date
            </Text>
          </View>

          <View
            style={styles.quarterGrid}
          >
            {QUARTERS_LIST.map(
              (item) => {
                const isSelected = selectedQuarter
                  === item.id;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.quarterChip,

                      isSelected
                        ? styles.quarterChipActive
                        : styles.quarterChipInactive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      setSelectedQuarter(
                        item.id,
                      )}
                  >
                    <Text
                      style={[
                        styles.quarterChipText,

                        isSelected
                          ? styles.quarterChipTextActive
                          : styles.quarterChipTextInactive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>
        </View>

        <View style={styles.blueContainer}>
          {loadingPrograms || loadingReport
            ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text style={styles.loadingText}>
                  Loading report...
                </Text>
              </View>
            )
            : reportPrograms.length > 0
            ? (
              reportPrograms.map((program) => {
                const goals = (program.goals || [])
                  .map((goal) => goal.goalName)
                  .filter(Boolean);

                return (
                  <View
                    key={program.programId}
                    style={styles.reportCard}
                  >
                    {/* PROGRAM NAME */}

                    <Text style={styles.cardTitle}>
                      {program.programName}
                    </Text>

                    {goals.length > 0 && (
                      <Text style={styles.goalsText}>
                        {goals.join(", ")}
                      </Text>
                    )}

                    {/* PROGRAM REPORT */}

                    <View style={styles.textAreaWrapper}>
                      <TextInput
                        style={styles.textAreaInput}
                        placeholder="Describe behavior, engagement, progress, and skill execution..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        value={program.report || ""}
                        onChangeText={(text) =>
                          updateProgramReport(
                            program.programId,
                            text,
                          )}
                      />
                    </View>
                  </View>
                );
              })
            )
            : (
              <View style={styles.noProgramContainer}>
                <Text style={styles.noProgramText}>
                  No Program found
                </Text>
              </View>
            )}

          {/* SENT TO PARENTS */}

          <View style={styles.toggleCard}>
            <View style={styles.toggleLeft}>
              <View style={styles.toggleIconBg}>
                <Ionicons
                  name="people"
                  size={20}
                  color="#0B598F"
                />
              </View>

              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleTitle}>
                  Sent To Parents
                </Text>

                <Text
                  style={styles.toggleSubTitle}
                  numberOfLines={2}
                >
                  Share this report with {selectedChild?.fullName
                    || selectedChild?.name
                    || "child"} Family
                </Text>
              </View>
            </View>

            <Switch
              value={sentToParents}
              onValueChange={setSentToParents}
              trackColor={{
                false: "#CBD5E1",
                true: colors.primary,
              }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#CBD5E1"
            />
          </View>

          {/* ACTIONS */}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                savingReport
                && styles.submitBtnDisabled,
              ]}
              activeOpacity={0.85}
              disabled={savingReport}
              onPress={handleSubmit}
            >
              {savingReport
                ? (
                  <ActivityIndicator
                    size="small"
                    color="#00725E"
                  />
                )
                : (
                  <Text style={styles.submitBtnText}>
                    Submit reports
                  </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              disabled={savingReport}
              onPress={handleCancel}
            >
              <Text style={styles.cancelBtnText}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* -------------------------------- */}
      {/* CHILD MODAL */}
      {/* -------------------------------- */}

      <Modal
        visible={childModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setChildModalVisible(
            false,
          )}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setChildModalVisible(
              false,
            )}
        >
          <View
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback>
              <View
                style={styles.modalContent}
              >
                {/* MODAL HEADER */}

                <View
                  style={styles.modalHeader}
                >
                  <Text
                    style={styles.modalTitle}
                  >
                    Select Child
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setChildModalVisible(
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

                {/* SEARCH */}

                <View
                  style={styles.modalSearchContainer}
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
                    style={styles.modalSearchInput}
                    placeholder="Search child..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                {/* CHILD LIST */}

                <ScrollView
                  style={{
                    maxHeight: 300,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredModalChildren.length
                      > 0
                    ? (
                      filteredModalChildren.map(
                        (child) => {
                          const childId = child?._id
                            || child?.id;

                          const isSelected = childId
                            === selectedChildId;

                          return (
                            <TouchableOpacity
                              key={childId}
                              style={[
                                styles.modalOption,

                                isSelected
                                && styles.modalOptionSelected,
                              ]}
                              onPress={() => {
                                setSelectedChildId(
                                  childId,
                                );

                                setChildModalVisible(
                                  false,
                                );

                                setModalSearch(
                                  "",
                                );
                              }}
                            >
                              <Text
                                style={[
                                  styles.modalOptionText,

                                  isSelected
                                  && styles.modalOptionTextSelected,
                                ]}
                              >
                                {child?.fullName
                                  || child?.name
                                  || "Child"}
                              </Text>

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
                      )
                    )
                    : (
                      <Text
                        style={styles.modalNoResult}
                      >
                        No child found
                      </Text>
                    )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* -------------------------------- */}
      {/* BOTTOM BAR */}
      {/* -------------------------------- */}

      <TherapistBottomBar activeTab="Children" />
    </SafeAreaView>
  );
}

// ======================================
// STYLES
// ======================================

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  // HEADER

  headerBanner: {
    backgroundColor: "#006B58",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },

  bannerTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 28,
  },

  // FILTER

  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  filterSectionTitle: {
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
    gap: 10,
    paddingRight: 20,
  },

  chip: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  chipActive: {
    backgroundColor: "#8BF6D9",
    borderColor: "#8BF6D9",
  },

  chipInactive: {
    backgroundColor: "#F1F4FA",
    borderColor: "#D7E3FF",
  },

  chipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 24,
    color: "#004E9F",
  },

  noUserContainer: {
    paddingVertical: 10,
  },

  noUserText: {
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  // QUARTER

  quarterGrid: {
    flexDirection: "row",
    gap: 8,
  },

  quarterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  quarterChipActive: {
    backgroundColor: "#035388",
    borderColor: "#035388",
  },

  quarterChipInactive: {
    backgroundColor: "#F1F4FA",
    borderColor: "#D7E3FF",
  },

  quarterChipText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    lineHeight: 24,
  },

  quarterChipTextActive: {
    color: "#FFFFFF",
  },

  quarterChipTextInactive: {
    color: "#004E9F",
  },

  // BLUE CONTAINER

  blueContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    borderRadius: 7,
    gap: 16,
  },

  loadingContainer: {
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  loadingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: fonts.regular,
  },

  noProgramContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },

  noProgramText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: fonts.medium,
  },

  // REPORT CARD

  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
  },

  cardTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 24,
    marginBottom: 6,
  },

  // GOAL

  goalRow: {
    marginTop: 14,
  },

  goalText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#334155",
    lineHeight: 20,
    marginBottom: 8,
  },
  goalsText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 14,
  },
  noGoalText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 8,
  },

  // TEXT AREA

  textAreaWrapper: {
    minHeight: 88,
    backgroundColor: "#F1F4F7",
    borderWidth: 1,
    borderColor: "#C1C7D2",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  textAreaInput: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    padding: 0,
    lineHeight: 20,
    minHeight: 60,
  },

  // TOGGLE

  toggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  toggleIconBg: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },

  toggleTextContainer: {
    flex: 1,
  },

  toggleTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 20,
  },

  toggleSubTitle: {
    fontSize: 9,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
    marginTop: 2,
  },

  // ACTION

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },

  submitBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#8BF6D9",
    alignItems: "center",
    justifyContent: "center",
  },

  submitBtnDisabled: {
    opacity: 0.7,
  },

  submitBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#00725E",
    lineHeight: 15,
  },

  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#000",
    lineHeight: 15,
  },

  // MODAL

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
    paddingVertical: 12,
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

  modalNoResult: {
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
});
