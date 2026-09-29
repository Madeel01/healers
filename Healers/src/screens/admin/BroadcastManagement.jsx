import React, { useCallback, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, fonts } from "../../styles/theme";
import {
  createBroadcast,
  getBroadcasts,
  deleteBroadcast,
  getUsersByRole,
  getBroadcastById,
  updateBroadcast,
} from "../../api/admin/api";
import BroadcastDetailModal from "./components/BroadcastDetailModal";
import { getAssetUrl } from "../../utils/media";

const LIMIT = 20;

const GROUP_CONFIG = {
  "All Users": { audience: "all" },
  "All Children": { audience: "role", roles: ["Child"] },
  "All Therapists": { audience: "role", roles: ["Therapist"] },
  Specific: { audience: "users" },
};

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Sending", value: "sending" },
  { label: "Sent", value: "sent" },
  { label: "Cancelled", value: "cancelled" },
];
const RECIPIENT_GROUPS = Object.keys(GROUP_CONFIG);

const STATUS_COLORS = {
  sent: { bg: "#DCFCE7", text: "#15803D" },
  scheduled: { bg: "#FEF3C7", text: "#B45309" },
  draft: { bg: "#E2E8F0", text: "#475569" },
  sending: { bg: "#E0F2FE", text: "#0B4A6F" },
};

const audienceLabel = (b) => {
  if (b.audience === "all") return "All Users";
  if (b.audience === "role") return (b.roles || []).join(", ");
  return `${b.users?.length || 0} selected user(s)`;
};

