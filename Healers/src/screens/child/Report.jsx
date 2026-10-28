import {
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getChildTherapist } from '../../api/child/api';
import {
  getChildPrograms,
  getChildStatsApi,
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

export default function ReportScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const selectedChildId = user?.id || user?._id;
  const activeChild = user;
  const [childTherapists, setChildTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const [sessionStats, setSessionStats] = useState({
    nextSession: null,
    attendancePercentage: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    fetchChildTherapists();
  }, []);

  useEffect(() => {
    if (!selectedChildId || !selectedTherapist?._id) {
      return;
    }

    fetchProgramsForSelectedChild(
      selectedChildId,
      selectedTherapist._id,
    );
    fetchChildStats(
      selectedChildId,
      selectedTherapist._id,
    );
  }, [selectedChildId, selectedTherapist?._id]);

  const fetchChildTherapists = async () => {
    try {
      const response = await getChildTherapist();

      if (response?.success && Array.isArray(response.data)) {
        setChildTherapists(response.data);

        if (response.data.length > 0) {
          setSelectedTherapist(response.data[0]);
        }
      } else {
        setChildTherapists([]);
        setSelectedTherapist(null);
      }
    } catch (error) {
      console.error(
        "Error fetching therapists for child:",
        error,
      );

      setChildTherapists([]);
      setSelectedTherapist(null);
    }
  };

  const fetchProgramsForSelectedChild = async (childId, therapistId) => {
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
        "Error fetching programs for child:",
        error,
      );

      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchChildStats = async (childId, therapistId) => {
    try {
      setLoadingStats(true);

      const response = await getChildStatsApi(
        childId,
        therapistId,
      );

      if (response?.success) {
        setSessionStats({
          nextSession: response.data?.nextSession || null,
          attendancePercentage: response.data?.attendancePercentage || 0,
        });
      } else {
        setSessionStats({
          nextSession: null,
          attendancePercentage: 0,
        });
      }
    } catch (error) {
      console.error(
        "Error fetching child stats:",
        error,
      );

      setSessionStats({
        nextSession: null,
        attendancePercentage: 0,
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const formatNextSession = (session) => {
    if (!session) {
      return "No upcoming session";
    }

    const dateObj = new Date(session.date);

    if (isNaN(dateObj.getTime())) {
      return "No upcoming session";
    }

    const formattedDate = dateObj.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      },
    );

    let timeString = session.startTime || "";

    if (timeString.includes(":")) {
      const [hours, minutes] = timeString
        .split(":")
        .map(Number);

      if (
        !isNaN(hours)
        && !isNaN(minutes)
      ) {
        const dateForTime = new Date();

        dateForTime.setHours(
          hours,
          minutes,
          0,
          0,
        );

        timeString = dateForTime.toLocaleTimeString(
          "en-US",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          },
        );
      }
    }

    return timeString
      ? `${formattedDate}, ${timeString}`
      : formattedDate;
  };

  const formatSpecialty = (specialty) => {
    if (!specialty) {
      return "THERAPY";
    }

    return specialty
      .replace(/_department|_therapy/g, "")
      .replace(/_/g, " ")
      .toUpperCase();
  };

  const getTherapistName = (therapist) => {
    return (
      therapist?.name
      || therapist?.fullName
      || therapist?.email
      || "Therapist"
    );
  };

  return (
    <View
      style={[
        styles.mainContainer,
        commonStyles.container,
      ]}
    >
      {childTherapists.length > 0 && (
        <View style={styles.therapistSliderWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.therapistSlider}
          >
            {childTherapists.map((therapist) => {
              const therapistId = therapist?._id || therapist?.id;

              const isSelected = selectedTherapist?._id === therapistId
                || selectedTherapist?.id === therapistId;

              return (
                <TouchableOpacity
                  key={therapistId}
                  style={[
                    styles.childChip,
                    isSelected
                      ? styles.chipSelected
                      : styles.chipUnselected,
                  ]}
                  onPress={() => setSelectedTherapist(therapist)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected
                      && styles.chipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {formatSpecialty(
                      therapist?.name
                        || therapist?.specialty,
                    )}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.childAvatarWrapper}>
            {activeChild?.profileImage
              ? (
                <Image
                  source={{
                    uri: activeChild.profileImage,
                  }}
                  style={styles.childAvatar}
                />
              )
              : (
                <View
                  style={styles.avatarFallback}
                >
                  <Text
                    style={styles.avatarFallbackText}
                  >
                    {(
                      activeChild?.fullName
                      || activeChild?.name
                      || "C"
                    )
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
          </View>

          <Text style={styles.childName}>
            {activeChild?.fullName
              || activeChild?.name
              || "Selected Child"}
          </Text>

          <View style={styles.badgesRow}>
            <View style={styles.ageBadge}>
              <Text
                style={styles.ageBadgeText}
              >
                Age {activeChild?.age || "0"}
              </Text>
            </View>

            <View
              style={styles.therapistBadge}
            >
              <Text
                style={styles.therapistBadgeText}
                numberOfLines={1}
              >
                Therapist: {getTherapistName(
                  selectedTherapist,
                )}
              </Text>
            </View>
          </View>

          <View style={styles.sessionBox}>
            {loadingStats
              ? (
                <ActivityIndicator
                  size="small"
                  color="#004E9F"
                />
              )
              : (
                <>
                  <View
                    style={styles.sessionColumn}
                  >
                    <Text
                      style={styles.sessionLabel}
                    >
                      Next Session
                    </Text>

                    <Text
                      style={styles.sessionValue}
                    >
                      {formatNextSession(
                        sessionStats.nextSession,
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.sessionColumn,
                      styles.attendanceColumn,
                    ]}
                  >
                    <Text
                      style={styles.sessionLabel}
                    >
                      Attendance
                    </Text>

                    <Text
                      style={styles.attendanceValue}
                    >
                      {sessionStats.attendancePercentage
                        || 0}
                      %
                    </Text>
                  </View>
                </>
              )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View
            style={styles.sectionCardHeader}
          >
            <Ionicons
              name="trophy-outline"
              size={fontSize(18)}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />

            <Text
              style={styles.sectionCardTitle}
            >
              Goals & Milestones
            </Text>
          </View>

          {loadingPrograms
            ? (
              <ActivityIndicator
                size="small"
                color="#004E9F"
                style={{
                  marginVertical: 20,
                }}
              />
            )
            : programs.length === 0
            ? (
              <Text style={styles.emptyText}>
                No programs or goals assigned by this therapist yet.
              </Text>
            )
            : (
              programs.map((program) => {
                const programId = program?._id
                  || program?.id
                  || `program-${Math.random()}`;

                const goalsList = program?.programGoals
                  || program?.goals
                  || [];

                if (!Array.isArray(goalsList)) {
                  return null;
                }

                return goalsList.map(
                  (goal, goalIndex) => {
                    const goalId = goal?._id
                      || goal?.id
                      || goalIndex;

                    const uniqueKey = `${programId}_${goalId}`;

                    const currentProgress = Math.min(
                      100,
                      Math.max(
                        0,
                        Number(
                          goal?.progress || 0,
                        ),
                      ),
                    );

                    return (
                      <View
                        key={uniqueKey}
                        style={styles.goalItemCard}
                      >
                        <View
                          style={styles.goalTitleRow}
                        >
                          <Text
                            style={styles.goalTitle}
                          >
                            {goal?.title
                              || "Goal Title"}
                          </Text>

                          <View
                            style={styles.progressBadge}
                          >
                            <Text
                              style={styles.progressBadgeText}
                            >
                              {Math.round(
                                currentProgress,
                              )}
                              %
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={styles.goalSubtext}
                        >
                          {program?.programName
                            ? `Program: ${program.programName}`
                            : "General Goal"}
                        </Text>

                        <View
                          style={styles.progressBarBg}
                        >
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${currentProgress}%`,
                                backgroundColor: currentProgress
                                    > 50
                                  ? "#8BF6D9"
                                  : "#0284C7",
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  },
                );
              })
            )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    paddingTop: hp(10),
  },

  therapistSliderWrapper: {
    width: "100%",
    marginBottom: 8,
  },

  therapistSlider: {
    paddingHorizontal: wp(20),
    paddingVertical: hp(8),
    gap: wp(10),
    alignItems: "center",
  },

  childChip: {
    minWidth: wp(140),
    maxWidth: wp(220),
    borderRadius: wp(32),
    paddingHorizontal: wp(20),
    paddingVertical: hp(12),
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
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    lineHeight: 20,
    color: "#004E9F",
  },

  chipTextSelected: {
    fontFamily: fonts.medium,
  },

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: wp(20),
    paddingTop: 8,
    paddingBottom: 20,
  },

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(37),
    padding: wp(20),
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    lineHeight:40
  },

  childName: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
    marginBottom: 8,
  },

  badgesRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: wp(8),
    marginBottom: 20,
  },

  ageBadge: {
    backgroundColor: "rgba(22,105,169,.1)",
    paddingHorizontal: wp(12),
    paddingVertical: hp(4),
    borderRadius: wp(999),
  },

  ageBadgeText: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#005086",
    lineHeight: 24,
  },

  therapistBadge: {
    maxWidth: "70%",
    backgroundColor: "rgba(255,183,129,.2)",
    paddingHorizontal: wp(12),
    paddingVertical: hp(4),
    borderRadius: wp(999),
  },

  therapistBadgeText: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#7A3E00",
    lineHeight: 24,
  },

  sessionBox: {
    width: "100%",
    backgroundColor: "#F1F4FA",
    borderRadius: wp(18),
    padding: wp(12),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 70,
  },

  sessionColumn: {
    flex: 1,
  },

  attendanceColumn: {
    alignItems: "flex-end",
  },

  sessionLabel: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 24,
    marginBottom: 2,
  },

  sessionValue: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#181C21",
    lineHeight: 24,
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
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    marginBottom: 12,
  },

  goalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  goalTitle: {
    flex: 1,
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
    marginRight: 10,
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
    marginBottom: 10,
  },

  progressBarBg: {
    height: 8,
    backgroundColor: "#EBEEF1",
    borderRadius: wp(999),
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    borderRadius: wp(999),
  },
});
