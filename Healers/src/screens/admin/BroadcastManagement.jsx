import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

import {
  createBroadcast,
  deleteBroadcast,
  getBatches,
  getBroadcastById,
  getBroadcasts,
  getUsersByRole,
  updateBroadcast,
} from '../../api/admin/api';
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
import BroadcastDetailModal from './components/BroadcastDetailModal';

const LIMIT = 20;

const GROUP_CONFIG = {
  "All Users": { audience: "all" },
  "All Children": { audience: "role", roles: ["Child"] },
  "All Therapists": { audience: "role", roles: ["Therapist"] },
  Batch: { audience: "batch" },
  Specific: { audience: "users" },
};

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Sending", value: "sending" },
  { label: "Sent", value: "sent" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Failed", value: "failed" },
];
const RECIPIENT_GROUPS = Object.keys(GROUP_CONFIG);

const STATUS_COLORS = {
  sent: { bg: "#DCFCE7", text: "#15803D" },
  scheduled: { bg: "#FEF3C7", text: "#B45309" },
  draft: { bg: "#E2E8F0", text: "#475569" },
  sending: { bg: "#E0F2FE", text: "#0B4A6F" },
  failed: { bg: "#FEE2E2", text: "#B91C1C" },
};

const audienceLabel = (b) => {
  if (b.audience === "all") return "All Users";
  if (b.audience === "role") return (b.roles || []).join(", ");
  if (b.audience === "batch") {
    const names = (b.batchIds || []).map((x) => x.batchName).filter(Boolean);
    return names.length ? `Batch: ${names.join(", ")}` : "Batch";
  }
  return `${b.users?.length || 0} selected user(s)`;
};

