import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';

import {
  addTherapistFeedbackReply,
  feedbackManagement,
  getFeedbackReplies,
  therapistUsers,
  updateFeedbackVisibility,
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
  {
    label: "All Months",
    months: [],
  },
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
    (item) => item.months?.[0] === currentMonth,
  );

  return matchedRange?.label
    || "All Months";
};

export default function FeedbackManagementScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const [selectedRange, setSelectedRange] = useState(getCurrentMonthRangeLabel);
  const [childDropdownVisible, setChildDropdownVisible] = useState(false);
  const [monthDropdownVisible, setMonthDropdownVisible] = useState(false);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [children, setChildren] = useState([]);
  const [feedbackData, setFeedbackData] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [stats, setStats] = useState({ totalChildren: 0, totalSessions: 0, totalFeedbackDone: 0 });
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    fetchChildren();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (children.length === 0) {
        fetchChildren();
      }
    }, [children.length]),
  );

  const handleViewFeedback = async (view) => {
    try {
      const feedbackId = view?.feedbackDetails?.id;

      if (!feedbackId) {
        Alert.alert(
          "Error",
          "Feedback ID not found.",
        );
        return;
      }

      setSelectedFeedback(view);
      setReplyModalVisible(true);
      setLoadingReplies(true);
      setReplies([]);
      setReplyText("");

      const res = await getFeedbackReplies(
        feedbackId,
      );

      if (res?.success) {
        const feedback = res?.data || null;

        setReplies(
          res?.replies
            || feedback?.replies
            || [],
        );

        setSelectedFeedback({
          ...view,

          feedbackDetails: {
            ...view.feedbackDetails,

            id: feedback?._id
              || view.feedbackDetails?.id,

            notes: feedback?.notes
              || view.feedbackDetails?.notes
              || "",

            rating: feedback?.rating
              ?? view.feedbackDetails?.rating,

            mood: feedback?.mood
              || view.feedbackDetails?.mood
              || "",

            category: feedback?.category
              || view.feedbackDetails?.category
              || view.category,

            therapist: feedback?.therapistId
              || null,

            child: feedback?.childId
              || null,

            createdAt: feedback?.createdAt
              || null,

            replies: res?.replies
              || feedback?.replies
              || [],
          },
        });
      }
    } catch (error) {
      console.log(
        "getFeedbackReplies error:",
        error?.response?.data
          || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Failed to load replies.",
      );
    } finally {
      setLoadingReplies(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId) {
        fetchFeedbackData();
      }
    }, [selectedChildId, selectedRange]),
  );

  const fetchChildren = async () => {
    try {
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
        const initialChildId = fetchedUsers[0]._id
          || fetchedUsers[0].id;

        setSelectedChildId(
          initialChildId,
        );
      }
    } catch (error) {
      console.error(
        "Error fetching children:",
        error,
      );
    }
  };

  const fetchFeedbackData = async () => {
    try {
      setLoadingFeedback(true);

      const ID = user?.id || user?._id;

      const response = await feedbackManagement(
        ID,
        selectedChildId,
        selectedRange,
      );

      if (!response?.success) {
        setFeedbackData([]);
        return;
      }

      const {
        data,
        stats: responseStats,
      } = response;

      setStats({
        totalChildren: responseStats?.totalChildren
          || 0,
        totalSessions: responseStats?.totalSessions
          || 0,
        totalFeedbackDone: responseStats?.totalFeedbackDone
          || 0,
      });

      setFeedbackData(
        Array.isArray(data)
          ? data
          : [],
      );
    } catch (error) {
      console.error(
        "Error fetching feedback data:",
        error,
      );

      setFeedbackData([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleSendReply = async () => {
    const message = replyText.trim();

    if (!message) {
      Alert.alert(
        "Required",
        "Please enter a reply.",
      );
      return;
    }

    const feedbackId = selectedFeedback?.feedbackDetails?.id;

    if (!feedbackId) {
      Alert.alert(
        "Error",
        "Feedback ID not found.",
      );
      return;
    }

    try {
      setSendingReply(true);

      const response = await addTherapistFeedbackReply(
        feedbackId,
        message,
      );

      if (!response?.success) {
        Alert.alert(
          "Error",
          response?.message
            || "Failed to add reply.",
        );
        return;
      }

      setReplyText("");

      const repliesResponse = await getFeedbackReplies(feedbackId);

      const updatedReplies = repliesResponse?.replies
        || repliesResponse?.data?.replies
        || response?.replies
        || response?.data?.replies
        || [];

      setReplies(updatedReplies);

      setSelectedFeedback((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          feedbackDetails: {
            ...previous.feedbackDetails,
            replies: updatedReplies,
          },
        };
      });

      setFeedbackData((previous) =>
        previous.map((child) => ({
          ...child,

          sessions: (child.sessions || []).map(
            (session) => {
              const sessionFeedbackId = session?.feedbackDetails?.id;

              if (
                String(sessionFeedbackId)
                  !== String(feedbackId)
              ) {
                return session;
              }

              return {
                ...session,

                feedbackDetails: {
                  ...session.feedbackDetails,
                  replies: updatedReplies,
                },
              };
            },
          ),
        }))
      );
    } catch (error) {
      console.log(
        "handleSendReply error:",
        error?.response?.data
          || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Failed to add reply.",
      );
    } finally {
      setSendingReply(false);
    }
  };
  const activeChild = children.find(
    (item) =>
      String(
        item._id || item.id,
      )
        === String(
          selectedChildId,
        ),
  ) || {};

  function formatFeedbackDate(date) {
    if (!date) {
      return "Unknown date";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown date";
    }

    return parsedDate.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const handleVisibilityChange = async () => {
    const feedbackId = selectedFeedback?.feedbackDetails?.id;

    if (!feedbackId) {
      return;
    }

    const currentValue = selectedFeedback?.feedbackDetails
      ?.isVisibleToParent !== false;

    try {
      const response = await updateFeedbackVisibility(
        feedbackId,
        !currentValue,
      );

      if (response?.success) {
        setSelectedFeedback((prev) => ({
          ...prev,
          feedbackDetails: {
            ...prev.feedbackDetails,
            isVisibleToParent: response.data.isVisibleToParent,
          },
        }));

        setFeedbackData((prev) =>
          prev.map((child) => ({
            ...child,
            sessions: child.sessions.map(
              (session) => {
                if (
                  String(
                    session.feedbackDetails?.id,
                  ) !== String(feedbackId)
                ) {
                  return session;
                }

                return {
                  ...session,
                  feedbackDetails: {
                    ...session.feedbackDetails,
                    isVisibleToParent: response.data
                      .isVisibleToParent,
                  },
                };
              },
            ),
          }))
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Failed to update visibility.",
      );
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Feedback Management"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchBarContainer}
            activeOpacity={0.8}
            onPress={() =>
              setChildDropdownVisible(
                true,
              )}
          >
            <Feather
              name="search"
              size={20}
              color="#717781"
              style={styles.searchIcon}
            />

            <Text
              style={styles.selectedChildText}
              numberOfLines={1}
            >
              {activeChild?.name
                || activeChild?.fullName
                || "Select Child"}
            </Text>

            <Feather
              name="chevron-down"
              size={18}
              color="#717781"
              style={{
                marginLeft: "auto",
              }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterBtn}
            activeOpacity={0.8}
            onPress={() =>
              setChildDropdownVisible(
                true,
              )}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <View
          style={styles.childInfoCard}
        >
          <Text
            style={styles.childSectionTitle}
          >
            Child
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.fieldBox}>
              <Text
                style={styles.fieldLabel}
              >
                Name
              </Text>

              <View
                style={styles.fieldValueContainer}
              >
                <Text
                  style={styles.fieldValueText}
                >
                  {activeChild?.name
                    || activeChild
                      ?.fullName
                    || "-"}
                </Text>
              </View>
            </View>

            <View style={styles.fieldBox}>
              <Text
                style={styles.fieldLabel}
              >
                Parents
              </Text>

              <View
                style={styles.fieldValueContainer}
              >
                <Text
                  style={styles.fieldValueText}
                >
                  {activeChild
                    ?.fatherName
                    || "-"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text
              style={styles.statNumber}
            >
              {stats.totalChildren}
            </Text>

            <Text
              style={styles.statLabel}
            >
              TOTAL{"\n"}CHILDREN
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text
              style={styles.statNumber}
            >
              {stats.totalFeedbackDone
                  < 10
                ? `0${stats.totalFeedbackDone}`
                : stats.totalFeedbackDone}
            </Text>

            <Text
              style={styles.statLabel}
            >
              GIVE{"\n"}FEEDBACK
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text
              style={styles.statNumber}
            >
              {stats.totalSessions}
            </Text>

            <Text
              style={styles.statLabel}
            >
              TOTAL{"\n"}SESSIONS
            </Text>
          </View>
        </View>

        <View
          style={styles.dateHeaderBanner}
        >
          <TouchableOpacity
            style={styles.dateDropdownBtn}
            activeOpacity={0.7}
            onPress={() =>
              setMonthDropdownVisible(
                true,
              )}
          >
            <Text
              style={styles.dateDropdownText}
            >
              {selectedRange}
            </Text>

            <Feather
              name="chevron-down"
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View
            style={styles.feedbackPillBtn}
          >
            <Text
              style={styles.feedbackPillText}
            >
              Feedback
            </Text>
          </View>
        </View>

        {loadingFeedback
          ? (
            <View
              style={styles.loaderContainer}
            >
              <ActivityIndicator
                size="large"
                color={colors.primary
                  || "#006B5D"}
              />

              <Text
                style={styles.loadingText}
              >
                Loading sessions...
              </Text>
            </View>
          )
          : (() => {
            const childFeedback = feedbackData.find(
              (item) =>
                String(item.id)
                  === String(
                    selectedChildId,
                  ),
            )
              || feedbackData[0];

            const sessions = childFeedback?.sessions
              || [];

            const isFutureDate = (
              dateVal,
              timeStr,
            ) => {
              if (!dateVal) {
                return false;
              }

              const now = new Date();
              const sessionDate = new Date(dateVal);

              if (
                timeStr
                && typeof timeStr
                  === "string"
              ) {
                const startTimePart = timeStr.includes("-")
                  ? timeStr
                    .split("-")[0]
                    .trim()
                  : timeStr.trim();

                const [
                  hours,
                  minutes,
                ] = startTimePart
                  .split(":")
                  .map(Number);

                if (
                  !Number.isNaN(hours)
                  && !Number.isNaN(
                    minutes,
                  )
                ) {
                  sessionDate.setHours(
                    hours,
                    minutes,
                    0,
                    0,
                  );

                  return (
                    sessionDate > now
                  );
                }
              }

              sessionDate.setHours(
                23,
                59,
                59,
                999,
              );

              return sessionDate > now;
            };

            return (
              <View
                style={styles.sessionList}
              >
                {sessions.length > 0
                  ? sessions.map(
                    (item) => {
                      const isUpcoming = isFutureDate(
                        item.rawDate,
                        item.time,
                      );

                      return (
                        <View
                          key={item.id}
                          style={styles.sessionCard}
                        >
                          <View
                            style={styles.sessionLeft}
                          >
                            {item.isDone
                              ? (
                                <View
                                  style={styles.iconCircleDone}
                                >
                                  <Ionicons
                                    name="checkmark-circle-outline"
                                    size={22}
                                    color="#006B58"
                                  />
                                </View>
                              )
                              : (
                                <View
                                  style={styles.iconCirclePending}
                                >
                                  <MaterialCommunityIcons
                                    name="dots-horizontal-circle-outline"
                                    size={22}
                                    color="#717781"
                                  />
                                </View>
                              )}

                            <View
                              style={styles.sessionDetails}
                            >
                              <View
                                style={styles.nameTimeRow}
                              >
                                <Text
                                  style={styles.childItemName}
                                >
                                  {item.name}
                                </Text>

                                {!!item.time && (
                                  <Text
                                    style={styles.timeText}
                                  >
                                    {formatTo12Hour(
                                      item.time,
                                    )}
                                  </Text>
                                )}
                              </View>

                              <Text
                                style={styles.categoryText}
                              >
                                <Text
                                  style={styles.dateHighlight}
                                >
                                  {item.date}
                                </Text>
                                {" • "}
                                {item.category}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={styles.sessionRight}
                          >
                            {item.isDone
                              ? (
                                <>
                                  <View
                                    style={styles.badgeDone}
                                  >
                                    <Text
                                      style={styles.badgeDoneText}
                                    >
                                      Feedback Done
                                    </Text>
                                  </View>

                                  <TouchableOpacity
                                    style={styles.viewBtn}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                      handleViewFeedback(
                                        item,
                                      )}
                                  >
                                    <Text
                                      style={styles.viewBtnText}
                                    >
                                      View
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              )
                              : (
                                <>
                                  <View
                                    style={styles.badgePending}
                                  >
                                    <Text
                                      style={styles.badgePendingText}
                                    >
                                      Pending
                                    </Text>
                                  </View>

                                  <TouchableOpacity
                                    style={[
                                      styles.addFeedbackBtn,
                                      isUpcoming
                                      && styles.disabledBtn,
                                    ]}
                                    disabled={isUpcoming}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                      navigation.navigate(
                                        "AddFeedback",
                                        {
                                          session: item,
                                          childId: selectedChildId,
                                        },
                                      )}
                                  >
                                    <Text
                                      style={styles.addFeedbackBtnText}
                                    >
                                      Add Feedback
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              )}
                          </View>
                        </View>
                      );
                    },
                  )
                  : (
                    <View
                      style={styles.emptyContainer}
                    >
                      <Text
                        style={styles.emptyText}
                      >
                        No sessions found for {selectedRange}
                      </Text>
                    </View>
                  )}
              </View>
            );
          })()}
      </ScrollView>

      <Modal
        visible={childDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setChildDropdownVisible(
            false,
          )}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setChildDropdownVisible(
              false,
            )}
        >
          <View
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback>
              <View
                style={styles.dropdownMenu}
              >
                <Text
                  style={styles.dropdownMenuTitle}
                >
                  Select Child
                </Text>

                {children.map(
                  (child) => {
                    const currentId = child._id
                      || child.id;

                    const isSelected = String(currentId)
                      === String(
                        selectedChildId,
                      );

                    return (
                      <TouchableOpacity
                        key={currentId}
                        style={[
                          styles.dropdownOption,
                          isSelected
                          && styles.dropdownOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedChildId(
                            currentId,
                          );

                          setChildDropdownVisible(
                            false,
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            isSelected
                            && styles.dropdownOptionTextSelected,
                          ]}
                        >
                          {child?.name
                            || child
                              ?.fullName}
                        </Text>

                        {isSelected && (
                          <Feather
                            name="check"
                            size={18}
                            color="#1669A9"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={monthDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMonthDropdownVisible(
            false,
          )}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setMonthDropdownVisible(
              false,
            )}
        >
          <View
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback>
              <View
                style={styles.dropdownMenu}
              >
                <Text
                  style={styles.dropdownMenuTitle}
                >
                  Select Month Range
                </Text>

                <ScrollView
                  style={{
                    maxHeight: 300,
                  }}
                  showsVerticalScrollIndicator
                >
                  {MONTH_RANGES.map(
                    (rangeObj) => {
                      const isSelected = rangeObj.label
                        === selectedRange;

                      return (
                        <TouchableOpacity
                          key={rangeObj.label}
                          style={[
                            styles.dropdownOption,
                            isSelected
                            && styles.dropdownOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedRange(
                              rangeObj.label,
                            );

                            setMonthDropdownVisible(
                              false,
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownOptionText,
                              isSelected
                              && styles.dropdownOptionTextSelected,
                            ]}
                          >
                            {rangeObj.label}
                          </Text>

                          {isSelected && (
                            <Feather
                              name="check"
                              size={18}
                              color="#006B5D"
                            />
                          )}
                        </TouchableOpacity>
                      );
                    },
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={replyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <View style={styles.modalOverlay2}>
          <View style={styles.replyModal}>
            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                Feedback Replies
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setReplyModalVisible(
                    false,
                  )}
              >
                <Feather
                  name="x"
                  size={22}
                  color="#334155"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.visibilityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visibilityTitle}>
                  Visible to Parent & Child
                </Text>

                <Text style={styles.visibilitySubtitle}>
                  {selectedFeedback?.feedbackDetails
                      ?.isVisibleToParent !== false
                    ? "Feedback is visible"
                    : "Feedback is hidden"}
                </Text>
              </View>

              <Switch
                value={selectedFeedback?.feedbackDetails
                  ?.isVisibleToParent !== false}
                onValueChange={handleVisibilityChange}
                trackColor={{
                  false: "#CBD5E1",
                  true: "#86EFAC",
                }}
                thumbColor="#FFFFFF"
              />
            </View>

            {selectedFeedback && (
              <View style={styles.originalFeedback}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  {selectedFeedback?.feedbackDetails
                      ?.therapist?.profileImage
                    ? (
                      <Image
                        source={{
                          uri: selectedFeedback
                            .feedbackDetails
                            .therapist
                            .profileImage,
                        }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          marginRight: 10,
                        }}
                      />
                    )
                    : (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          marginRight: 10,
                          backgroundColor: "#E2E8F0",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text>
                          {selectedFeedback?.feedbackDetails
                            ?.therapist?.fullName
                            ?.charAt(0)
                            ?.toUpperCase() || "T"}
                        </Text>
                      </View>
                    )}

                  <View>
                    <Text style={styles.originalFeedbackName}>
                      {selectedFeedback?.feedbackDetails
                        ?.therapist?.fullName
                        || "Therapist"}
                    </Text>

                    <Text
                      style={{
                        fontSize: 11,
                        color: "#64748B",
                      }}
                    >
                      Therapist Feedback
                    </Text>
                  </View>
                </View>

                <Text style={styles.originalFeedbackText}>
                  {selectedFeedback?.feedbackDetails?.notes
                    || "No feedback notes"}
                </Text>

                <Text style={styles.originalFeedbackText}>
                  Appt: {formatFeedbackDate(
                    selectedFeedback.rawDate,
                  )}

                  {selectedFeedback.startTime
                    ? `, ${
                      formatTo12Hour(
                        selectedFeedback.startTime,
                      )
                    }`
                    : ""}
                </Text>
              </View>
            )}

            <ScrollView
              style={styles.repliesList}
              contentContainerStyle={{
                paddingVertical: 10,
              }}
            >
              {loadingReplies
                ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                  />
                )
                : replies.length === 0
                ? (
                  <Text
                    style={styles.noRepliesText}
                  >
                    No replies yet.
                  </Text>
                )
                : (
                  replies.map((reply) => {
                    const replyUserId = reply.repliedBy?._id
                      || reply.repliedBy?.id
                      || reply.repliedBy;

                    const currentUserId = user?._id || user?.id;

                    const isMyReply = String(
                      replyUserId,
                    )
                      === String(currentUserId);

                    return (
                      <View
                        key={reply._id}
                        style={[
                          styles.replyRow,
                          isMyReply
                            ? styles.myReplyRow
                            : styles.otherReplyRow,
                        ]}
                      >
                        <View
                          style={[
                            styles.replyBubble,
                            isMyReply
                              ? styles.myReplyBubble
                              : styles.otherReplyBubble,
                          ]}
                        >
                          <Text
                            style={[
                              styles.replySender,
                              isMyReply
                              && styles.myReplySenderText,
                            ]}
                          >
                            {isMyReply
                              ? "You"
                              : reply.repliedBy
                                ?.fullName
                                || reply.repliedByRole}
                          </Text>

                          <Text
                            style={[
                              styles.replyMessage,
                              isMyReply
                              && styles.myReplyMessageText,
                            ]}
                          >
                            {reply.message}
                          </Text>

                          <Text
                            style={[
                              styles.replyTime,
                              isMyReply
                              && styles.myReplyTimeText,
                            ]}
                          >
                            {new Date(
                              reply.createdAt,
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
            </ScrollView>

            <View
              style={styles.replyInputRow}
            >
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Write a reply..."
                placeholderTextColor="#94A3B8"
                multiline
                style={styles.replyInput}
              />

              <TouchableOpacity
                disabled={sendingReply
                  || !replyText.trim()}
                onPress={handleSendReply}
                style={[
                  styles.sendReplyBtn,
                  (sendingReply
                    || !replyText.trim())
                  && styles.sendReplyBtnDisabled,
                ]}
              >
                {sendingReply
                  ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  )
                  : (
                    <Feather
                      name="send"
                      size={18}
                      color="#FFFFFF"
                    />
                  )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    flex: 1,
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
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
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
    color: "rgba(255,255,255,.8)",
    textAlign: "center",
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  dateHeaderBanner: {
    backgroundColor: "#00725E",
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
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
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
  disabledBtn: {
    backgroundColor: "#A0AEC0",
    opacity: 0.6,
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
    backgroundColor: "rgba(0,0,0,0.4)",
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  replyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  replyModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    maxHeight: "88%",
  },
  replyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  replyModalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  replyModalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  replyScrollView: {
    maxHeight: 380,
  },
  replyScrollContent: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  originalFeedbackBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  originalFeedbackLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#00725E",
    marginBottom: 6,
  },
  originalFeedbackText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  feedbackMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  feedbackMetaText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: "#64748B",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  repliesTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: 10,
  },
  replyBubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  therapistReplyBubble: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  childReplyBubble: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  replyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  replySender: {
    maxWidth: "65%",
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginRight: 8,
  },
  replyRoleBadge: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  therapistRoleBadge: {
    backgroundColor: "#A7F3D0",
  },
  childRoleBadge: {
    backgroundColor: "#BFDBFE",
  },
  replyRoleText: {
    fontSize: 9,
    fontFamily: fonts.medium,
    color: "#334155",
  },
  replyText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 19,
  },
  replyDate: {
    fontSize: 9,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    marginTop: 7,
  },
  noRepliesBox: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noRepliesText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },
  replyInputSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  replyInputLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#334155",
    marginBottom: 7,
  },
  replyInput: {
    minHeight: 80,
    maxHeight: 120,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  sendReplyBtn: {
    height: 42,
    backgroundColor: "#00725E",
    borderRadius: 10,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  sendReplyBtnDisabled: {
    opacity: 0.5,
  },
  sendReplyBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  originalFeedback: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  originalFeedbackName: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    marginBottom: 4,
  },

  originalFeedbackText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#475569",
    lineHeight: 20,
  },

  repliesList: {
    flex: 1,
  },

  replyRow: {
    width: "100%",
    marginVertical: 4,
  },

  myReplyRow: {
    alignItems: "flex-end",
  },

  otherReplyRow: {
    alignItems: "flex-start",
  },

  replyBubble: {
    maxWidth: "80%",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
  },

  myReplyBubble: {
    backgroundColor: "#0B4A6F",
    borderBottomRightRadius: 2,
  },

  otherReplyBubble: {
    backgroundColor: "#F1F5F9",
    borderBottomLeftRadius: 2,
  },

  replySender: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: "#64748B",
    marginBottom: 2,
  },

  myReplySenderText: {
    color: "#93C5FD",
    textAlign: "right",
  },

  replyMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 19,
  },

  myReplyMessageText: {
    color: "#FFFFFF",
  },

  replyTime: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    marginTop: 4,
  },

  myReplyTimeText: {
    color: "#E2E8F0",
    textAlign: "right",
  },

  noRepliesText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 30,
  },

  replyInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  replyInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  sendReplyBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  sendReplyBtnDisabled: {
    opacity: 0.5,
  },
  modalOverlay2: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  replyModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: "85%",
    padding: 18,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
  },

  visibilityRow: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 12,
  marginTop: 10,
  borderTopWidth: 1,
  borderTopColor: "#E2E8F0",
},
visibilityTitle: {
  fontSize: 13,
  fontFamily: fonts.semiBold,
  color: "#0F172A",
},
visibilitySubtitle: {
  fontSize: 11,
  fontFamily: fonts.regular,
  color: "#64748B",
  marginTop: 2,
},
});
