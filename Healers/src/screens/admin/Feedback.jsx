import React, { useCallback, useContext, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';
import { addFeedbackReply, getFeedbackReplies, getFeedbackRequests, deleteFeedback } from '../../api/admin/api';
import { therapistSpecialities } from '../../utils/specialities';
import { formatTo12Hour } from '../../utils/hoursformat';
import { AuthContext } from '../../context/AuthContext';

// UI tab label -> backend status value expected by getAdminFeedbackManagement
const TAB_TO_STATUS = {
  'All Feedback': 'all',
  Pending: 'pending',
  New: 'new',
};
const MOOD_OPTIONS = [
  { id: "Frustrated", label: "Frustrated", emoji: "😔" },
  { id: "Neutral", label: "Neutral", emoji: "😐" },
  { id: "Happy", label: "Happy", emoji: "😊" },
  { id: "Excited", label: "Excited", emoji: "🤩" },
];

const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=1';

function mapFeedbackItem(item, status) {
  if (status === 'pending') {
    const person = item.therapistId || item.childId || {};
    return {
      id: item.appointmentId,
      name: person.fullName || 'Unknown',
      role: item.therapistId ? 'Parent' : 'Therapist',
      status: 'New',
      rating: null,
      comment: `Session on ${formatDate(item.session?.date)} (${item.session?.startTime || ''} - ${item.session?.endTime || ''}) is awaiting feedback.`,
      avatar: DEFAULT_AVATAR,
      primaryAction: 'Send Reminder',
      primaryIcon: 'bell',
      actionType: 'primary',
      secondaryAction: 'Delete',
      secondaryIcon: 'trash-2',
      tab:"pending"
    };
  }

  const person = item.therapistId || item.childId || {};
  const role = item.therapistId ? 'Parent' : 'Therapist';

  const createdAt = new Date(item.createdAt);
  const now = new Date();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const itemDate = new Date(createdAt);
  itemDate.setHours(0, 0, 0, 0);

  const isNew = itemDate.getTime() === today.getTime() ||
                itemDate.getTime() === yesterday.getTime();

  return {
    id: item._id,
    name: person.fullName || 'Unknown',
    role,
    rating: typeof item.rating === 'number' ? item.rating : 0,
    comment: item.notes.trim() || item.notes.trim(),
    avatar: DEFAULT_AVATAR,
    primaryAction: item.isRespond ? 'View Reply' : 'Reply',
    primaryIcon: item.isRespond ? undefined : 'corner-up-left',
    actionType: item.isRespond ? 'outline' : 'primary',
    secondaryAction: 'Delete',
    secondaryIcon: 'trash-2',
    isRespond: item.isRespond === true,
    isNew,
    childName: item.childId?.fullName || 'Unknown',
    startTime: item.appointment?.startTime || '--:--',
    moodLabel: item.mood || 'No reaction',
    moodEmoji:
      MOOD_OPTIONS.find((m) => m.id === item.mood)?.emoji || '🙂',

    category: item.category || 'Unknown',

    categoryColor:
      therapistSpecialities.find((s) => s.label === item.category)?.color ||
      '#64748B',

    categoryBg:
      therapistSpecialities.find((s) => s.label === item.category)?.bg ||
      '#F1F5F9',
  };
}

function formatDate(dateStr) {
  if (!dateStr) return 'an upcoming date';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
const handleSendReminder = (item) => {
  console.log('SEND REMINDER:', item.id);
};
export default function FeedbackScreen({ navigation }) {
  // const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('All Feedback');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('');

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
  const [replyText, setReplyText] = useState('');
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const status = TAB_TO_STATUS[activeTab] || 'all';

  const fetchFeedback = useCallback(async ({ isRefresh = false } = {}) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {

      const response = await getFeedbackRequests({ status });
      const payload = response?.data ?? [];

      if (!payload?.success) {
        throw new Error(payload?.message || 'Failed to load feedback');
      }

      const mapped = (payload.data || []).map((item) =>
        mapFeedbackItem(item, status),
      );

      setFeedbackItems(mapped);
      setStats({
        pendingFeedback: payload.stats?.pendingFeedback ?? 0,
        sinceYesterdayFeedback: payload.stats?.sinceYesterdayFeedback ?? 0,
        averageSatisfaction: payload.stats?.averageSatisfaction ?? 0,
      });
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Something went wrong while loading feedback.',
      );
      setFeedbackItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const renderStars = (rating) => {
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      let iconName = 'star-o';

      if (rating >= i) {
        iconName = 'star';
      } else if (rating >= i - 0.5) {
        iconName = 'star-half-o';
      }

      stars.push(
        <FontAwesome
          key={i}
          name={iconName}
          size={14}
          color="#7A3E00"
          style={styles.starIcon}
        />,
      );
    }

    return <View style={styles.starRow}>{stars}</View>;
  };
  const handleViewFeedback = async (item) => {
    setSelectedFeedback(item);
    setReplyModalVisible(true);
    setLoadingReplies(true);
    setReplies([]);

    try {
      const response = await getFeedbackReplies(item.id);
      const sortedReplies = [...(response.data?.replies || [])].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );


      setReplies(sortedReplies);
    } catch (error) {
      console.error('Failed to load replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };
  const handleDeleteFeedback = (item) => {
    console.log(item,"itemmmm");
    Alert.alert(
      'Delete Feedback',
      'This will permanently remove this feedback. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(item.id);
              await deleteFeedback(item.id);
              setFeedbackItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch (error) {
              console.error('Failed to delete feedback:', error);
              Alert.alert('Error', 'Could not delete this feedback. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };


  return (
    <SafeAreaView style={[styles.mainContainer]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={'Manage Feedback'}
      />
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFeedback({ isRefresh: true })}
          />
        }
      >
        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricLabel}>Pending Feedback</Text>
            <Text style={styles.metricValue}>
              {stats.pendingFeedback} Items
            </Text>
            <View style={styles.trendRow}>
              <Feather name="trending-down" size={14} color="#006B58" />
              <Text style={styles.trendText}>
                {stats.sinceYesterdayFeedback} since yesterday
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.metricIconBg,
              { backgroundColor: 'rgba(22,105,169,.1)' },
            ]}
          >
            <MaterialCommunityIcons
              name="clipboard-clock-outline"
              size={28}
              color={colors.primary}
            />
          </View>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricLabel}>Average Satisfaction</Text>
            <Text style={[styles.metricValue, styles.metricValue2]}>
              {Number(stats.averageSatisfaction).toFixed(1)} / 5.0
            </Text>
            {renderStars(stats.averageSatisfaction)}
          </View>
          <View
            style={[
              styles.metricIconBg,
              { backgroundColor: 'rgba(255,220,196,.3)' },
            ]}
          >
            <Feather name="smile" size={28} color="#7A3E00" />
          </View>
        </View>

        <View style={styles.tabsContainer}>
          {Object.keys(TAB_TO_STATUS).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.activeTabButton]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[styles.tabText, isActive && styles.activeTabText]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchFeedback()}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && feedbackItems.length === 0 && (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>No feedback to show here.</Text>
          </View>
        )}

        {!loading &&
          !error &&
          feedbackItems.map((item) => (
            <View key={item.id} style={styles.feedbackCard}>
              <View style={styles.cardHeader}>
                <Image
                  source={{ uri: item.avatar }}
                  style={styles.userAvatar}
                />

                <View style={styles.cardHeaderDetails}>
                  <View style={styles.headerMainRow}>
                    {/* LEFT SIDE */}
                    <View style={styles.headerLeft}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={styles.userName}>{item.name}</Text>

                        <View
                          style={[
                            styles.tagBadge,
                            item.isRespond
                              ? styles.respondedBadgeBg
                              : styles.newBadgeBg,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tagBadgeText,
                              item.isRespond
                                ? styles.respondedBadgeText
                                : styles.newBadgeText,
                            ]}
                          >
                            {item.isRespond ? 'Responded' : 'New'}
                          </Text>
                        </View>
                      </View>

                      {item.rating != null && renderStars(item.rating)}
                      {/* {item.tab !== 'pending' && (
                        <View
                          style={[
                            styles.categoryBadge,
                            { backgroundColor: item.categoryBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryBadgeText,
                              { color: item.categoryColor },
                            ]}
                          >
                            {item.category}
                          </Text>
                        </View>
                      )} */}
                    </View>

                    {/* RIGHT SIDE */}
                    {item.tab !== 'pending' && (
                      <View style={styles.appointmentInfo}>
                        <Text style={styles.detailLine}>
                          <Text style={styles.detailLabel}>For: </Text>
                          {item.childName}
                        </Text>

                        <Text style={styles.detailLine}>
                          <Text style={styles.detailLabel}>Appt: </Text>
                          {formatTo12Hour(item.startTime)}
                        </Text>

                        <Text style={styles.detailLine}>
                          <Text style={styles.detailLabel}>Reaction: </Text>
                          {item.moodEmoji} {item.moodLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <Text style={item.comment?styles.commentText:styles.notesText}>{item.comment??item.notes}</Text>
              

              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    item.actionType === 'primary'
                      ? styles.primaryBtn
                      : styles.outlineBtn,
                  ]}
                  onPress={() => {
                    if (
                      item.primaryAction === 'Reply' ||
                      item.primaryAction === 'View Reply'
                    ) {
                      handleViewFeedback(item);
                    } else if (item.primaryAction === 'Send Reminder') {
                      handleSendReminder(item);
                    }
                  }}
                >
                  {item.primaryIcon && (
                    <Feather
                      name={item.primaryIcon}
                      size={16}
                      color={
                        item.actionType === 'primary' ? '#ffffff' : '#0B4A6F'
                      }
                      style={styles.btnIcon}
                    />
                  )}

                  <Text
                    style={[
                      styles.actionBtnText,
                      item.actionType === 'primary'
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
                    deletingId === item.id ? styles.deleteBtnSending : styles.deleteBtn,
                    item.tab === 'pending' && styles.deleteBtnPending,
                  ]}
                  disabled={item.tab === 'pending' || deletingId === item.id}
                  onPress={() => {
                    if (item.tab !== 'pending') {
                      handleDeleteFeedback(item);
                    }
                  }}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#DC2626" style={styles.btnIcon} />
                  ) : (
                    <Feather
                      name={item.secondaryIcon || 'trash-2'}
                      size={16}
                      color="#FFFFFF"
                      style={styles.btnIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.secondaryGrayBtnText,
                      deletingId === item.id ? styles.deleteBtnTextSending : styles.deleteBtnText,
                    ]}
                  >
                    {item.secondaryAction || 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </ScrollView>
      <Modal
        visible={replyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.replyModal}>

            {/* HEADER */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Feedback Replies
              </Text>

              <TouchableOpacity
                onPress={() => setReplyModalVisible(false)}
              >
                <Feather
                  name="x"
                  size={22}
                  color="#334155"
                />
              </TouchableOpacity>
            </View>

            {/* FEEDBACK */}
            {selectedFeedback && (
              <View style={styles.originalFeedback}>
                <Text style={styles.originalFeedbackName}>
                  {selectedFeedback.name}
                </Text>

                <Text style={styles.originalFeedbackText}>
                  {selectedFeedback.comment}
                </Text>
                <Text style={styles.originalFeedbackText}>
                  Appt : {formatTo12Hour(selectedFeedback.startTime)}
                </Text>
              </View>
            )}

            {/* REPLIES */}
            <ScrollView
              style={styles.repliesList}
              contentContainerStyle={{ paddingVertical: 10 }}
            >
              {loadingReplies ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              ) : replies.length === 0 ? (
                <Text style={styles.noRepliesText}>
                  No replies yet.
                </Text>
              ) : (
                replies.map((reply) => {
                  const isMyReply = reply.repliedBy.id === user.id;
                  return (
                    <View
                      key={reply._id}
                      style={[
                        styles.replyRow,
                        isMyReply ? styles.myReplyRow : styles.otherReplyRow,
                      ]}
                    >
                      <View
                        style={[
                          styles.replyBubble,
                          isMyReply ? styles.myReplyBubble : styles.otherReplyBubble,
                        ]}
                      >
                        <Text style={[styles.replySender, isMyReply && styles.myReplySenderText]}>
                          {isMyReply
                            ? 'You'
                            : reply.repliedBy?.fullName || reply.repliedByRole}
                        </Text>

                        <Text style={[styles.replyMessage, isMyReply && styles.myReplyMessageText]}>
                          {reply.message}
                        </Text>

                        <Text style={[styles.replyTime, isMyReply && styles.myReplyTimeText]}>
                          {new Date(reply.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* REPLY INPUT */}
            <View style={styles.replyInputRow}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Write a reply..."
                placeholderTextColor="#94A3B8"
                multiline
                style={styles.replyInput}
              />

              <TouchableOpacity
                disabled={sendingReply || !replyText.trim()}
                onPress={async () => {
                  if (!selectedFeedback || !replyText.trim()) {
                    return;
                  }

                  try {
                    setSendingReply(true);

                    const response = await addFeedbackReply(
                      selectedFeedback.id,
                      replyText.trim()
                    );

                    setReplies(
                      [...(response.data?.replies || [])].sort(
                        (a, b) =>
                          new Date(a.createdAt) -
                          new Date(b.createdAt)
                      )
                    );

                    setReplyText('');
                  } catch (error) {
                    console.error('Failed to send reply:', error);
                  } finally {
                    setSendingReply(false);
                  }
                }}
                style={styles.sendReplyBtn}
              >
                {sendingReply ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
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

      <BottomBar
        activeTab={''}
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  metricCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
  },
  metricTextContainer: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },
  metricValue: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 36,
  },
  metricValue2: {
    color: '#7A3E00',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#006B58',
  },
  metricIconBg: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  starRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  starIcon: {
    marginRight: 2,
  },

  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#0B4A6F',
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 24,
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  cardHeaderDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  parentBadgeBg: { backgroundColor: '#D1FAE5' },
  parentBadgeText: { color: '#059669' },
  therapistBadgeBg: { backgroundColor: '#FFEDD5' },
  therapistBadgeText: { color: '#C2410C' },
  newBadgeBg: { backgroundColor: '#E0F2FE' },
  newBadgeText: { color: '#0284C7' },
  respondedBadgeBg: { backgroundColor: '#E2E8F0' },
  respondedBadgeText: { color: '#64748B' },

  commentText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 22,
    marginBottom: 14,
    marginLeft:60,
  },
  notesText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    marginLeft:30,
    backgroundColor:"#8e9289",
    marginLeft:60,
  },

  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    marginRight: 6,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    color: '#FFFFFF',
  },
  outlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0B4A6F',
  },
  outlineBtnText: {
    color: colors.primary,
  },
  secondaryGrayBtn: {
    backgroundColor: '#F1F5F9',
  },
  secondaryGrayBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: colors.blackFont,
  },
  headerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },

  appointmentInfo: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },

  detailLine: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 18,
    textAlign: 'right',
  },

  detailLabel: {
    fontFamily: fonts.semiBold,
  },

  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 14,
  },

  categoryBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  replyModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: '85%',
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
  },

  originalFeedback: {
    backgroundColor: '#F8FAFC',
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
    color: '#475569',
    lineHeight: 20,
  },

  repliesList: {
    flex: 1,
  },

  replyRow: {
    width: '100%',
    marginVertical: 4,
  },

  adminReplyRow: {
    alignItems: 'flex-end',
  },

  otherReplyRow: {
    alignItems: 'flex-start',
  },

  replyBubble: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
  },

  adminReplyBubble: {
    backgroundColor: '#E0F2FE',
    borderTopRightRadius: 3,
  },
  myReplyBubble: {
    backgroundColor: '#0B4A6F', 
    borderBottomRightRadius: 2, 
  },

  otherReplyBubble: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 2,   
  },

  replySender: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#64748B',
    marginBottom: 2,
  },

  myReplySenderText: {
    color: '#93C5FD', // Light accent color for your header name
    textAlign: 'right',
  },

  replyMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 19,
  },

  myReplyMessageText: {
    color: '#FFFFFF', // White text on dark primary bubble
  },

  replyTime: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: '#94A3B8',
    marginTop: 4,
  },

  myReplyTimeText: {
    color: '#E2E8F0',
    textAlign: 'right',
  },
  myReplyRow: {
    alignItems: 'flex-end',
  },

  noRepliesText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#64748B',
    marginTop: 30,
  },

  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  replyInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#ad1c1ce0',
  },
  deleteBtnText: {
    color: '#FFFFFF',
  },
  deleteBtnSending: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ad1c1ce0',
  },
  deleteBtnTextSending: {
    color: '#ad1c1ce0',
  },
  deleteBtnPending: {
    opacity: 0.5,
  },
});