const formatDate = (b) => {
  const d =
    b.status === "scheduled" && b.sendAt ? b.sendAt : b.sentAt || b.createdAt;
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

  // const filteredItems = broadcastSearch.trim()
  //   ? items.filter((b) =>
  //       b.title?.toLowerCase().includes(broadcastSearch.trim().toLowerCase()) ||
  //       b.message?.toLowerCase().includes(broadcastSearch.trim().toLowerCase())
  //     )
  //   : items;

  const fetchPage = useCallback(
    async (pageNum, mode, opts = {}) => {
      try {
        setListError(null);
        if (mode === "initial") setLoading(true);
        if (mode === "more") setLoadingMore(true);

        const searchTerm = opts.search ?? broadcastSearch;
        const status = opts.status ?? statusFilter;
        const type = opts.type ?? typeFilter;

        const res = await getBroadcasts(
          pageNum,
          LIMIT,
          searchTerm,
          status,
          type,
        );
        const { data = [], pagination } = res.data;

        setItems((prev) => (pageNum === 1 ? data : [...prev, ...data]));
        setPage(pageNum);
        setHasMore(pageNum * LIMIT < (pagination?.total || 0));
      } catch (e) {
        setListError(
          e?.response?.data?.message || "Failed to load broadcasts.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [broadcastSearch, statusFilter],
  );

  useFocusEffect(
    useCallback(() => {
      fetchPage(1, "initial");
    }, [fetchPage]),
  );
  const onSearchChange = (text) => {
    setBroadcastSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchPage(1, "silent", { search: text, status: statusFilter });
    }, 350);
  };

  const onStatusSelect = (value) => {
    setStatusFilter(value);
    fetchPage(1, "silent", {
      search: broadcastSearch,
      status: value,
      type: typeFilter,
    });
  };
  const onTypeSelect = (value) => {
    setTypeFilter(value);
    fetchPage(1, "silent", {
      search: broadcastSearch,
      status: statusFilter,
      type: value,
    });
  };

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
    setSelectedRecipients([]);
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
        : [...prev, item],
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

    const fd = new FormData();
    fd.append("title", broadcastTitle.trim());
    fd.append("message", messageContent.trim());
    fd.append("audience", config.audience);
    fd.append("type", notificationType);
    if (config.audience === "role")
      fd.append("roles", JSON.stringify(config.roles));
    if (config.audience === "users")
      fd.append("users", JSON.stringify(selectedRecipients.map((r) => r._id)));
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

    try {
      setSubmitting(true);
      const res = editingId
        ? await updateBroadcast(editingId, fd)
        : await createBroadcast(fd);
      Alert.alert("Success", res.data?.message || "Done.");
      setIsCreateOpen(false);
      setEditingId(null);
      fetchPage(1, "silent");
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || "Failed to save broadcast.",
      );
      console.log(e),"errorrrr";
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
                  backgroundColor:
                    TYPE_COLORS[item.type]?.bg || TYPE_COLORS.General.bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      TYPE_COLORS[item.type]?.text || TYPE_COLORS.General.text,
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

        {item.attachment?.name ? (
          <View style={styles.attachmentRow}>
            <Feather name="paperclip" size={14} color="#64748B" />
            <Text style={styles.attachmentText} numberOfLines={1}>
              {item.attachment.name}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>To: {audienceLabel(item)}</Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.dateText}>{formatDate(item)}</Text>
          {/* <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={10}>
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity> */}
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
          <Feather name="alert-circle" size={40} color="#EF4444" />
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
        <Feather name="inbox" size={40} color="#94A3B8" />
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
    <SafeAreaView style={styles.mainContainer}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle="Back to dashboard"
      />
      <View style={styles.searchBarWrap}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search broadcasts..."
          placeholderTextColor="#94A3B8"
          value={broadcastSearch}
          onChangeText={onSearchChange}
        />
        {broadcastSearch.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")}>
            <Feather name="x" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setIsStatusMenuOpen(true)}
          style={styles.filterIconBtn}
        >
          <Feather
            name="filter"
            size={18}
            color={
              statusFilter !== "all" || typeFilter !== "all"
                ? colors.primary
                : "#94A3B8"
            }
          />
        </TouchableOpacity>
      </View>
      <Modal
        visible={isStatusMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStatusMenuOpen(false)}
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
                <Feather name="x" size={20} color="#64748B" />
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
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color={colors.primary}
              />
            ) : null
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
        />

        {/* FAB opens the create-broadcast modal */}
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 10 }]}
          activeOpacity={0.85}
          onPress={openCreateModal}
        >
          <Feather name="plus" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ============ CREATE BROADCAST MODAL ============ */}
      <Modal
        visible={isCreateOpen}
        animationType="slide"
        onRequestClose={closeCreateModal}
      >
        <SafeAreaView style={styles.mainContainer}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={closeCreateModal} hitSlop={10}>
              <Feather name="x" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalTopBarTitle}>New Broadcast</Text>
            <View style={{ width: 22 }} />
          </View>

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
                <Feather name="chevron-down" size={20} color="#475569" />
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
                    <Feather name="plus-circle" size={18} color="#0B4A6F" />
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
                            <Feather name="x" size={14} color="#0B4A6F" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
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
                <Feather name="chevron-down" size={20} color="#475569" />
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
                          notificationType === t &&
                            styles.modalOptionTextSelected,
                        ]}
                      >
                        {t}
                      </Text>
                      {notificationType === t && (
                        <Feather name="check" size={18} color="#0B4A6F" />
                      )}
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
                style={styles.formInput}
                placeholder="e.g., Facility Update:"
                placeholderTextColor="#94A3B8"
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
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

              {/* <Text style={styles.fieldLabel}>ATTACHMENT (OPTIONAL)</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={pickAttachment}>
                <View style={styles.uploadIconContainer}>
                  <MaterialCommunityIcons name="file-upload-outline" size={30} color="#0B4A6F" />
                </View>
                <Text style={styles.uploadPrimaryText}>
                  {attachment ? attachment.name : 'Click to upload or drag & drop'}
                </Text>
                <Text style={styles.uploadSecondaryText}>PDF, Image, or Doc (Max 10MB)</Text>
              </TouchableOpacity> */}
              {attachment ? (
                <View style={styles.attachmentChip}>
                  <MaterialCommunityIcons
                    name={
                      isImageAttachment(attachment)
                        ? "file-image-outline"
                        : attachment.mimeType === "application/pdf" ||
                            attachment.type === "pdf"
                          ? "file-pdf-box"
                          : "file-document-outline"
                    }
                    size={20}
                    color="#0B4A6F"
                  />
                  <Text style={styles.attachmentChipText} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAttachment(null)}
                    hitSlop={10}
                  >
                    <Feather name="x" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadBox}
                  onPress={pickAttachment}
                >
                  <View style={styles.uploadIconContainer}>
                    <MaterialCommunityIcons
                      name="file-upload-outline"
                      size={30}
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
                      deliverySchedule === "Send Now" &&
                        styles.activeSegmentText,
                    ]}
                  >
                    Send Now
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    deliverySchedule === "Schedule Later" &&
                      styles.activeSegmentBtn,
                  ]}
                  onPress={() => setDeliverySchedule("Schedule Later")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      deliverySchedule === "Schedule Later" &&
                        styles.activeSegmentText,
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
                      )
                    }
                  >
                    <Text style={styles.dropdownValueText}>
                      {sendAt.toLocaleString()}
                    </Text>
                    <Feather name="calendar" size={18} color="#475569" />
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
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Feather
                    name="send"
                    size={16}
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
        </SafeAreaView>

        <Modal
          visible={isGroupModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsGroupModalOpen(false)}
        >
          <TouchableOpacity
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
                    setRecipientOptions([]);
                    setIsGroupModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      recipientGroup === group &&
                        styles.modalOptionTextSelected,
                    ]}
                  >
                    {group}
                  </Text>
                  {recipientGroup === group && (
                    <Feather name="check" size={18} color="#0B4A6F" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={isMultiSelectModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsMultiSelectModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsMultiSelectModalOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Select {config.role === "Child" ? "Users" : "Therapists"}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsMultiSelectModalOpen(false)}
                >
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor="#94A3B8"
                value={recipientSearch}
                onChangeText={onRecipientSearchChange}
              />

              <ScrollView
                style={{ maxHeight: 280 }}
                keyboardShouldPersistTaps="handled"
              >
                {recipientsLoading ? (
                  <ActivityIndicator
                    style={{ marginVertical: 24 }}
                    color="#0B4A6F"
                  />
                ) : recipientsError ? (
                  <Text style={styles.centerMsgError}>{recipientsError}</Text>
                ) : recipientOptions.length === 0 ? (
                  <Text style={styles.centerMsgMuted}>No data found</Text>
                ) : (
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
                          {isSelected && (
                            <Feather name="check" size={12} color="#FFF" />
                          )}
                        </View>
                        <Text style={styles.checkboxLabel}>
                          {item.fullName}{" "}
                          <Text style={styles.roleTag}>({item.role})</Text>
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
          </TouchableOpacity>
        </Modal>
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

      <BottomBar
        activeTab=""
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  listContent: { padding: 16, paddingBottom: 96, flexGrow: 1 },
  titleBlock: { marginBottom: 16 },
  pageTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 26,
  },
  pageSubTitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  cardMessage: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#475569",
    lineHeight: 19,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  attachmentText: { flex: 1, fontSize: 12, color: "#64748B" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  metaText: { fontSize: 12, color: "#0B4A6F", fontWeight: "600" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  dateText: { fontSize: 11, color: "#94A3B8" },

  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#334155",
    textAlign: "center",
  },
  emptySub: { fontSize: 12, color: "#94A3B8" },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  retryText: { color: "#FFF", fontWeight: "700" },

  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTopBarTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  scrollContent: { padding: 16, paddingBottom: 32 },

  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    letterSpacing: 0.5,
    marginBottom: 5,
    lineHeight: 20,
  },
  labelRow: { flexDirection: "row", alignItems: "center" },
  requiredAsterisk: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
    marginBottom: 8,
  },

  dropdownSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  dropdownValueText: { fontSize: 15, fontWeight: "600", color: "#0B4A6F" },
  multiSelectTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  multiSelectPlaceholder: { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
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
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  tagBadgeText: { fontSize: 12, fontWeight: "700", color: "#0B4A6F" },

  formInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: colors.blackFont,
    marginBottom: 16,
    fontFamily: fonts.regular,
  },
  textAreaInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    height: 120,
    fontSize: 16,
    color: colors.blackFont,
    marginBottom: 16,
    fontFamily: fonts.regular,
  },
  searchInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    color: colors.blackFont,
    marginBottom: 10,
  },

  uploadBox: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: "#F1F4F7",
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIconContainer: { marginBottom: 6 },
  uploadPrimaryText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
    marginBottom: 2,
  },
  uploadSecondaryText: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
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
  segmentText: { fontSize: 16, fontFamily: fonts.semiBold, color: "#475569" },
  activeSegmentText: { color: "#F58B2A" },

  bottomActionsRow: { flexDirection: "row", gap: 12, padding: 10 },
  saveDraftBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveDraftText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 24,
  },
  sendBroadcastBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBroadcastText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContentCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
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
    borderRadius: 8,
  },
  modalOptionSelected: { backgroundColor: "#F0F9FF" },
  modalOptionText: { fontSize: 15, fontWeight: "600", color: "#334155" },
  modalOptionTextSelected: { color: "#0B4A6F", fontWeight: "700" },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  checkboxLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  confirmBtn: {
    backgroundColor: "#0B4A6F",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  confirmBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  centerMsgError: { textAlign: "center", color: "#EF4444", marginVertical: 24 },
  centerMsgMuted: { textAlign: "center", color: "#94A3B8", marginVertical: 24 },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 15,
    height: 44,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchBarInput: { flex: 1, fontSize: 14, color: "#0F172A" },
  roleTag: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentChipText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  imagePreviewOverlayText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
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
    padding: 20,
    paddingBottom: 32,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipWrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  filterChipActive: { backgroundColor: "#0B4A6F" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  filterChipTextActive: { color: "#FFFFFF" },
});
