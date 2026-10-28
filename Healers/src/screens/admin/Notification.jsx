import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import {
  deleteBroadcast,
  getAllNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/admin/api';
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
import NotificationDetailModal from './components/NotificationDetailModal';

const PAGE_SIZE = 15;
const TYPES = {
  System: { icon: "settings", color: "#64748B", bg: "#F1F5F9" },
  Appointment: { icon: "calendar", color: "#0D9488", bg: "#CCFBF1" },
  Therapy: { icon: "activity", color: "#8B5CF6", bg: "#EDE9FE" },
  Message: { icon: "message-circle", color: "#3B82F6", bg: "#DBEAFE" },
  Reminder: { icon: "bell", color: "#D97706", bg: "#FEF3C7" },
  Alert: { icon: "alert-triangle", color: "#DC2626", bg: "#FEE2E2" },
  General: { icon: "info", color: "#64748B", bg: "#F1F5F9" },
};
const FILTERS = ["All", ...Object.keys(TYPES)];
const getMeta = type => TYPES[type] || TYPES.General;
const timeAgo = value => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const errorText = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const userID = user?.id || user?._id;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const busyRef = useRef(false);
  const requestRef = useRef(0);

  const fetchNotifications = useCallback(async (page = 1, refresh = false) => {
    const request = ++requestRef.current;
    busyRef.current = true;
    if (refresh) setRefreshing(true);
    else if (page === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getAllNotifications({ page, limit: PAGE_SIZE, typeFilter });
      if (request !== requestRef.current) return;
      const items = Array.isArray(res?.data) ? res.data : [];
      setNotifications(prev => page === 1 ? items : [...prev, ...items.filter(n => !prev.some(p => p._id === n._id))]);
      setUnreadCount(res?.unreadCount ?? 0);
      hasMoreRef.current = !!res?.hasMore;
      pageRef.current = page;
    } catch (e) {
      if (request === requestRef.current) Alert.alert("Unable to load", errorText(e, "Please try again."));
    } finally {
      if (request === requestRef.current) {
        busyRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [typeFilter]);

  useEffect(() => {
    hasMoreRef.current = true;
    fetchNotifications(1);
    return () => {
      requestRef.current += 1;
    };
  }, [fetchNotifications]);

  const loadMore = () => {
    if (!busyRef.current && !loading && !refreshing && hasMoreRef.current) {
      fetchNotifications(pageRef.current + 1);
    }
  };

  const markAll = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await markAllNotificationsRead();
      if (!res?.success) throw new Error(res?.message || "Please try again.");
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      Alert.alert("Unable to update", errorText(e, "Please try again."));
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async item => {
    setDetailItem(item);
    if (item.isRead) return;
    setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      const res = await markNotificationRead(item._id);
      if (!res?.success) throw new Error(res?.message || "Please try again.");
    } catch (e) {
      setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: false } : n));
      setUnreadCount(prev => prev + 1);
      Alert.alert("Unable to update", errorText(e, "Please try again."));
    }
  };

  const deleteNotification = async () => {
    if (!deleteItem || deleting) return;
    setDeleting(true);
    try {
      const res = await deleteBroadcast(deleteItem._id, true, userID);
      if (!res?.data?.success) throw new Error(res?.data?.message || "Could not delete notification.");
      setNotifications(prev => prev.filter(n => n._id !== deleteItem._id));
      if (!deleteItem.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
      if (detailItem?._id === deleteItem._id) setDetailItem(null);
      setDeleteItem(null);
    } catch (e) {
      Alert.alert("Delete failed", errorText(e, "Please try again."));
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = ({ item }) => {
    const meta = getMeta(item.type);
    const unread = !item.isRead;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, unread && styles.unreadCard]}
        onPress={() => openNotification(item)}
      >
        <View style={[styles.typeIcon, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon} size={wp(21)} color={meta.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, unread && styles.cardTitleUnread]} numberOfLines={2}>
              {item.title || "Notification"}
            </Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          <View style={styles.cardBottom}>
            <View style={[styles.tag, { backgroundColor: meta.bg }]}>
              <Text style={[styles.tagText, { color: meta.color }]}>{item.type || "General"}</Text>
            </View>
            {item.attachment?.url && <Feather name="paperclip" size={wp(13)} color="#94A3B8" />}
            <Text style={styles.timeText}>{timeAgo(item.sentAt || item.createdAt)}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setDeleteItem(item)}
          style={styles.deleteIcon}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityLabel="Delete notification"
        >
          <Feather name="trash-2" size={wp(17)} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen,commonStyles.container]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIcon}>
            <Feather name="bell" size={wp(23)} color={colors.primary} />
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.heading}>Notifications</Text>
            <Text style={styles.subtitle}>Stay updated with what's new</Text>
          </View>
        </View>
        <View style={styles.summary}>
          <View style={styles.unreadSummary}>
            <View style={styles.summaryDot} />
            <Text style={styles.summaryLabel}>
              {unreadCount
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "You’re all caught up!"}
            </Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAll} disabled={markingAll} style={styles.markAll}>
              {markingAll
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name="check-check" size={wp(15)} color={colors.primary} />}
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filtersWrap}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={x => x}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const selected = typeFilter === item;
            return (
              <TouchableOpacity
                style={[styles.chip, selected && styles.selectedChip]}
                onPress={() => setTypeFilter(item)}
              >
                <Text style={[styles.chipText, selected && styles.selectedChipText]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={loading ? [] : notifications}
        keyExtractor={item => String(item._id)}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + hp(25) },
          !loading && !notifications.length && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchNotifications(1, true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={loading
          ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )
          : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="bell-off" size={wp(35)} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyDescription}>
                {typeFilter === "All"
                  ? "New notifications will appear here when they arrive."
                  : `You don't have any ${typeFilter.toLowerCase()} notifications.`}
              </Text>
            </View>
          )}
        ListFooterComponent={loadingMore
          ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
          : null}
      />

      <NotificationDetailModal
        visible={!!detailItem}
        notification={notifications.find(n => n._id === detailItem?._id) || detailItem}
        onClose={() => setDetailItem(null)}
      />

      <Modal
        transparent
        visible={!!deleteItem}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !deleting && setDeleteItem(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dangerIcon}>
              <Feather name="trash-2" size={wp(28)} color="#DC2626" />
            </View>
            <Text style={styles.dialogTitle}>Delete notification?</Text>
            <Text style={styles.dialogDescription}>
              Are you sure you want to delete this notification? This action cannot be undone.
            </Text>
            <View style={styles.itemPreview}>
              <Text style={styles.previewText} numberOfLines={2}>{deleteItem?.title}</Text>
            </View>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteItem(null)} disabled={deleting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={deleteNotification} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Feather name="trash-2" size={wp(16)} color="#FFFFFF" />
                    <Text style={styles.confirmText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop:hp(10)},
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: wp(20), paddingTop: hp(16), paddingBottom: hp(16) },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  headerIcon: {
    width: wp(48),
    height: wp(48),
    borderRadius: wp(15),
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(12),
  },
  headerTextBlock: { flex: 1 },
  heading: { fontSize: fontSize(23), fontFamily: fonts.bold, color: "#0F172A" },
  subtitle: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8", marginTop: hp(2) },
  summary: { marginTop: hp(19), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unreadSummary: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  summaryDot: { width: wp(7), height: wp(7), borderRadius: wp(4), backgroundColor: colors.primary, marginRight: wp(8) },
  summaryLabel: { fontSize: fontSize(12), fontFamily: fonts.medium, color: "#64748B" },
  markAll: { flexDirection: "row", alignItems: "center", gap: wp(5), paddingLeft: wp(8) },
  markAllText: { fontSize: fontSize(12), fontFamily: fonts.semibold, color: colors.primary },
  filtersWrap: {
    backgroundColor: "#FFFFFF",
    paddingBottom: hp(15),
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  filters: { paddingHorizontal: wp(20), gap: wp(8) },
  chip: {
    paddingHorizontal: wp(17),
    paddingVertical: hp(9),
    borderRadius: wp(22),
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize(12), fontFamily: fonts.medium, color: "#64748B" },
  selectedChipText: { fontFamily: fonts.semibold, color: "#FFFFFF" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: wp(18), paddingTop: hp(16) },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: wp(14),
    marginBottom: hp(11),
    backgroundColor: "#FFFFFF",
    borderRadius: wp(17),
    borderWidth: 1,
    borderColor: "#EDF1F7",
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 9,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: "#F9FBFF",
    borderColor: "#DCE8FF",
    borderLeftWidth: wp(3),
    borderLeftColor: colors.primary,
  },
  typeIcon: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(12),
  },
  cardContent: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: wp(7) },
  cardTitle: { flex: 1, fontSize: fontSize(14), fontFamily: fonts.medium, color: "#334155" },
  cardTitleUnread: { fontFamily: fonts.bold, color: "#0F172A" },
  unreadDot: { width: wp(7), height: wp(7), borderRadius: wp(4), backgroundColor: colors.primary },
  message: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    lineHeight: hp(19),
    color: "#64748B",
    marginTop: hp(5),
  },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: wp(7), marginTop: hp(11) },
  tag: { paddingHorizontal: wp(9), paddingVertical: hp(4), borderRadius: wp(7) },
  tagText: { fontSize: fontSize(10), fontFamily: fonts.semibold },
  timeText: { marginLeft: "auto", fontSize: fontSize(10), fontFamily: fonts.regular, color: "#94A3B8" },
  deleteIcon: { padding: wp(5), marginLeft: wp(4) },
  loadingWrap: { paddingTop: hp(90) },
  footerLoader: { marginVertical: hp(16) },
  emptyState: { alignItems: "center", paddingHorizontal: wp(25) },
  emptyIcon: {
    width: wp(90),
    height: wp(90),
    borderRadius: wp(45),
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(20),
  },
  emptyTitle: { fontSize: fontSize(18), fontFamily: fonts.bold, color: "#0F172A" },
  emptyDescription: {
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: hp(21),
    marginTop: hp(7),
  },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", paddingHorizontal: wp(25) },
  dialog: { backgroundColor: "#FFFFFF", borderRadius: wp(24), padding: wp(24), alignItems: "center" },
  dangerIcon: {
    width: wp(70),
    height: wp(70),
    borderRadius: wp(35),
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(17),
  },
  dialogTitle: { fontSize: fontSize(19), fontFamily: fonts.bold, color: "#0F172A" },
  dialogDescription: {
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#64748B",
    lineHeight: hp(21),
    textAlign: "center",
    marginTop: hp(9),
  },
  itemPreview: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: wp(12),
    padding: wp(13),
    marginTop: hp(18),
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  previewText: { fontSize: fontSize(12), fontFamily: fonts.medium, color: "#475569", textAlign: "center" },
  dialogActions: { flexDirection: "row", gap: wp(10), marginTop: hp(22), width: "100%" },
  cancelButton: {
    flex: 1,
    height: hp(48),
    borderRadius: wp(12),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  cancelText: { fontSize: fontSize(14), fontFamily: fonts.semibold, color: "#475569" },
  confirmButton: {
    flex: 1,
    height: hp(48),
    borderRadius: wp(12),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: wp(7),
    backgroundColor: "#DC2626",
  },
  confirmText: { fontSize: fontSize(14), fontFamily: fonts.semibold, color: "#FFFFFF" },
});