const formatDate = (b) => {
  const d = b.status === "scheduled" && b.sendAt ? b.sendAt : b.sentAt || b.createdAt;
  return d ? new Date(d).toLocaleString() : "";
};
const isImageAttachment = (att) => {
  if (!att) return false;
  if (att.type === "image") return true;
  if (att.mimeType?.startsWith("image/")) return true;
  const name = (att.name || att.uri || "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif)$/.test(name);
};
const TYPE_OPTIONS = [
  "General",
  "System",
  "Appointment",
  "Therapy",
  "Message",
  "Reminder",
  "Alert",
];

const TYPE_COLORS = {
  System: { bg: "#E2E8F0", text: "#475569" },
  Appointment: { bg: "#CCFBF1", text: "#0F766E" },
  Therapy: { bg: "#EDE9FE", text: "#7C3AED" },
  Message: { bg: "#DBEAFE", text: "#2563EB" },
  Reminder: { bg: "#FEF3C7", text: "#B45309" },
  Alert: { bg: "#FEE2E2", text: "#B91C1C" },
  General: { bg: "#F1F5F9", text: "#334155" },
};

export default function BroadcastManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("");

  // ---- list state ----
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState(null);

  // ---- create-modal state ----
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [recipientGroup, setRecipientGroup] = useState("All Users");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [deliverySchedule, setDeliverySchedule] = useState("Send Now");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMultiSelectModalOpen, setIsMultiSelectModalOpen] = useState(false);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [sendAt, setSendAt] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [pickerMode, setPickerMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [specificRole, setSpecificRole] = useState("Child");

  const config = GROUP_CONFIG[recipientGroup];
  const isSpecificMode = config.audience === "users";
  const activeSpecificRole = specificRole;
  const [broadcastSearch, setBroadcastSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const [detailBroadcast, setDetailBroadcast] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [notificationType, setNotificationType] = useState("General");
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  const [selectedBatches, setSelectedBatches] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const isBatchMode = config.audience === "batch";

  // const filteredItems = broadcastSearch.trim()
  //   ? items.filter((b) =>
  //       b.title?.toLowerCase().includes(broadcastSearch.trim().toLowerCase()) ||
  //       b.message?.toLowerCase().includes(broadcastSearch.trim().toLowerCase())
  //     )
  //   : items;
  const filtersRef = useRef({ search: "", status: "all", type: "all" });
  const setFilters = (patch) => {
    filtersRef.current = { ...filtersRef.current, ...patch };
  };
  const fetchPage = useCallback(async (pageNum, mode) => {
    try {
      setListError(null);
      if (mode === "initial") setLoading(true);
      if (mode === "more") setLoadingMore(true);

      const { search, status, type } = filtersRef.current;
      const res = await getBroadcasts(pageNum, LIMIT, search, status, type);
      const { data = [], pagination } = res.data;

      setItems((prev) => (pageNum === 1 ? data : [...prev, ...data]));
      setPage(pageNum);
      setHasMore(pageNum * LIMIT < (pagination?.total || 0));
    } catch (e) {
      setListError(e?.response?.data?.message || "Failed to load broadcasts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const onSearchChange = (text) => {
    setBroadcastSearch(text);
    setFilters({ search: text });
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchPage(1, "silent"), 350);
  };
  const onStatusSelect = (value) => {
    setStatusFilter(value);
    setFilters({ status: value });
    fetchPage(1, "silent");
  };
  const onTypeSelect = (value) => {
    setTypeFilter(value);
    setFilters({ type: value });
    fetchPage(1, "silent");
  };

  useFocusEffect(
    useCallback(() => {
      fetchPage(1, "initial");
    }, [fetchPage]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage(1, "silent");
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || loading) return;
    fetchPage(page + 1, "more");
  };

  const confirmDelete = (item) => {
    Alert.alert("Delete broadcast", `Delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await deleteBroadcast(item._id);
            if (!res.data?.success) {
              Alert.alert("Error", res.data?.message || "Could not delete.");
              return;
            }
            setItems((prev) => prev.filter((b) => b._id !== item._id));
          } catch (e) {
            Alert.alert(
              "Error",
              e?.response?.data?.message || "Could not delete.",
            );
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setRecipientGroup("All Users");
    setEditingId(null);
    setSelectedRecipients([]);
    setSelectedBatches([]);
    setBroadcastTitle("");
    setMessageContent("");
    setDeliverySchedule("Send Now");
    setAttachment(null);
    setSendAt(new Date(Date.now() + 60 * 60 * 1000));
    setRecipientOptions([]);
    setRecipientSearch("");
    setNotificationType("General");
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setIsCreateOpen(false);
    setEditingId(null);
  };

  const loadRecipients = async (searchTerm = "") => {
    try {
      setRecipientsLoading(true);
      setRecipientsError(null);
      const res = await getUsersByRole({ search: searchTerm });
      setRecipientOptions(res.data || []);
    } catch (e) {
      setRecipientsError(e?.response?.data?.message || "Failed to load list.");
      setRecipientOptions([]);
    } finally {
      setRecipientsLoading(false);
    }
  };
  const loadBatches = async (search = "") => {
    try {
      setBatchesLoading(true);
      const res = await getBatches({ search, limit: 5 });
      setBatchOptions(res?.data?.batches || res?.data || []);
    } catch (e) {
      setBatchOptions([]);
    } finally {
      setBatchesLoading(false);
    }
  };

  const openBatchModal = () => {
    setBatchSearch("");
    setIsBatchModalOpen(true);
    loadBatches("");
  };

  const toggleBatch = (b) =>
    setSelectedBatches((prev) =>
      prev.some((x) => x._id === b._id) ? prev.filter((x) => x._id !== b._id) : [...prev, b]
    );

  const openMultiSelect = () => {
    setIsMultiSelectModalOpen(true);
    setRecipientSearch("");
    loadRecipients("");
  };

  const onRecipientSearchChange = (text) => {
    setRecipientSearch(text);
    loadRecipients(text);
  };

  const toggleRecipientSelection = (item) => {
    setSelectedRecipients((prev) =>
      prev.some((r) => r._id === item._id)
        ? prev.filter((r) => r._id !== item._id)
        : [...prev, item]
    );
  };

  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if (file.size && file.size > 10 * 1024 * 1024) {
      Alert.alert("File too large", "Max size is 10MB.");
      return;
    }
    setAttachment(file);
  };

  const onPickerValueChange = (event, selected) => {
    if (!selected) return;
    if (Platform.OS === "android") {
      const d = new Date(sendAt);
      if (pickerMode === "date") {
        d.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate(),
        );
        setSendAt(d);
        setPickerMode("time");
      } else {
        d.setHours(selected.getHours(), selected.getMinutes());
        setSendAt(d);
        setPickerMode(null);
      }
    } else {
      setSendAt(selected);
    }
  };

  const onPickerDismiss = () => {
    setPickerMode(null);
  };

  const submit = async (mode) => {
    if (!broadcastTitle.trim() || !messageContent.trim()) {
      Alert.alert("Missing fields", "Title and message are required.");
      return;
    }
    if (isSpecificMode && selectedRecipients.length === 0) {
      Alert.alert("No recipients", "Select at least one recipient.");
      return;
    }
    const isLater = deliverySchedule === "Schedule Later";
    if (mode === "send" && isLater && sendAt <= new Date()) {
      Alert.alert("Invalid time", "Scheduled time must be in the future.");
      return;
    }
    if (isBatchMode && selectedBatches.length === 0) {
      Alert.alert("No batch", "Select at least one batch.");
      return;
    }

    const fd = new FormData();
    fd.append("title", broadcastTitle.trim());
    fd.append("message", messageContent.trim());
    fd.append("audience", config.audience);
    fd.append("type", notificationType);
    if (config.audience === "role") {
      fd.append("roles", JSON.stringify(config.roles));
    }
    if (config.audience === "users") {
      fd.append("users", JSON.stringify(selectedRecipients.map((r) => r._id)));
    }
    if (config.audience === "batch") {
      fd.append("batchIds", JSON.stringify(selectedBatches.map((b) => b._id)));
    }
    fd.append(
      "deliverySchedule",
      mode === "draft" ? "draft" : isLater ? "later" : "now",
    );
    if (mode === "send" && isLater) fd.append("sendAt", sendAt.toISOString());

    if (attachment && !attachment.existing) {
      fd.append("attachment", {
        uri: attachment.uri,
        name: attachment.name,
        type: attachment.mimeType || "application/octet-stream",
      });
    }
    if (editingId && !attachment) {
      fd.append("removeAttachment", "true");
    }

    //  for (const recipient of selectedRecipients) {
    //   const userId = recipient._id;

    //   const payload = {
    //     userId: userId.trim(),
    //     title: broadcastTitle.trim(),
    //     body: messageContent.trim(),
    //     data: {
    //       screen: "Notifications",
    //       type: "test",
    //     },
    //   };

    //   console.log("Sending Push Notification:", payload,userId);

    //   const response = await sendPushNotificationApi(payload);
    //   console.log("Push API Response:", response);

    //   if (response?.data?.successCount > 0) {
    //     Alert.alert(
    //       "Success",
    //       "Push notification sent successfully!",
    //     );
    //   }
    // }
    // return;

    try {
      setSubmitting(true);
      const res = editingId
        ? await updateBroadcast(editingId, fd)
        : await createBroadcast(fd);
      Alert.alert("Success", res.data?.message || "Done.");
      if (config.audience === "users" && mode === "send") {
        const userId = selectedRecipients[0]?._id;

        if (!userId) {
          throw new Error("No valid recipient selected.");
        }
      }
      setIsCreateOpen(false);
      setEditingId(null);
      fetchPage(1, "silent");
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || "Failed to save broadcast.",
      );
      console.log(e), "errorrrr";
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.draft;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => openDetail(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.badgeGroup}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: TYPE_COLORS[item.type]?.bg || TYPE_COLORS.General.bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: TYPE_COLORS[item.type]?.text || TYPE_COLORS.General.text,
                  },
                ]}
              >
                {item.type || "General"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.badgeText, { color: sc.text }]}>
                {item.status?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.cardMessage} numberOfLines={3}>
          {item.message}
        </Text>

        {item.attachment?.name
          ? (
            <View style={styles.attachmentRow}>
              <Feather name="paperclip" size={fontSize(14)} color="#64748B" />
              <Text style={styles.attachmentText} numberOfLines={1}>
                {item.attachment.name}
              </Text>
            </View>
          )
          : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>To: {audienceLabel(item)}</Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.dateText}>{formatDate(item)}</Text>
          {
            /* <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={10}>
            <Feather name="trash-2" size={fontSize(18)} color="#EF4444" />
          </TouchableOpacity> */
          }
          {item.status === "sent" && (
            <Text style={styles.metaText}>
              Read {item.readCount}/{item.recipientCount}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (listError) {
      return (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={fontSize(40)} color="#EF4444" />
          <Text style={styles.emptyTitle}>{listError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchPage(1, "initial")}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerBox}>
        <Feather name="inbox" size={fontSize(40)} color="#94A3B8" />
        <Text style={styles.emptyTitle}>No data found</Text>
        <Text style={styles.emptySub}>
          Tap + to create your first broadcast.
        </Text>
      </View>
    );
  };
  const openDetail = async (item) => {
    setIsDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await getBroadcastById(item._id);
      setDetailBroadcast(res.data.data);
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || "Failed to load broadcast.",
      );
      setIsDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const startEdit = (broadcast) => {
    setIsDetailOpen(false);
    setEditingId(broadcast._id);
    setBroadcastTitle(broadcast.title);
    setMessageContent(broadcast.message);
    setDeliverySchedule(
      broadcast.status === "scheduled" ? "Schedule Later" : "Send Now",
    );
    setNotificationType(broadcast.type || "General");
    if (broadcast.sendAt) setSendAt(new Date(broadcast.sendAt));

    if (broadcast.audience === "all") setRecipientGroup("All Users");
    else if (broadcast.audience === "role") {
      setRecipientGroup(
        broadcast.roles?.[0] === "Child" ? "All Children" : "All Therapists",
      );
    } else if (broadcast.audience === "batch") {
      setRecipientGroup("Batch");
      setSelectedBatches((broadcast.batchIds || []).filter((b) => typeof b === "object"));
    } else {
      setRecipientGroup("Specific");
      setSelectedRecipients(
        (broadcast.users || []).filter((u) => typeof u === "object"),
      );
    }

    setAttachment(
      broadcast.attachment?.url
        ? {
          existing: true,
          name: broadcast.attachment.name,
          type: broadcast.attachment.type,
          url: broadcast.attachment.url,
        }
        : null,
    );
    setIsCreateOpen(true);
  };

  return (
    <View style={[commonStyles.container, { paddingTop: hp(10) }]}>
      <View style={styles.searchBarWrap}>
        <Feather name="search" size={fontSize(16)} color="#94A3B8" />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search broadcasts..."
          placeholderTextColor="#94A3B8"
          value={broadcastSearch}
          onChangeText={onSearchChange}
          textAlignVertical="center"
          scrollEnabled={false}
        />
        {broadcastSearch.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")}>
            <Feather name="x" size={fontSize(16)} color="#94A3B8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setIsStatusMenuOpen(true)}
          style={styles.filterIconBtn}
        >
          <Feather
            name="filter"
            size={fontSize(18)}
            color={statusFilter !== "all" || typeFilter !== "all"
              ? colors.primary
              : "#94A3B8"}
          />
        </TouchableOpacity>
      </View>
      <Modal
        visible={isStatusMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStatusMenuOpen(false)}
        style={{paddingBottom:insets.bottom}}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setIsStatusMenuOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheetCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setIsStatusMenuOpen(false)}>
                <Feather name="x" size={fontSize(20)} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>STATUS</Text>
            <View style={styles.chipWrapRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.filterChip,
                    statusFilter === opt.value && styles.filterChipActive,
                  ]}
                  onPress={() => onStatusSelect(opt.value)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === opt.value && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionLabel, { marginTop: 18 }]}>
              TYPE
            </Text>
            <View style={styles.chipWrapRow}>
              {["all", ...TYPE_OPTIONS].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.filterChip,
                    typeFilter === t && styles.filterChipActive,
                  ]}
                  onPress={() => onTypeSelect(t)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      typeFilter === t && styles.filterChipTextActive,
                    ]}
                  >
                    {t === "all" ? "All" : t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <View style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.titleBlock}>
              <Text style={styles.pageTitle}>Broadcast Management</Text>
              <Text style={styles.pageSubTitle}>
                Send notifications to users.
              </Text>
            </View>
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={loadingMore
            ? (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color={colors.primary}
              />
            )
            : null}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
        />

        {/* FAB opens the create-broadcast modal */}
        <TouchableOpacity
          style={[styles.fab]}
          activeOpacity={0.85}
          onPress={openCreateModal}
        >
          <Feather name="plus" size={fontSize(26)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ============ CREATE BROADCAST MODAL ============ */}
      <Modal
        visible={isCreateOpen}
        animationType="slide"
        onRequestClose={closeCreateModal}
      >
        <SafeAreaView style={commonStyles.container}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={closeCreateModal} hitSlop={10}>
              <Feather name="x" size={fontSize(22)} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalTopBarTitle}>New Broadcast</Text>
            <View style={{ width: 22 }} />
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Card 1: Recipient Group */}
              <View style={styles.cardContainer}>
                <Text style={styles.fieldLabel}>RECIPIENT GROUP</Text>

                <TouchableOpacity
                  style={styles.dropdownSelector}
                  onPress={() => setIsGroupModalOpen(true)}
                >
                  <Text style={styles.dropdownValueText}>{recipientGroup}</Text>
                  <Feather name="chevron-down" size={fontSize(20)} color="#475569" />
                </TouchableOpacity>

                {isSpecificMode && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.fieldLabel}>SELECT RECIPIENTS</Text>
                    <TouchableOpacity
                      style={styles.multiSelectTrigger}
                      onPress={openMultiSelect}
                    >
                      <Text
                        style={[
                          styles.multiSelectPlaceholder,
                          selectedRecipients.length > 0 && { color: "#0F172A" },
                        ]}
                      >
                        {selectedRecipients.length > 0
                          ? `${selectedRecipients.length} Selected`
                          : "Tap to search users or therapists..."}
                      </Text>
                      <Feather name="plus-circle" size={fontSize(18)} color="#0B4A6F" />
                    </TouchableOpacity>

                    {selectedRecipients.length > 0 && (
                      <View style={styles.selectedTagsContainer}>
                        {selectedRecipients.map((item) => (
                          <View key={item._id} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>
                              {item.fullName} · {item.role}
                            </Text>
                            <TouchableOpacity
                              onPress={() => toggleRecipientSelection(item)}
                            >
                              <Feather name="x" size={fontSize(14)} color="#0B4A6F" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                {isBatchMode && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.fieldLabel}>SELECT BATCHES</Text>
                    <TouchableOpacity style={styles.multiSelectTrigger} onPress={openBatchModal}>
                      <Text
                        style={[
                          styles.multiSelectPlaceholder,
                          selectedBatches.length > 0 && { color: "#0F172A" },
                        ]}
                      >
                        {selectedBatches.length > 0
                          ? `${selectedBatches.length} Selected`
                          : "Tap to select batches..."}
                      </Text>
                      <Feather name="plus-circle" size={fontSize(18)} color="#0B4A6F" />
                    </TouchableOpacity>

                    {selectedBatches.length > 0 && (
                      <View style={styles.selectedTagsContainer}>
                        {selectedBatches.map((b) => (
                          <View key={b._id} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>{b.batchName}</Text>
                            <TouchableOpacity onPress={() => toggleBatch(b)}>
                              <Feather name="x" size={fontSize(14)} color="#0B4A6F" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text style={[styles.metaText, { marginTop: 10, fontWeight: "400", color: "#64748B" }]}>
                      Goes to the active children in the selected batches.
                      {deliverySchedule === "Schedule Later"
                        ? " Children are picked when it is sent, so anyone added or removed before then is included or excluded."
                        : ""}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cardContainer}>
                <Text style={styles.fieldLabel}>NOTIFICATION TYPE</Text>
                <TouchableOpacity
                  style={styles.dropdownSelector}
                  onPress={() => setIsTypeModalOpen(true)}
                >
                  <Text style={styles.dropdownValueText}>{notificationType}</Text>
                  <Feather name="chevron-down" size={fontSize(20)} color="#475569" />
                </TouchableOpacity>
              </View>
              <Modal
                visible={isTypeModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsTypeModalOpen(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setIsTypeModalOpen(false)}
                >
                  <View style={styles.modalContentCard}>
                    <Text style={styles.modalTitle}>
                      Select Notification Type
                    </Text>
                    {TYPE_OPTIONS.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.modalOptionRow,
                          notificationType === t && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setNotificationType(t);
                          setIsTypeModalOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            notificationType === t
                            && styles.modalOptionTextSelected,
                          ]}
                        >
                          {t}
                        </Text>
                        {notificationType === t && <Feather name="check" size={fontSize(18)} color="#0B4A6F" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* Card 2: Title / Message / Attachment */}
              <View style={styles.cardContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>BROADCAST TITLE</Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <TextInput
                  placeholder="e.g., Facility Update:"
                  placeholderTextColor="#94A3B8"
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                  scrollEnabled={false}
                  textAlignVertical="center"
                  style={styles.formInput}
                />

                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>MESSAGE CONTENT</Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <TextInput
                  style={styles.textAreaInput}
                  placeholder="Type your notification message here..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  value={messageContent}
                  onChangeText={setMessageContent}
                />

                {
                  /* <Text style={styles.fieldLabel}>ATTACHMENT (OPTIONAL)</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={pickAttachment}>
                <View style={styles.uploadIconContainer}>
                  <MaterialCommunityIcons name="file-upload-outline" size={fontSize(30)} color="#0B4A6F" />
                </View>
                <Text style={styles.uploadPrimaryText}>
                  {attachment ? attachment.name : 'Click to upload or drag & drop'}
                </Text>
                <Text style={styles.uploadSecondaryText}>PDF, Image, or Doc (Max 10MB)</Text>
              </TouchableOpacity> */
                }
                {attachment
                  ? (
                    <View style={styles.attachmentChip}>
                      <MaterialCommunityIcons
                        name={isImageAttachment(attachment)
                          ? "file-image-outline"
                          : attachment.mimeType === "application/pdf"
                              || attachment.type === "pdf"
                          ? "file-pdf-box"
                          : "file-document-outline"}
                        size={fontSize(20)}
                        color="#0B4A6F"
                      />
                      <Text style={styles.attachmentChipText} numberOfLines={1}>
                        {attachment.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setAttachment(null)}
                        hitSlop={10}
                      >
                        <Feather name="x" size={fontSize(18)} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )
                  : (
                    <TouchableOpacity
                      style={styles.uploadBox}
                      onPress={pickAttachment}
                    >
                      <View style={styles.uploadIconContainer}>
                        <MaterialCommunityIcons
                          name="file-upload-outline"
                          size={fontSize(30)}
                          color="#0B4A6F"
                        />
                      </View>
                      <Text style={styles.uploadPrimaryText}>
                        Click to upload or drag & drop
                      </Text>
                      <Text style={styles.uploadSecondaryText}>
                        PDF, Image, or Doc (Max 10MB)
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>

              {/* Card 3: Delivery Schedule */}
              <View style={styles.cardContainer}>
                <Text style={styles.fieldLabel}>DELIVERY SCHEDULE</Text>
                <View style={styles.segmentContainer}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      deliverySchedule === "Send Now" && styles.activeSegmentBtn,
                    ]}
                    onPress={() => setDeliverySchedule("Send Now")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        deliverySchedule === "Send Now"
                        && styles.activeSegmentText,
                      ]}
                    >
                      Send Now
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      deliverySchedule === "Schedule Later"
                      && styles.activeSegmentBtn,
                    ]}
                    onPress={() => setDeliverySchedule("Schedule Later")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        deliverySchedule === "Schedule Later"
                        && styles.activeSegmentText,
                      ]}
                    >
                      Schedule Later
                    </Text>
                  </TouchableOpacity>
                </View>

                {deliverySchedule === "Schedule Later" && (
                  <>
                    <TouchableOpacity
                      style={[styles.dropdownSelector, { marginTop: 12 }]}
                      onPress={() =>
                        setPickerMode(
                          pickerMode
                            ? null
                            : Platform.OS === "ios"
                            ? "datetime"
                            : "date",
                        )}
                    >
                      <Text style={styles.dropdownValueText}>
                        {sendAt.toLocaleString()}
                      </Text>
                      <Feather name="calendar" size={fontSize(18)} color="#475569" />
                    </TouchableOpacity>
                    {pickerMode && (
                      <DateTimePicker
                        value={sendAt}
                        mode={pickerMode}
                        minimumDate={new Date()}
                        onValueChange={onPickerValueChange}
                        onDismiss={onPickerDismiss}
                      />
                    )}
                  </>
                )}
              </View>
            </ScrollView>
            {/* Bottom Actions */}
            <View style={styles.bottomActionsRow}>
              <TouchableOpacity
                style={styles.saveDraftBtn}
                disabled={submitting}
                onPress={() => submit("draft")}
              >
                <Text style={styles.saveDraftText}>Save Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sendBroadcastBtn}
                disabled={submitting}
                onPress={() => submit("send")}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Feather
                      name="send"
                      size={fontSize(16)}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.sendBroadcastText}>
                      {deliverySchedule === "Schedule Later"
                        ? "Schedule"
                        : "Send Broadcast"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal
          visible={isGroupModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsGroupModalOpen(false)}
        >
          <View
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsGroupModalOpen(false)}
          >
            <View style={styles.modalContentCard}>
              <Text style={styles.modalTitle}>Select Recipient Group</Text>
              {RECIPIENT_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[
                    styles.modalOptionRow,
                    recipientGroup === group && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setRecipientGroup(group);
                    setSelectedRecipients([]);
                    setSelectedBatches([]);
                    setRecipientOptions([]);
                    setIsGroupModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      recipientGroup === group
                      && styles.modalOptionTextSelected,
                    ]}
                  >
                    {group}
                  </Text>
                  {recipientGroup === group && <Feather name="check" size={fontSize(18)} color="#0B4A6F" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <Modal
          visible={isMultiSelectModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsMultiSelectModalOpen(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
          >
            <View
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setIsMultiSelectModalOpen(false)}
            >
              <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select {config.role === "Child" ? "Users" : "Users"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsMultiSelectModalOpen(false)}
                  >
                    <Feather name="x" size={fontSize(20)} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name..."
                  placeholderTextColor="#94A3B8"
                  value={recipientSearch}
                  onChangeText={onRecipientSearchChange}
                  textAlignVertical='center'
                  scrollEnabled={false}
                />

                <ScrollView
                  style={{ maxHeight: 280 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {recipientsLoading
                    ? (
                      <ActivityIndicator
                        style={{ marginVertical: 24 }}
                        color="#0B4A6F"
                      />
                    )
                    : recipientsError
                    ? <Text style={styles.centerMsgError}>{recipientsError}</Text>
                    : recipientOptions.length === 0
                    ? <Text style={styles.centerMsgMuted}>No data found</Text>
                    : (
                      recipientOptions.map((item) => {
                        const isSelected = selectedRecipients.some(
                          (r) => r._id === item._id,
                        );
                        return (
                          <TouchableOpacity
                            key={item._id}
                            style={styles.checkboxRow}
                            onPress={() => toggleRecipientSelection(item)}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                isSelected && styles.checkboxActive,
                              ]}
                            >
                              {isSelected && <Feather name="check" size={fontSize(12)} color="#FFF" />}
                            </View>
                            <Text style={styles.checkboxLabel}>
                              {item.fullName} <Text style={styles.roleTag}>({item.role})</Text>
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => setIsMultiSelectModalOpen(false)}
                >
                  <Text style={styles.confirmBtnText}>Done</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>
      <Modal
        visible={isBatchModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsBatchModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <View
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsBatchModalOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Batches</Text>
                <TouchableOpacity onPress={() => setIsBatchModalOpen(false)}>
                  <Feather name="x" size={fontSize(20)} color="#64748B" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search batch..."
                placeholderTextColor="#94A3B8"
                value={batchSearch}
                onChangeText={(t) => {
                  setBatchSearch(t);
                  loadBatches(t);
                }}
                   textAlignVertical='center'
                  scrollEnabled={false}
              />

              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                {batchesLoading
                  ? <ActivityIndicator style={{ marginVertical: 24 }} color="#0B4A6F" />
                  : batchOptions.length === 0
                  ? <Text style={styles.centerMsgMuted}>No batches found</Text>
                  : (
                    batchOptions.map((b) => {
                      const on = selectedBatches.some((x) => x._id === b._id);
                      const count = b.childrenIds?.length;
                      return (
                        <TouchableOpacity key={b._id} style={styles.checkboxRow} onPress={() => toggleBatch(b)}>
                          <View style={[styles.checkbox, on && styles.checkboxActive]}>
                            {on && <Feather name="check" size={fontSize(12)} color="#FFF" />}
                          </View>
                          <Text style={styles.checkboxLabel}>
                            {b.batchName}
                            {count != null && <Text style={styles.roleTag}>({count} children)</Text>}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
              </ScrollView>

              <TouchableOpacity style={styles.confirmBtn} onPress={() => setIsBatchModalOpen(false)}>
                <Text style={styles.confirmBtnText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <BroadcastDetailModal
        visible={isDetailOpen}
        loading={detailLoading}
        broadcast={detailBroadcast}
        onClose={() => setIsDetailOpen(false)}
        onEdit={startEdit}
        onDelete={(b) => {
          setIsDetailOpen(false);
          confirmDelete(b);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: wp(16), paddingBottom: hp(20), flexGrow: 1 },
  titleBlock: { marginBottom: 16 },
  pageTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 26,
  },
  pageSubTitle: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(20),
    padding: wp(16),
    marginBottom: wp(12),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  badge: { paddingHorizontal: wp(8), paddingVertical: hp(2), borderRadius: wp(12) },
  badgeText: { fontSize: fontSize(10), fontFamily: fonts.medium, lineHeight: 14 },
  cardMessage: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#475569",
    lineHeight: 16,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  attachmentText: { flex: 1, fontSize: fontSize(12), color: "#64748B" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  metaText: { fontSize: fontSize(12), color: "#0B4A6F", fontWeight: "600" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  dateText: { fontSize: fontSize(11), color: "#94A3B8" },

  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: hp(80),
    gap: 10,
  },
  emptyTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#334155",
    textAlign: "center",
  },
  emptySub: { fontSize: fontSize(12), color: "#94A3B8" },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: wp(10),
    backgroundColor: colors.primary,
  },
  retryText: { color: "#FFF", fontWeight: "700" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
    width: wp(56),
    height: hp(56),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  modalTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp(16),
    paddingVertical: hp(14),
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTopBarTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 24,
  },

  scrollContent: { padding: wp(16), paddingBottom: hp(20) },

  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(24),
    padding: wp(20),
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    letterSpacing: 0.5,
    marginBottom: 5,
    lineHeight: 20,
  },
  labelRow: { flexDirection: "row", alignItems: "center" },
  requiredAsterisk: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#EF4444",
    marginBottom: 8,
  },

  dropdownSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(48),
  },
  dropdownValueText: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0B4A6F" },
  multiSelectTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(48),
  },
  multiSelectPlaceholder: { fontSize: fontSize(14), color: "#94A3B8", fontWeight: "500" },
  selectedTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    borderRadius: wp(20),
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  tagBadgeText: { fontSize: fontSize(12), fontWeight: "700", color: "#0B4A6F" },

  formInput: {
    flex: 1,
    minHeight: hp(46),
    maxHeight: hp(46),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: wp(14),
    paddingVertical: hp(0),
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: colors.blackFont,

    backgroundColor: "#F1F5F9",
    marginBottom: 16,
    borderRadius: wp(12),
  },
  textAreaInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    paddingTop: hp(12),
    height: hp(120),
    fontSize: fontSize(14),
    color: colors.blackFont,
    marginBottom: 16,
    fontFamily: fonts.regular,
  },
  searchInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: wp(10),
    paddingHorizontal: wp(12),
    minHeight: hp(48),
    maxHeight: hp(48),
    fontSize: fontSize(14),
    color: colors.blackFont,
    marginBottom: 10,
  },

  uploadBox: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: wp(12),
    backgroundColor: "#F1F4F7",
    paddingVertical: hp(20),
    paddingHorizontal: wp(20),
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIconContainer: { marginBottom: 6 },
  uploadPrimaryText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
    marginBottom: 2,
  },
  uploadSecondaryText: {
    fontSize: fontSize(12),
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    padding: wp(4),
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: hp(10),
    borderRadius: wp(8),
    alignItems: "center",
    justifyContent: "center",
  },
  activeSegmentBtn: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#475569" },
  activeSegmentText: { color: "#F58B2A" },

  bottomActionsRow: { flexDirection: "row", gap: 12, padding: wp(10) },
  saveDraftBtn: {
    flex: 1,
    height: hp(48),
    borderRadius: wp(12),
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveDraftText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 22,
  },
  sendBroadcastBtn: {
    flex: 1.3,
    height: hp(48),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBroadcastText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight: 22,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: wp(20),
  },
  modalContentCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(20),
    padding: wp(20),
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: fontSize(16),
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  modalOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: wp(8),
  },
  modalOptionSelected: { backgroundColor: "#F0F9FF" },
  modalOptionText: { fontSize: fontSize(15), fontWeight: "600", color: "#334155" },
  modalOptionTextSelected: { color: "#0B4A6F", fontWeight: "700" },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  checkbox: {
    width: wp(20),
    height: hp(20),
    borderRadius: wp(6),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: wp(12),
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  checkboxLabel: { fontSize: fontSize(14), fontFamily: fonts.semiBold, lineHeight: 18, color: "#334155" },
  confirmBtn: {
    backgroundColor: "#0B4A6F",
    borderRadius: wp(12),
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  confirmBtnText: { color: "#FFFFFF", fontFamily: fonts.semiBold, fontSize: fontSize(14) },

  centerMsgError: { textAlign: "center", color: "#EF4444", marginVertical: 24 },
  centerMsgMuted: { textAlign: "center", color: "#94A3B8", marginVertical: 24 },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(12),
    paddingHorizontal: 12,
    marginHorizontal: 15,
    height: hp(44),
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchBarInput: { flex: 1, minHeight: hp(46), maxHeight: hp(46), fontSize: fontSize(14), color: "#0F172A" },
  roleTag: { fontSize: fontSize(11), color: "#94A3B8", fontFamily: fonts.medium },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentChipText: {
    flex: 1,
    fontSize: fontSize(13),
    color: "#334155",
    fontFamily: fonts.semiBold,
  },
  imagePreviewOverlayText: { color: "#FFF", fontSize: fontSize(11), fontFamily: fonts.semiBold },
  badgeGroup: { flexDirection: "row", gap: 6 },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "flex-end",
  },
  bottomSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: wp(20),
    paddingBottom: 32,
  },
  filterSectionLabel: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipWrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: wp(20),
    backgroundColor: "#F1F5F9",
  },
  filterChipActive: { backgroundColor: "#0B4A6F" },
  filterChipText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#475569" },
  filterChipTextActive: { color: "#FFFFFF" },
});
