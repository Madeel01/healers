import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  getComplaintMessages,
  getComplaints,
  resolveComplaint,
  sendComplaintMessage,
  updateComplaintPriority,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';

const PAGE_SIZE = 10;
const CHAT_POLL_MS = 6000;

const AVATAR_COLORS = [
  "#0B4A6F",
  "#7C3AED",
  "#DC2626",
  "#059669",
  "#D97706",
  "#DB2777",
  "#2563EB",
  "#0891B2",
  "#65A30D",
  "#9333EA",
  "#EA580C",
  "#0D9488",
];

const getAvatarColor = (str = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const timeAgo = (iso) => {
  if (!iso) return "";
  const mins = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const mapComplaint = (c) => ({
  id: c._id || c.id,
  title: c.title || "",
  description: c.description || "",
  status: c.status,
  priority: c.priority,
  role: c.complainantRole,
  name: c.complainantId?.fullName || "Unknown user",
  createdAt: c.createdAt,
  resolvedByName: c.resolvedBy?.fullName || null,
  resolvedAt: c.resolvedAt || null,
  resolutionNote: c.resolutionNote || "",
  unreadCount: c.unreadCount || 0,
});

const errorMessage = (e, fallback) => e?.response?.data?.message || fallback;

export default function ComplainManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("");
  const [draft, setDraft] = useState({ status: "All", priority: "All", role: "All" });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [detailComplaint, setDetailComplaint] = useState(null);
  const [resolveNote, setResolveNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [chatComplaint, setChatComplaint] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef(null);

  const requestIdRef = useRef(0);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const filtersActive = priorityFilter !== "All" || roleFilter !== "All";

  const fetchComplaints = useCallback(
    async ({ pageNum = 1, refresh = false, silent = false } = {}) => {
      const reqId = ++requestIdRef.current;

      if (pageNum === 1) loadingMoreRef.current = false;

      if (!silent) {
        if (refresh) setRefreshing(true);
        else if (pageNum === 1) setLoading(true);
        else {
          loadingMoreRef.current = true;
          setLoadingMore(true);
        }
      }

      try {
        const res = await getComplaints({
          page: pageNum,
          limit: PAGE_SIZE,
          search: searchQuery.trim(),
          status: statusFilter === "All" ? "" : statusFilter,
          priority: priorityFilter === "All" ? "" : priorityFilter,
          role: roleFilter === "All" ? "" : roleFilter,
        });

        if (reqId !== requestIdRef.current) return; // a newer request replaced this one

        const list = (res?.data || []).map(mapComplaint);
        setComplaints((prev) => (pageNum === 1 ? list : [...prev, ...list]));
        if (res?.stats) setStats(res.stats);
        hasMoreRef.current = !!res?.hasMore;
        pageRef.current = pageNum;
      } catch (e) {
        console.log("Failed to fetch complaints:", e);
        if (reqId === requestIdRef.current && !silent) {
          Alert.alert("Could not load complaints", errorMessage(e, "Please try again."));
        }
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [searchQuery],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchComplaints({ pageNum: 1 }), 400);
    return () => clearTimeout(t);
  }, [fetchComplaints]);

  const onRefresh = () => fetchComplaints({ pageNum: 1, refresh: true });

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;

    if (nearBottom && hasMoreRef.current && !loadingMoreRef.current && !loading && !refreshing) {
      fetchComplaints({ pageNum: pageRef.current + 1 });
    }
  };

  const applyUpdated = (updated) => {
    setComplaints((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, unreadCount: c.unreadCount } : c)));
    setDetailComplaint((prev) => (prev && prev.id === updated.id ? updated : prev));
    fetchComplaints({ pageNum: 1, silent: true });
  };

  const doResolve = async (item, note = "") => {
    setActionLoading(true);
    try {
      const res = await resolveComplaint(item.id, note.trim());
      if (!res?.success) {
        Alert.alert("Could not resolve", res?.message || "Please try again.");
        return;
      }
      applyUpdated(mapComplaint(res.data));
      setResolveNote("");
    } catch (e) {
      Alert.alert("Could not resolve", errorMessage(e, "Please try again."));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmQuickResolve = (item) => {
    Alert.alert("Resolve complaint", `Mark "${item.title}" as resolved?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", onPress: () => doResolve(item) },
    ]);
  };

  const handleTogglePriority = async (item) => {
    const next = item.priority === "High" ? "Normal" : "High";
    setActionLoading(true);
    try {
      const res = await updateComplaintPriority(item.id, next);
      if (!res?.success) {
        Alert.alert("Could not update", res?.message || "Please try again.");
        return;
      }
      applyUpdated(mapComplaint(res.data));
    } catch (e) {
      Alert.alert("Could not update", errorMessage(e, "Please try again."));
    } finally {
      setActionLoading(false);
    }
  };

  const openDetails = (item) => {
    setResolveNote("");
    setDetailComplaint(item);
  };
  const closeDetails = () => {
    setDetailComplaint(null);
    setResolveNote("");
  };

  const loadMessages = useCallback(async (complaintId, { silent = false } = {}) => {
    if (!silent) setChatLoading(true);
    try {
      const res = await getComplaintMessages(complaintId);
      setMessages(res?.data?.messages || []);
    } catch (e) {
      if (!silent) Alert.alert("Could not load messages", errorMessage(e, "Please try again."));
    } finally {
      if (!silent) setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!chatComplaint?.id) return undefined;
    const id = chatComplaint.id;

    loadMessages(id);
    const timer = setInterval(() => loadMessages(id, { silent: true }), CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [chatComplaint?.id, loadMessages]);

  const openChat = (item) => {
    setDetailComplaint(null);
    setMessages([]);
    setMessageText("");
    setChatComplaint(item);
    setComplaints((prev) => prev.map((c) => (c.id === item.id ? { ...c, unreadCount: 0 } : c)));
  };

  const closeChat = () => {
    setChatComplaint(null);
    setMessages([]);
    setMessageText("");
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || sending || !chatComplaint) return;

    setSending(true);
    try {
      const res = await sendComplaintMessage(chatComplaint.id, text);
      if (res?.success && res.data) {
        setMessages((prev) => [...prev, res.data]);
        setMessageText("");
      } else {
        Alert.alert("Message not sent", res?.message || "Please try again.");
      }
    } catch (e) {
      Alert.alert("Message not sent", errorMessage(e, "Please try again."));
    } finally {
      setSending(false);
    }
  };

  const StatCard = ({ label, value, filterValue }) => {
    const active = statusFilter === filterValue;
    return (
      <TouchableOpacity
        style={[styles.statCard, active && styles.statCardActive]}
        activeOpacity={0.8}
        onPress={() => setStatusFilter(filterValue)}
      >
        <Text style={[styles.statLabel, active && styles.statLabelActive]}>{label}</Text>
        <Text style={[styles.statNumber, active && styles.statNumberActive]}>{value}</Text>
      </TouchableOpacity>
    );
  };

  const StatusBadge = ({ item }) => {
    const resolved = item.status === "Resolved";
    return (
      <View style={[styles.statusBadge, resolved ? styles.resolvedBg : styles.pendingBg]}>
        <Text style={[styles.statusBadgeText, resolved ? styles.resolvedText : styles.pendingText]}>
          {item.status}
        </Text>
      </View>
    );
  };

  const PriorityBadge = () => (
    <View style={[styles.statusBadge, styles.highPriorityBg]}>
      <Text style={[styles.statusBadgeText, styles.highPriorityText]}>! High priority</Text>
    </View>
  );

  const renderChatSheet = () => {
    const readOnly = chatComplaint?.status === "Resolved";

    return (
      <Modal visible={!!chatComplaint} transparent animationType="slide" onRequestClose={closeChat}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.chatSheet}>
            <View style={styles.chatHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {chatComplaint?.name}
                </Text>
                <Text style={styles.chatSubTitle} numberOfLines={1}>
                  {chatComplaint?.title}
                </Text>
              </View>
              <TouchableOpacity onPress={closeChat} hitSlop={8}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={chatScrollRef}
              style={styles.chatBody}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {chatLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />}

              {!chatLoading && messages.length === 0 && (
                <Text style={styles.chatEmpty}>
                  No messages yet. Send the first message to {chatComplaint?.name}.
                </Text>
              )}

              {messages.map((m, index) => {
                const mine = m.senderRole === "Admin";
                return (
                  <View
                    key={`${m._id || m.id || m.$oid}-${index}`}
                    style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
                  >
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
                      <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                        {formatTime(m.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {readOnly
              ? (
                <View style={[styles.readOnlyBanner, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <Feather name="lock" size={14} color="#64748B" />
                  <Text style={styles.readOnlyText}>
                    This complaint is resolved. The conversation is read-only.
                  </Text>
                </View>
              )
              : (
                <View style={[styles.chatInputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#94A3B8"
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!messageText.trim() || sending) && { opacity: 0.5 }]}
                    onPress={handleSend}
                    disabled={!messageText.trim() || sending}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Feather name="send" size={18} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const renderDetailsModal = () => {
    const item = detailComplaint;
    const resolved = item?.status === "Resolved";

    return (
      <Modal visible={!!item} transparent animationType="slide" onRequestClose={closeDetails}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.detailSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complaint details</Text>
              <TouchableOpacity onPress={closeDetails} hitSlop={8}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {item && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.badgeRow}>
                  <StatusBadge item={item} />
                  {item.priority === "High" && <PriorityBadge />}
                </View>

                <Text style={styles.detailTitle}>{item.title}</Text>
                <Text style={styles.detailDescription}>{item.description}</Text>

                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>From</Text>
                    <Text style={styles.metaValue}>
                      {item.name} ({item.role})
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Submitted</Text>
                    <Text style={styles.metaValue}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Priority</Text>
                    <Text style={styles.metaValue}>{item.priority}</Text>
                  </View>
                </View>

                {resolved
                  ? (
                    <View style={styles.resolvedBox}>
                      <View style={styles.resolvedHeaderRow}>
                        <Feather name="check-circle" size={16} color="#059669" />
                        <Text style={styles.resolvedTitle}>
                          Resolved by {item.resolvedByName || "an admin"}
                        </Text>
                      </View>
                      <Text style={styles.resolvedMeta}>{formatDateTime(item.resolvedAt)}</Text>
                      {!!item.resolutionNote && <Text style={styles.resolvedNote}>{item.resolutionNote}</Text>}
                    </View>
                  )
                  : (
                    <>
                      <Text style={styles.fieldLabel}>Resolution note (optional)</Text>
                      <TextInput
                        style={styles.noteInput}
                        placeholder="What was done to resolve this?"
                        placeholderTextColor="#94A3B8"
                        value={resolveNote}
                        onChangeText={setResolveNote}
                        multiline
                        maxLength={500}
                      />
                    </>
                  )}

                <View style={styles.detailActions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => openChat(item)}>
                    <Ionicons name="chatbox-outline" size={16} color="#0B4A6F" />
                    <Text style={styles.secondaryBtnText}>{resolved ? "View chat" : "Open chat"}</Text>
                  </TouchableOpacity>

                  {!resolved && (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => handleTogglePriority(item)}
                      disabled={actionLoading}
                    >
                      <Feather name="flag" size={16} color="#0B4A6F" />
                      <Text style={styles.secondaryBtnText}>
                        {item.priority === "High" ? "Set normal" : "Set high"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!resolved && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, actionLoading && { opacity: 0.6 }]}
                    onPress={() => doResolve(item, resolveNote)}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Text style={styles.primaryBtnText}>Mark as resolved</Text>}
                  </TouchableOpacity>
                )}
                <View style={{ height: 8 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const FilterChips = ({ options, value, onChange }) => (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.chipBtn, value === opt.value && styles.chipBtnActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.chipText, value === opt.value && styles.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  const openFilterModal = () => {
    setDraft({ status: statusFilter, priority: priorityFilter, role: roleFilter });
    setIsFilterModalOpen(true);
  };
  const applyFilters = () => {
    setStatusFilter(draft.status);
    setPriorityFilter(draft.priority);
    setRoleFilter(draft.role);
    setIsFilterModalOpen(false);
  };
  const resetDraft = () => setDraft({ status: "All", priority: "All", role: "All" });

  return (
    <SafeAreaView style={styles.mainContainer}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Back to dashboard"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.pageTitle}>Complain Management</Text>

        <View style={styles.statsRow}>
          <StatCard label="Total" value={stats.total} filterValue="All" />
          <StatCard label="Pending" value={stats.pending} filterValue="Pending" />
          <StatCard label="Resolved" value={stats.resolved} filterValue="Resolved" />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search complaints or people..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, filtersActive && styles.filterBtnActive]}
            onPress={openFilterModal}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={filtersActive ? "#FFFFFF" : "#334155"}
            />
          </TouchableOpacity>
        </View>

        {loading && complaints.length === 0 && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.centerLoader} />
        )}

        {!loading && complaints.length === 0 && (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No complaints found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || filtersActive || statusFilter !== "All"
                ? "Nothing matches your search or filters."
                : "Complaints raised by therapists and children will appear here."}
            </Text>
          </View>
        )}

        {complaints.map((item) => {
          const resolved = item.status === "Resolved";
          return (
            <View key={item.id} style={styles.complaintCard}>
              <View style={styles.userHeader}>
                <View style={styles.avatarWrapper}>
                  <View style={[styles.userAvatar, { backgroundColor: getAvatarColor(item.name) }]}>
                    <Text style={styles.userAvatarText}>
                      {item.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View style={styles.roleIconBadge}>
                    <Feather
                      name={item.role === "Therapist" ? "briefcase" : "smile"}
                      size={9}
                      color="#FFFFFF"
                    />
                  </View>
                </View>

                <View style={styles.userDetails}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.badgeTimeCol}>
                  <StatusBadge item={item} />
                  {item.priority === "High" && !resolved && <PriorityBadge />}
                  <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>

              <Text style={styles.complaintTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.complaintDescription} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.viewDetailsBtn} onPress={() => openDetails(item)}>
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <Feather name="chevron-right" size={16} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconActionBtn} onPress={() => openChat(item)}>
                  <Ionicons name="chatbox-outline" size={18} color="#0B4A6F" />
                  {item.unreadCount > 0 && <View style={styles.unreadDot} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.iconActionBtn, styles.greenIconBtn, resolved && { opacity: 0.45 }]}
                  onPress={() => confirmQuickResolve(item)}
                  disabled={resolved || actionLoading}
                >
                  <Feather name="check-circle" size={18} color="#059669" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {loadingMore && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Filter modal */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter complaints</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>Status</Text>
            <FilterChips
              value={draft.status}
              onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
              options={[
                { label: "All", value: "All" },
                { label: "Pending", value: "Pending" },
                { label: "Resolved", value: "Resolved" },
              ]}
            />

            <Text style={styles.filterSectionLabel}>Priority</Text>
            <FilterChips
              value={draft.priority}
              onChange={(v) => setDraft((d) => ({ ...d, priority: v }))}
              options={[
                { label: "All", value: "All" },
                { label: "High", value: "High" },
                { label: "Normal", value: "Normal" },
              ]}
            />

            <Text style={styles.filterSectionLabel}>Role</Text>
            <FilterChips
              value={draft.role}
              onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
              options={[
                { label: "All", value: "All" },
                { label: "Therapist", value: "Therapist" },
                { label: "Child", value: "Child" },
              ]}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetDraft}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                <Text style={styles.applyBtnText}>Apply filters</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {renderDetailsModal()}
      {renderChatSheet()}

      <BottomBar
        activeTab={""}
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },

  pageTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#181C1E",
    lineHeight: 40,
    marginBottom: 16,
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statLabel: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  statLabelActive: { color: "#FFFFFF" },
  statNumber: { fontSize: 24, fontFamily: fonts.bold, color: "#0F172A", marginTop: 2 },
  statNumberActive: { color: "#FFFFFF" },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },
  filterBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: { backgroundColor: "#004B82", borderColor: "#004B82" },

  complaintCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  userHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  avatarWrapper: { position: "relative", marginRight: 12 },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  roleIconBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: "#004B82",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  userDetails: { flex: 1, paddingRight: 8 },
  userName: { fontSize: 16, fontFamily: fonts.semiBold, color: "#181C1E", marginBottom: 4 },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: { fontSize: 10, fontFamily: fonts.bold, color: "#475569" },

  badgeTimeCol: { alignItems: "flex-end", gap: 4 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  highPriorityBg: { backgroundColor: "#FEE2E2" },
  highPriorityText: { color: "#93000A" },
  pendingBg: { backgroundColor: "#FEF3C7" },
  pendingText: { color: "#92400E" },
  resolvedBg: { backgroundColor: "#D1FAE5" },
  resolvedText: { color: "#065F46" },
  timeText: { fontSize: 11, color: "#94A3B8" },

  complaintTitle: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    marginBottom: 6,
    lineHeight: 22,
  },
  complaintDescription: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 19,
    marginBottom: 16,
  },

  cardActions: { flexDirection: "row", gap: 8 },
  viewDetailsBtn: {
    flex: 1,
    height: 40,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  viewDetailsText: { fontSize: 13, fontFamily: fonts.bold, color: colors.blackFont, lineHeight: 20 },
  iconActionBtn: {
    width: 40,
    height: 40,
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  greenIconBtn: { backgroundColor: "#D1FAE5" },
  unreadDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#DC2626",
    borderWidth: 1.5,
    borderColor: "#E0F2FE",
  },

  centerLoader: { marginVertical: 30 },
  emptyContainer: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#334155", marginTop: 12 },
  emptyText: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 20 },

  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  modalContentCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  filterSectionLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 10, marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  chipBtnActive: { backgroundColor: "#004B82" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#FFFFFF" },
  modalActionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  resetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: { fontSize: 14, fontWeight: "700", color: "#475569" },
  applyBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#004B82",
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  /* Details modal */
  detailSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%",
  },
  detailTitle: { fontSize: 20, fontFamily: fonts.semiBold, color: "#0F172A", lineHeight: 26, marginBottom: 8 },
  detailDescription: { fontSize: 15, fontFamily: fonts.regular, color: "#334155", lineHeight: 22, marginBottom: 16 },
  metaBox: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, gap: 10, marginBottom: 16 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metaLabel: { fontSize: 13, color: "#64748B" },
  metaValue: { fontSize: 13, fontWeight: "600", color: "#0F172A", flexShrink: 1, textAlign: "right" },
  resolvedBox: { backgroundColor: "#ECFDF5", borderRadius: 14, padding: 14, marginBottom: 16 },
  resolvedHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resolvedTitle: { fontSize: 14, fontWeight: "700", color: "#065F46" },
  resolvedMeta: { fontSize: 12, color: "#047857", marginTop: 4 },
  resolvedNote: { fontSize: 14, color: "#065F46", marginTop: 8, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6 },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 72,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
    marginBottom: 16,
  },
  detailActions: { flexDirection: "row", gap: 10, marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "700", color: "#0B4A6F" },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0B4A6F",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  /* Chat */
  chatSheet: {
    height: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  chatTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  chatSubTitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  chatBody: { flex: 1, paddingHorizontal: 16, backgroundColor: "#F8FAFC" },
  chatEmpty: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  bubbleRow: { flexDirection: "row", marginBottom: 8 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: "#0B4A6F", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  bubbleText: { fontSize: 14, color: "#0F172A", lineHeight: 20 },
  bubbleTextMine: { color: "#FFFFFF" },
  bubbleTime: { fontSize: 10, color: "#94A3B8", marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "#BFDBFE" },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  chatInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0B4A6F",
    alignItems: "center",
    justifyContent: "center",
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  readOnlyText: { flex: 1, fontSize: 12, color: "#64748B" },
});
