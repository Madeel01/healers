import React, {
  useCallback,
  useContext,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';

import {
  addChildFeedbackReply,
  deleteChildFeedback,
  getChildFeedbackReplies,
  getChildFeedbackRequests,
} from '../../api/child/api';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

const TAB_TO_STATUS = {
  "All Feedback": "all",
  Pending: "pending",
  New: "new",
};

const MOOD_OPTIONS = [
  {
    id: "Frustrated",
    label: "Frustrated",
    emoji: "😔",
  },
  {
    id: "Neutral",
    label: "Neutral",
    emoji: "😐",
  },
  {
    id: "Happy",
    label: "Happy",
    emoji: "😊",
  },
  {
    id: "Excited",
    label: "Excited",
    emoji: "🤩",
  },
];

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

function mapFeedbackItem(item, status) {
  const isPendingItem = item.isPending === true
    || (
      !item._id
      && item.statusLabel === "Pending"
    );

  if (isPendingItem) {
    return {
      ...item,
      id: String(
        item.id
          || item.appointmentId,
      ),
      appointmentId: String(item.appointmentId),
      primaryAction: "Add Feedback",
      primaryIcon: "plus",
      actionType: "primary",
      statusLabel: "Pending",
      isPending: true,
      isRespond: false,
      canReply: false,
      rating: null,
      comment: item.comment || "",
      startTime: item.startTime
        || "--:--",
      endTime: item.endTime
        || "--:--",
      date: item.date
        || item.sessionDate
        || null,
      sessionDate: item.sessionDate
        || item.date
        || null,
      replies: [],
      myReplies: [],
    };
  }

  const replies = Array.isArray(item.replies)
    ? item.replies
    : [];

  const myReplies = Array.isArray(item.myReplies)
    ? item.myReplies
    : [];

  const isResponded = item.isRespond === true
    || myReplies.length > 0;

  const mood = MOOD_OPTIONS.find(
    (option) => option.id === item.moodLabel,
  );

  return {
    ...item,
    id: String(
      item.id
        || item._id
        || item.appointmentId,
    ),
    appointmentId: item.appointmentId
      ? String(
        item.appointmentId,
      )
      : null,
    primaryAction: isResponded
      ? "View Reply"
      : "Add Reply",
    primaryIcon: isResponded
      ? undefined
      : "corner-up-left",
    actionType: isResponded
      ? "outline"
      : "primary",
    statusLabel: isResponded
      ? "Responded"
      : status === "new"
      ? "New"
      : item.statusLabel
        || "Feedback",
    isRespond: isResponded,
    canReply: !isResponded,
    isPending: false,
    isNew: status === "new"
      || item.isNew === true,
    rating: typeof item.rating
        === "number"
      ? item.rating
      : 0,
    comment: typeof item.comment
        === "string"
      ? item.comment.trim()
      : "",
    startTime: item.startTime
      || "--:--",
    endTime: item.endTime
      || "--:--",
    date: item.date
      || item.sessionDate
      || null,
    sessionDate: item.sessionDate
      || item.date
      || null,
    moodEmoji: mood?.emoji || "",
    replies,
    myReplies,
  };
}

export default function ChildFeedback({ navigation }) {
  const { user } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState("All Feedback");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("");
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [stats, setStats] = useState({
    pendingFeedback: 0,
    sinceYesterdayFeedback: 0,
    averageSatisfaction: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const status = TAB_TO_STATUS[activeTab] || "all";

  const fetchFeedback = useCallback(
    async ({
      isRefresh = false,
      nextPage = 1,
    } = {}) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (nextPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setError(null);

      try {
        const response = await getChildFeedbackRequests(
          status,
          nextPage,
        );

        const payload = response?.data;
        if (!payload?.success) {
          throw new Error(
            payload?.message
              || "Failed to load feedback",
          );
        }

        const mapped = (payload.data || []).map(
          (item) => mapFeedbackItem(item, status),
        );

        if (nextPage === 1) {
          setFeedbackItems(mapped);
        } else {
          setFeedbackItems((prev) => {
            const existingIds = new Set(
              prev.map((item) => String(item.id)),
            );

            const newItems = mapped.filter(
              (item) =>
                !existingIds.has(
                  String(item.id),
                ),
            );

            return [...prev, ...newItems];
          });
        }

        setPage(nextPage);
        setHasMore(payload.hasMore === true);

        setStats({
          pendingFeedback: payload.stats?.pendingFeedback ?? 0,
          sinceYesterdayFeedback: payload.stats?.sinceYesterdayFeedback
            ?? 0,
          averageSatisfaction: payload.stats?.averageSatisfaction ?? 0,
        });
      } catch (err) {
        console.error(
          "Failed to fetch feedback:",
          err,
        );

        setError(
          err?.response?.data?.message
            || err?.message
            || "Something went wrong while loading feedback.",
        );

        if (nextPage === 1) {
          setFeedbackItems([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [status],
  );

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      setHasMore(true);

      fetchFeedback({
        nextPage: 1,
      });
    }, [fetchFeedback]),
  );

  const loadMoreFeedback = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) {
      return;
    }

    fetchFeedback({
      nextPage: page + 1,
    });
  }, [
    loading,
    loadingMore,
    refreshing,
    hasMore,
    page,
    fetchFeedback,
  ]);

  const renderStars = (rating) => {
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      let iconName = "star-o";

      if (rating >= i) {
        iconName = "star";
      } else if (rating >= i - 0.5) {
        iconName = "star-half-o";
      }

      stars.push(
        <FontAwesome
          key={i}
          name={iconName}
          size={fontSize(14)}
          color="#7A3E00"
          style={styles.starIcon}
        />,
      );
    }

    return (
      <View style={styles.starRow}>
        {stars}
      </View>
    );
  };

  const handleViewFeedback = async (view) => {
    setSelectedFeedback(view);
    const res = await getChildFeedbackReplies(view.appointmentId);

    setReplyModalVisible(true);
    setLoadingReplies(true);
    setReplies(
      Array.isArray(res.data.replies)
        ? res.data.replies
        : [],
    );
    setReplyText("");

    setTimeout(() => {
      setLoadingReplies(false);
    }, 200);
  };

  const handleDeleteFeedback = (item) => {
    if (!item.isRespond) {
      return;
    }

    Alert.alert(
      "Delete Feedback",
      "This will permanently remove this feedback. Continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(item.id);

              const response = await deleteChildFeedback(
                item.id,
              );
              if (!response?.data?.success) {
                throw new Error(
                  response?.data?.message
                    || "Failed to delete feedback",
                );
              }

              // setFeedbackItems((prev) =>
              //   prev.filter(
              //     (feedback) =>
              //       String(feedback.id)
              //         !== String(item.id),
              //   )
              // );

              fetchFeedback({ nextPage: 1 });
              if (
                selectedFeedback
                && String(
                    selectedFeedback.id,
                  ) === String(item.id)
              ) {
                setReplyModalVisible(false);
                setSelectedFeedback(null);
                setReplies([]);
              }
            } catch (error) {
              console.error(
                "Failed to delete feedback:",
                error,
              );

              Alert.alert(
                "Error",
                error?.response?.data?.message
                  || error?.message
                  || "Could not delete this feedback.",
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const handleSendReply = async () => {
    if (
      !selectedFeedback
      || !replyText.trim()
    ) {
      return;
    }

    try {
      setSendingReply(true);

      const response = await addChildFeedbackReply(
        selectedFeedback.id,
        replyText.trim(),
      );

      if (
        !response?.data?.success
      ) {
        throw new Error(
          response?.data?.message
            || "Failed to add reply",
        );
      }

      const newReplies = response?.data?.replies
        || response?.data?.data?.replies
        || [];

      const sortedReplies = [
        ...newReplies,
      ].sort(
        (a, b) =>
          new Date(a.createdAt)
          - new Date(b.createdAt),
      );

      setReplies(sortedReplies);
      fetchFeedback({ nextPage: 1 });

      setSelectedFeedback((prev) =>
        prev
          ? {
            ...prev,
            isRespond: true,
            replies: sortedReplies,
            primaryAction: "View Reply",
            primaryIcon: undefined,
            actionType: "outline",
          }
          : prev
      );

      setFeedbackItems((prev) =>
        prev.map((feedback) =>
          String(feedback.id)
              === String(selectedFeedback.id)
            ? {
              ...feedback,
              isRespond: true,
              replies: sortedReplies,
              primaryAction: "View Reply",
              primaryIcon: undefined,
              actionType: "outline",
            }
            : feedback
        )
      );

      setReplyText("");
    } catch (error) {
      console.error(
        "Failed to send reply:",
        error,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || error?.message
          || "Failed to send reply.",
      );
    } finally {
      setSendingReply(false);
    }
  };

  const formatSessionDate = (date) => {
    if (!date) {
      return "Unknown date";
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown date";
    }
    return parsedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.mainContainer, commonStyles.container]}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const {
            layoutMeasurement,
            contentOffset,
            contentSize,
          } = event.nativeEvent;

          const distanceFromBottom = contentSize.height
            - (layoutMeasurement.height
              + contentOffset.y);

          if (distanceFromBottom < 300) {
            loadMoreFeedback();
          }
        }}
        scrollEventThrottle={300}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              fetchFeedback({
                isRefresh: true,
                nextPage: 1,
              })}
          />
        }
      >
        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricLabel}>
              Pending Feedback
            </Text>

            <Text style={styles.metricValue}>
              {stats.pendingFeedback} Items
            </Text>

            <View style={styles.trendRow}>
              <Feather
                name="trending-down"
                size={fontSize(14)}
                color="#006B58"
              />

              <Text style={styles.trendText}>
                {stats.sinceYesterdayFeedback} since yesterday
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.metricIconBg,
              {
                backgroundColor: "rgba(22,105,169,.1)",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="clipboard-clock-outline"
              size={fontSize(28)}
              color={colors.primary}
            />
          </View>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricLabel}>
              Average Satisfaction
            </Text>

            <Text
              style={[
                styles.metricValue,
                styles.metricValue2,
              ]}
            >
              {Number(
                stats.averageSatisfaction,
              ).toFixed(1)} / 5.0
            </Text>

            {renderStars(
              stats.averageSatisfaction,
            )}
          </View>

          <View
            style={[
              styles.metricIconBg,
              {
                backgroundColor: "rgba(255,220,196,.3)",
              },
            ]}
          >
            <Feather
              name="smile"
              size={fontSize(28)}
              color="#7A3E00"
            />
          </View>
        </View>

        <View style={styles.tabsContainer}>
          {Object.keys(TAB_TO_STATUS).map(
            (tab) => {
              const isActive = activeTab === tab;

              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    isActive
                    && styles.activeTabButton,
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isActive
                      && styles.activeTabText,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </View>

        {loading && (
          <View style={styles.centerState}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() =>
                fetchFeedback({
                  nextPage: 1,
                })}
            >
              <Text style={styles.retryBtnText}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && feedbackItems.length === 0 && (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>
              No feedback to show here.
            </Text>
          </View>
        )}

        {!loading && !error && feedbackItems.map((item) => (
          <View
            key={item.isPending
              ? `pending-${item.appointmentId}`
              : `feedback-${item.id || item.appointmentId}`}
            style={styles.feedbackCard}
          >
            <View style={styles.cardHeader}>
              {item.avatar
                ? (
                  <Image
                    source={{ uri: item.avatar }}
                    style={styles.userAvatar}
                  />
                )
                : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {(item.name || "User")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}

              <View style={styles.cardHeaderDetails}>
                <View style={styles.headerMainRow}>
                  <View style={styles.headerLeft}>
                    <View style={styles.nameBadgeRow}>
                      <Text
                        style={styles.userName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.name || "Therapist"}
                      </Text>

                      <View
                        style={[
                          styles.tagBadge,
                          item.statusLabel === "Responded"
                            ? styles.respondedBadgeBg
                            : item.statusLabel === "Pending"
                            ? styles.pendingBadgeBg
                            : styles.newBadgeBg,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagBadgeText,
                            item.statusLabel === "Responded"
                              ? styles.respondedBadgeText
                              : item.statusLabel === "Pending"
                              ? styles.pendingBadgeText
                              : styles.newBadgeText,
                          ]}
                          numberOfLines={1}
                        >
                          {item.statusLabel}
                        </Text>
                      </View> 
                    </View>

                    {item.rating != null && renderStars(item.rating)}
                  </View>

                  {!item.isPending && (
                    <View style={styles.appointmentInfo}>
                      <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>
                          Appt:{" "}
                        </Text>

                        {formatFeedbackDate(
                          item.sessionDate || item.date,
                        )}

                        {item.startTime && item.startTime !== "--:--"
                          ? `, ${formatTo12Hour(item.startTime)}`
                          : ""}
                      </Text>

                      <Text style={styles.detailLine}>
                        <Text style={styles.detailLabel}>
                          Reaction:{" "}
                        </Text>

                        {item.moodEmoji || ""} {item.moodLabel || "--"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {item.isPending
              ? (
                <View style={styles.pendingSessionBox}>
                  <View style={styles.pendingSessionHeader}>
                    <Feather
                      name="clock"
                      size={fontSize(16)}
                      color="#B45309"
                    />

                    <Text style={styles.pendingSessionTitle}>
                      Your session feedback is pending
                    </Text>
                  </View>

                  <View style={styles.pendingSessionDetails}>
                    <View style={styles.pendingSessionDetailItem}>
                      <Feather
                        name="calendar"
                        size={fontSize(14)}
                        color="#64748B"
                      />

                      <Text style={styles.pendingSessionDetailText}>
                        {formatFeedbackDate(
                          item.sessionDate || item.date,
                        )}
                      </Text>
                    </View>

                    <View style={styles.pendingSessionDetailItem}>
                      <Feather
                        name="clock"
                        size={fontSize(14)}
                        color="#64748B"
                      />

                      <Text style={styles.pendingSessionDetailText}>
                        {item.startTime && item.startTime !== "--:--"
                          ? formatTo12Hour(item.startTime)
                          : "--:--"}
                        {" - "}
                        {item.endTime && item.endTime !== "--:--"
                          ? formatTo12Hour(item.endTime)
                          : "--:--"}
                      </Text>
                    </View>
                  </View>
                </View>
              )
              : (
                <Text
                  style={item.comment
                    ? styles.commentText
                    : styles.notesText}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.comment || "No message"}
                </Text>
              )}

            <View style={styles.cardActionsRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  item.actionType === "primary"
                    ? styles.primaryBtn
                    : styles.outlineBtn,
                ]}
                onPress={() => {
                  if (
                    item.primaryAction === "Add Reply"
                    || item.primaryAction === "View Reply"
                  ) {
                    handleViewFeedback(item);
                    return;
                  }

                  if (item.primaryAction === "Add Feedback") {
                    navigation.navigate("CreateFeedback", {
                      session: {
                        appointmentId: item.appointmentId,
                        childId: {
                          _id: item.childId,
                        },
                        therapistId: {
                          _id: item.therapistId,
                          fullName: item.name
                            || item.therapistName
                            || "",
                          email: item.therapistEmail
                            || "",
                          profileImage: item.avatar
                            || "",
                          role: item.role
                            || "Therapist",
                        },
                        therapistName: item.name
                          || item.therapistName
                          || "",
                        specialty: item.specialty
                          || "",
                        sessionDate: item.sessionDate
                          || item.date,
                        date: item.sessionDate
                          || item.date,
                        startTime: item.startTime
                          || "--:--",
                        endTime: item.endTime
                          || "--:--",
                        attendanceStatus: item.attendanceStatus
                          || "Pending",
                        sessionType: item.sessionType
                          || "regular",
                        type: item.type
                          || null,
                        batchSessionId: item.batchSessionId
                          || null,
                        batchId: item.batchId
                          || null,
                        batchAssignmentId: item.batchAssignmentId
                          || null,
                      },
                    });
                  }
                }}
                disabled={item.primaryAction === "Add Feedback"
                  && !item.appointmentId}
              >
                {item.primaryIcon && (
                  <Feather
                    name={item.primaryIcon}
                    size={fontSize(16)}
                    color={item.actionType === "primary"
                      ? "#FFFFFF"
                      : "#0B4A6F"}
                    style={styles.btnIcon}
                  />
                )}

                <Text
                  style={[
                    styles.actionBtnText,
                    item.actionType === "primary"
                      ? styles.primaryBtnText
                      : styles.outlineBtnText,
                  ]}
                >
                  {item.primaryAction}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  item.isPending
                    ? styles.deleteBtnDisabled
                    : deletingId === item.id
                    ? styles.deleteBtnSending
                    : item.isRespond
                    ? styles.deleteBtn
                    : styles.deleteBtnDisabled,
                ]}
                disabled={item.isPending
                  || !item.isRespond
                  || deletingId === item.id}
                onPress={() => {
                  handleDeleteFeedback(item);
                }}
              >
                {deletingId === item.id
                  ? (
                    <ActivityIndicator
                      size="small"
                      color="#DC2626"
                      style={styles.btnIcon}
                    />
                  )
                  : (
                    <Feather
                      name="trash-2"
                      size={fontSize(16)}
                      color={!item.isPending && item.isRespond
                        ? "#FFFFFF"
                        : "#94A3B8"}
                      style={styles.btnIcon}
                    />
                  )}

                <Text
                  style={[
                    styles.secondaryGrayBtnText,
                    deletingId === item.id
                      ? styles.deleteBtnTextSending
                      : !item.isPending && item.isRespond
                      ? styles.deleteBtnText
                      : styles.deleteBtnTextDisabled,
                  ]}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {loadingMore && (
          <View
            style={styles.loadingMoreContainer}
          >
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />

            <Text
              style={styles.loadingMoreText}
            >
              Loading more feedback...
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={replyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyModalVisible(false)}
        style={{paddingBottom:insets.bottom}}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <View style={styles.modalOverlay}>
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
                    size={fontSize(22)}
                    color="#334155"
                  />
                </TouchableOpacity>
              </View>

              {selectedFeedback && (
                <View
                  style={styles.originalFeedback}
                >
                  <Text
                    style={styles.originalFeedbackName}
                  >
                    {selectedFeedback.name}
                  </Text>

                  <Text
                    style={styles.originalFeedbackText}
                  >
                    {selectedFeedback.comment
                      || "No message"}
                  </Text>

                  <Text
                    style={styles.originalFeedbackText}
                  >
                    Appt: {formatFeedbackDate(
                      selectedFeedback.date,
                    )}
                    {selectedFeedback.startTime
                        && selectedFeedback.startTime
                          !== "--:--"
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
                  paddingVertical: hp(10),
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
                        size={fontSize(18)}
                        color="#FFFFFF"
                      />
                    )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: wp(16),
    paddingBottom: hp(24),
  },

  metricCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(12),
    padding: wp(20),
    marginBottom: 14,
  },

  metricTextContainer: {
    flex: 1,
  },

  metricLabel: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },

  metricValue: {
    fontSize: fontSize(32),
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 36,
  },

  metricValue2: {
    color: "#7A3E00",
  },

  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(4),
  },

  trendText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#006B58",
  },

  metricIconBg: {
    width: wp(64),
    height: hp(64),
    borderRadius: wp(999),
    alignItems: "center",
    justifyContent: "center",
  },

  starRow: {
    flexDirection: "row",
    gap: wp(2),
    marginTop: 4,
  },

  starIcon: {
    marginRight: 2,
  },

  tabsContainer: {
    flexDirection: "row",
    gap: wp(8),
    marginVertical: 20,
  },

  tabButton: {
    flex: 1,
    paddingVertical: hp(6),
    borderRadius: wp(999),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  activeTabButton: {
    backgroundColor: "#0B4A6F",
  },

  tabText: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 24,
  },

  activeTabText: {
    color: "#FFFFFF",
  },

  centerState: {
    paddingVertical: hp(40),
    alignItems: "center",
    justifyContent: "center",
  },

  errorText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#DC2626",
    marginBottom: 12,
    textAlign: "center",
  },

  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: wp(20),
    paddingVertical: hp(10),
    borderRadius: wp(10),
  },

  retryBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    fontSize: fontSize(14),
  },

  emptyText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  feedbackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(12),
    padding: wp(20),
    // marginBottom: 14,
  },

  cardHeader: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems:'center'
  },

  userAvatar: {
    width: wp(48),
    height: hp(48),
    borderRadius: wp(24),
    marginRight: 12,
  },

  cardHeaderDetails: {
    flex: 1,
  },

  userName: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },

  tagBadge: {
    paddingHorizontal: wp(8),
    paddingVertical: hp(2),
    borderRadius: wp(10),
  },

  tagBadgeText: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
    lineHeight: 16,

  },

  newBadgeBg: {
    backgroundColor: "#E0F2FE",
  },

  newBadgeText: {
    color: "#0284C7",
  },

  respondedBadgeBg: {
    backgroundColor: "#E2E8F0",
  },

  respondedBadgeText: {
    color: "#64748B",
  },

  commentText: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 22,
    marginBottom: 14,
    marginLeft: wp(60),
  },

  notesText: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 22,
    marginBottom: 14,
    marginLeft: wp(60),
  },

  cardActionsRow: {
    flexDirection: "row",
    gap: wp(10),
  },

  actionBtn: {
    flex: 1,
    height: hp(40),
    borderRadius: wp(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  btnIcon: {
    marginRight: wp(6),
  },

  actionBtnText: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    lineHeight: 18,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
  },

  primaryBtnText: {
    color: "#FFFFFF",
  },

  outlineBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0B4A6F",
  },

  outlineBtnText: {
    color: colors.primary,
  },

  secondaryGrayBtnText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    lineHeight: 18,
  },

  headerMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerLeft: {
    flex: 1,
    paddingRight: wp(8),
  },

  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: wp(6),
  },


  appointmentInfo: {
    alignItems: "flex-end",
    flexShrink: 0,
  },

  detailLine: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 18,
    textAlign: "right",
  },

  detailLabel: {
    fontFamily: fonts.semiBold,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  replyModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: "85%",
    padding: wp(18),
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: fontSize(18),
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
  },

  originalFeedback: {
    backgroundColor: "#F8FAFC",
    borderRadius: wp(10),
    padding: wp(12),
    marginBottom: 10,
  },

  originalFeedbackName: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    marginBottom: 4,
  },

  originalFeedbackText: {
    fontSize: fontSize(14),
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
    paddingHorizontal: wp(13),
    paddingVertical: hp(9),
    borderRadius: wp(16),
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
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
    color: "#64748B",
    marginBottom: 2,
  },

  myReplySenderText: {
    color: "#93C5FD",
    textAlign: "right",
  },

  replyMessage: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 19,
  },

  myReplyMessageText: {
    color: "#FFFFFF",
  },

  replyTime: {
    fontSize: fontSize(10),
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
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 30,
  },

  replyInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: wp(8),
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  replyInput: {
    flex: 1,
    minHeight: hp(46),
    maxHeight: hp(46),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: wp(10),
    paddingHorizontal: wp(12),
    paddingVertical: hp(9),
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  sendReplyBtn: {
    width: wp(46),
    height: hp(46),
    borderRadius: wp(10),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  sendReplyBtnDisabled: {
    opacity: 0.5,
  },

  deleteBtn: {
    backgroundColor: "#AD1C1C",
  },

  deleteBtnText: {
    color: "#FFFFFF",
  },

  deleteBtnSending: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#AD1C1C",
  },

  deleteBtnTextSending: {
    color: "#AD1C1C",
  },

  deleteBtnDisabled: {
    backgroundColor: "#E2E8F0",
    opacity: 0.7,
  },

  deleteBtnTextDisabled: {
    color: "#94A3B8",
  },

  loadingMoreContainer: {
    paddingVertical: hp(20),
    alignItems: "center",
    justifyContent: "center",
  },

  loadingMoreText: {
    marginTop: 6,
    fontSize: fontSize(13),
    color: "#64748B",
    fontFamily: fonts.regular,
  },
  avatarFallback: {
    width: wp(40),
    height: hp(40),
    borderRadius: wp(20),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarFallbackText: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight:24
  },
  pendingBadgeBg: {
    backgroundColor: "#FEF3C7",
  },

  pendingBadgeText: {
    color: "#92400E",
  },
  pendingSessionBox: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: wp(8),
    padding: wp(12),
    marginTop: 10,
    marginBottom: 12,
  },
  pendingSessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(7),
  },
  pendingSessionTitle: {
    fontSize: fontSize(13),
    fontFamily: fonts.medium,
    color: "#B45309",
  },
  pendingSessionDetails: {
    marginTop: 9,
    gap: wp(6),
  },
  pendingSessionDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(7),
  },
  pendingSessionDetailText: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#475569",
  },
});
