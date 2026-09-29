import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import {
  getAllNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import { colors, fonts } from '../../styles/theme';
import NotificationDetailModal from './components/NotificationDetailModal';

const PAGE_SIZE = 15;

const TYPE_META = {
  System: { icon: 'settings', color: '#475569', bg: '#E2E8F0' },
  Appointment: { icon: 'calendar', color: '#0F766E', bg: '#CCFBF1' },
  Therapy: { icon: 'activity', color: '#7C3AED', bg: '#EDE9FE' },
  Message: { icon: 'message-circle', color: '#2563EB', bg: '#DBEAFE' },
  Reminder: { icon: 'bell', color: '#B45309', bg: '#FEF3C7' },
  Alert: { icon: 'alert-triangle', color: '#B91C1C', bg: '#FEE2E2' },
  General: { icon: 'info', color: '#334155', bg: '#F1F5F9' },
};
const getTypeMeta = (type) => TYPE_META[type] || TYPE_META.General;

const ATTACHMENT_ICON = { pdf: 'file-text', image: 'image', doc: 'file' };

const FILTER_OPTIONS = ['All', 'System', 'Appointment', 'Therapy', 'Message', 'Reminder', 'Alert', 'General'];

const timeAgo = (iso) => {
  if (!iso) return '';
  const mins = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const errorMessage = (e, fallback) => e?.response?.data?.message || fallback;

export default function NotificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('Notification');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuTouchRef = useRef(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState('All');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [detailItem, setDetailItem] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchNotifications = useCallback(async ({ pageNum = 1, refresh = false } = {}) => {
    const reqId = ++requestIdRef.current;

    if (refresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const res = await getAllNotifications({ page: pageNum, limit: PAGE_SIZE });
      if (reqId !== requestIdRef.current) return;

      const list = res?.data || [];
      setNotifications((prev) => (pageNum === 1 ? list : [...prev, ...list]));
      setUnreadCount(res?.unreadCount || 0);
      hasMoreRef.current = !!res?.hasMore;
      pageRef.current = pageNum;
    } catch (e) {
      console.log('Failed to fetch notifications:', e);
      if (reqId === requestIdRef.current) {
        Alert.alert('Could not load notifications', errorMessage(e, 'Please try again.'));
      }
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications({ pageNum: 1 });
  }, [fetchNotifications]);

  const onRefresh = () => fetchNotifications({ pageNum: 1, refresh: true });

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;

    if (nearBottom && hasMoreRef.current && !loadingMoreRef.current && !loading && !refreshing) {
      fetchNotifications({ pageNum: pageRef.current + 1 });
    }
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0 || markingAll) return;

    Alert.alert('Mark all as read', `Mark all ${unreadCount} unread notifications as read?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark all read',
        onPress: async () => {
          setMarkingAll(true);
          const previous = notifications;
          const previousUnread = unreadCount;

          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          setUnreadCount(0);

          try {
            const res = await markAllNotificationsRead();
            if (!res?.success) throw new Error(res?.message || 'Failed');
          } catch (e) {
            setNotifications(previous);
            setUnreadCount(previousUnread);
            Alert.alert('Could not update', errorMessage(e, 'Please try again.'));
          } finally {
            setMarkingAll(false);
          }
        },
      },
    ]);
  };
  const handleOpenNotification = async (item) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const res = await markNotificationRead(item._id);
        if (!res?.success) throw new Error(res?.message || 'Failed');
      } catch (e) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: false, readAt: null } : n))
        );
        setUnreadCount((prev) => prev + 1);
        Alert.alert('Could not update', errorMessage(e, 'Please try again.'));
      }
    }

    setDetailItem(item);
    setIsDetailOpen(true);
  };

  const visibleNotifications =
    typeFilter === 'All' ? notifications : notifications.filter((n) => n.type === typeFilter);

  return (
    <SafeAreaView
      style={styles.mainContainer}
      onTouchStart={() => {
        if (menuTouchRef.current) {
          menuTouchRef.current = false;
          return;
        }
        if (activeMenuId) setActiveMenuId(null);
      }}
    >
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={'Manage Notifications'}
      />

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markingAll} style={styles.markAllBtn}>
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = typeFilter === opt;
          const meta = opt === 'All' ? null : getTypeMeta(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.filterChip,
                active && { backgroundColor: meta?.color || colors.primary },
              ]}
              onPress={() => setTypeFilter(opt)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollArea}
        onScrollBeginDrag={() => setActiveMenuId(null)}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.centerLoader} />
        )}

        {!loading && visibleNotifications.length === 0 && (
          <View style={styles.emptyContainer}>
            <Feather name="bell-off" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>
              {typeFilter === 'All'
                ? "You're all caught up — nothing here yet."
                : `No ${typeFilter.toLowerCase()} notifications.`}
            </Text>
          </View>
        )}

        {!loading &&
          visibleNotifications.map((item) => {
            const meta = getTypeMeta(item.type);
            const unread = !item.isRead;

            return (
              <TouchableOpacity
                key={item._id}
                style={[styles.card, unread && styles.cardUnread]}
                activeOpacity={0.7}
                onPress={() => handleOpenNotification(item)}
              >
                <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
                  <Feather name={meta.icon} size={18} color={meta.color} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.cardTitle, unread && styles.cardTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.cardTime}>{timeAgo(item.sentAt || item.createdAt)}</Text>
                  </View>

                  <Text style={styles.cardMessage} numberOfLines={2}>
                    {item.message}
                  </Text>

                  <View style={styles.cardFooterRow}>
                    <View style={[styles.typeTag, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.typeTagText, { color: meta.color }]}>{item.type}</Text>
                    </View>

                    {item.attachment?.url && (
                      <View style={styles.attachmentRow}>
                        <Feather
                          name={ATTACHMENT_ICON[item.attachment.type] || 'paperclip'}
                          size={12}
                          color="#64748B"
                        />
                        <Text style={styles.attachmentText} numberOfLines={1}>
                          {item.attachment.name || 'Attachment'}
                        </Text>
                      </View>
                    )}

                    {/* {item.createdBy?.fullName && (
                      <Text style={styles.fromText} numberOfLines={1}>
                        From {item.createdBy.fullName}
                      </Text>
                    )} */}
                  </View>
                </View>

                {unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}

        {loadingMore && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        )}

        <View style={{ height: insets.bottom + 90 }} />
      </ScrollView>
      <NotificationDetailModal
        visible={isDetailOpen}
        notification={notifications.find((n) => n._id === detailItem?._id) || detailItem}
        onClose={() => setIsDetailOpen(false)}
      />

      <BottomBar
        activeTab={'Notifications'}
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  summaryText: { fontSize: 14, fontFamily: fonts.semiBold, color: '#334155' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  markAllText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  filterScroll: { flexGrow: 0, marginTop: 10 },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },

  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: "center",
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardUnread: { backgroundColor: '#F8FBFF', borderColor: '#DCEBFC' },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: fonts.semiBold, color: '#334155' },
  cardTitleUnread: { color: '#0F172A' },
  cardTime: { fontSize: 11, color: '#94A3B8' },

  cardMessage: { fontSize: 13, color: '#64748B', lineHeight: 18, marginTop: 3 },

  cardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  typeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typeTagText: { fontSize: 10, fontWeight: '700' },

  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
  attachmentText: { fontSize: 11, color: '#64748B' },

  fromText: { fontSize: 11, color: '#94A3B8', marginLeft: 'auto' },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginLeft: 8,
    marginTop: 4,
  },

  centerLoader: { marginVertical: 40 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 19 },
});