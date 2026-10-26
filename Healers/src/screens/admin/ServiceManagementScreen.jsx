import React, {
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import ColorPicker from 'react-native-wheel-color-picker';

import Feather from '@expo/vector-icons/Feather';

import {
  createService,
  deleteService,
  getServices,
  updateService,
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

const PRESETS = [
  "#C2410C",
  "#991B1B",
  "#065F46",
  "#854D0E",
  "#1D4ED8",
  "#6D28D9",
  "#9D174D",
  "#155E75",
];

const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const tint = (hex, amount = 0.85) => {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return (
    "#"
    + [mix(r), mix(g), mix(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
};

const emptyForm = { label: "", color: PRESETS[0] };
const LIMIT = 10;

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

export default function ServiceManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [, setActiveBottomTab] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [tempColor, setTempColor] = useState(PRESETS[0]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const fetchItems = async ({ pageNum = 1, isRefresh = false } = {}) => {
    const requestId = ++requestIdRef.current;
    const isFirst = pageNum === 1;

    if (isRefresh) setRefreshing(true);
    else if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await getServices({
        page: pageNum,
        limit: LIMIT,
        search: search.trim(),
        status: statusFilter,
      });
      if (requestId !== requestIdRef.current) return;

      if (res.success) {
        const list = res.data || [];
        setItems((prev) =>
          isFirst
            ? list
            : [
              ...prev,
              ...list.filter((i) => !prev.some((p) => p.id === i.id)),
            ]
        );
        setPage(pageNum);
        setHasMore(Boolean(res.hasMore));
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.log("Fetch services error:", err);
      Alert.alert("Error", "Failed to load services.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchItems({ pageNum: 1 }), 350);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => fetchItems({ pageNum: 1 }));
    return unsub;
  }, [navigation, search, statusFilter]);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
    if (nearBottom && hasMore && !loading && !loadingMore && !refreshing) {
      fetchItems({ pageNum: page + 1 });
    }
  };

  const openFilter = () => {
    setDraftStatus(statusFilter);
    setIsFilterOpen(true);
  };
  const applyFilter = () => {
    setStatusFilter(draftStatus);
    setIsFilterOpen(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ label: item.label, color: item.color });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      Alert.alert("Missing info", "Please enter a service name.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        color: form.color,
        bg: tint(form.color),
      };
      const res = editing
        ? await updateService(editing.id, payload)
        : await createService(payload);

      if (res.success) {
        setIsFormOpen(false);
        fetchItems({ pageNum: 1 });
      } else {
        Alert.alert("Error", res.message || "Something went wrong.");
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to save service.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item, value) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: value } : i)));
    try {
      const res = await updateService(item.id, { isActive: value });
      if (!res.success) throw new Error(res.message);
      if (statusFilter !== "all") {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: !value } : i)));
      Alert.alert("Error", "Failed to update status.");
    }
  };

  const handleDelete = (item) => {
    Alert.alert("Delete Service", `Delete "${item.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await deleteService(item.id);
            if (res.success) {
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } else {
              Alert.alert("Error", res.message || "Failed to delete.");
            }
          } catch (err) {
            // 409 jab service use mein ho
            Alert.alert(
              "Cannot delete",
              err?.response?.data?.message || "Failed to delete.",
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={fontSize(18)} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={openFilter}>
          <Feather name="sliders" size={fontSize(20)} color="#0B4A6F" />
          {statusFilter !== "all" && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchItems({ pageNum: 1, isRefresh: true })}
            colors={[colors.primary]}
          />
        }
      >
        {loading && items.length === 0 && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginVertical: 40 }}
          />
        )}

        {!loading && items.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="briefcase" size={fontSize(32)} color="#94A3B8" />
            <Text style={styles.emptyText}>
              {search || statusFilter !== "all"
                ? "No services match"
                : "No services yet"}
            </Text>
            <Text style={styles.emptySub}>
              {search || statusFilter !== "all"
                ? "Try a different search or filter."
                : "Tap + to add your first service."}
            </Text>
          </View>
        )}
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.card, !item.isActive && { opacity: 0.55 }]}
          >
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: item.bg }]}>
                <Text style={[styles.badgeText, { color: item.color }]}>
                  {item.label}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openEdit(item)}
                >
                  <Feather name="edit-2" size={fontSize(16)} color="#0B4A6F" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleDelete(item)}
                >
                  <Feather name="trash-2" size={fontSize(16)} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardBottom}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  {item.isActive ? "Active" : "Inactive"}
                </Text>
                <Switch
                  value={item.isActive}
                  onValueChange={(v) => handleToggleActive(item, v)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </View>
          </View>
        ))}
        {loadingMore && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginVertical: 16 }}
          />
        )}
      </ScrollView>
      <TouchableOpacity
        style={[styles.fab]}
        onPress={openCreate}
      >
        <Feather name="plus" size={fontSize(26)} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={isFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFormOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <View style={styles.overlay}>
            <View style={styles.formCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editing ? "Edit Service" : "Add Service"}
                </Text>
                <TouchableOpacity onPress={() => setIsFormOpen(false)}>
                  <Feather name="x" size={fontSize(20)} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Service Name</Text>
              <TextInput
                placeholder="e.g. Counselling"
                placeholderTextColor="#94A3B8"
                value={form.label}
                onChangeText={(t) => setForm((p) => ({ ...p, label: t }))}
                multiline={false}
                underlineColorAndroid="transparent"
                textAlignVertical="center"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Color</Text>
              <TouchableOpacity
                style={styles.colorSelector}
                onPress={() => {
                  setTempColor(form.color);
                  setIsColorOpen(true);
                }}
              >
                <View
                  style={[styles.colorDot, { backgroundColor: form.color }]}
                />
                <Text style={styles.colorHex}>{form.color.toUpperCase()}</Text>
                <Feather name="chevron-right" size={fontSize(18)} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Preview</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: tint(form.color),
                    alignSelf: "flex-start",
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: form.color }]}>
                  {form.label.trim() || "Service"}
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsFormOpen(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                    <Text style={styles.saveText}>
                      {editing ? "Update" : "Create"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={isColorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsColorOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.formCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick a Color</Text>
              <TouchableOpacity onPress={() => setIsColorOpen(false)}>
                <Feather name="x" size={fontSize(20)} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerWrap}>
              <ColorPicker
                color={tempColor}
                onColorChangeComplete={(c) => setTempColor(c)}
                thumbSize={28}
                sliderSize={28}
                noSnap
                row={false}
                swatches={false}
              />
            </View>

            <Text style={styles.fieldLabel}>Quick picks</Text>
            <View style={styles.presetRow}>
              {PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTempColor(c)}
                  style={[
                    styles.presetDot,
                    {
                      backgroundColor: c,
                      borderColor: tempColor.toLowerCase() === c.toLowerCase()
                        ? "#0F172A"
                        : "transparent",
                    },
                  ]}
                />
              ))}
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor: tint(tempColor),
                  alignSelf: "flex-start",
                  marginTop: 12,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: tempColor }]}>
                {form.label.trim() || "Service"}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsColorOpen(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  setForm((p) => ({ ...p, color: tempColor }));
                  setIsColorOpen(false);
                }}
              >
                <Text style={styles.saveText}>Use Color</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.formCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setIsFilterOpen(false)}>
                <Feather name="x" size={fontSize(20)} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusWrap}>
              {STATUS_FILTERS.map((opt) => {
                const on = draftStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.statusChip, on && styles.statusChipOn]}
                    onPress={() => setDraftStatus(opt.value)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        on && styles.statusChipTextOn,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.bottomRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDraftStatus("all")}
              >
                <Text style={styles.cancelText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={applyFilter}>
                <Text style={styles.saveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: wp(16), paddingBottom: hp(24) },
  emptyState: { alignItems: "center", paddingVertical: hp(60), gap: 6 },
  emptyText: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#334155",
    marginTop: 8,
  },
  emptySub: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(20),
    padding: wp(16),
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  badge: { borderRadius: wp(20), paddingHorizontal: wp(8), paddingVertical: hp(4) },
  badgeText: { fontSize: fontSize(10), fontFamily: fonts.semiBold, lineHeight: 16 },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: wp(32),
    height: hp(32),
    borderRadius: wp(10),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
    width: wp(56),
    height: hp(56),
    borderRadius: wp(15),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: wp(20),
  },
  formCard: {
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
  modalTitle: { fontSize: fontSize(18), fontFamily: fonts.semiBold, color: "#0F172A" },
  fieldLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    paddingVertical: 0,
    height: hp(48),
    fontSize: fontSize(14),
    color: colors.blackFont,
    fontFamily: fonts.regular,
    includeFontPadding: false,
    borderWidth: 0,
  },
  bottomRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    height: hp(48),
    borderRadius: wp(12),
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight:18
  },
  saveBtn: {
    flex: 1.3,
    height: hp(48),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
    
  saveText: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#FFFFFF",lineHeight:18 },
  colorSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(48),
    gap: 10,
  },
  colorDot: { width: 22, height: 22, borderRadius: wp(11) },
  colorHex: {
    flex: 1,
    fontSize: fontSize(15),
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  pickerWrap: { height: 280, marginBottom: 8 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetDot: { width: 30, height: 30, borderRadius: wp(15), borderWidth: 2 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: wp(16),
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: hp(48),
    paddingHorizontal: wp(14),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  searchInput: { flex: 1, fontSize: fontSize(15), color: "#0F172A" },
  filterBtn: {
    width: wp(48),
    height: hp(48),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: wp(5),
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  statusChip: {
    paddingHorizontal: wp(16),
    paddingVertical: 9,
    borderRadius: wp(20),
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusChipOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  statusChipText: { fontSize: fontSize(12), fontFamily:fonts.medium, color: "#475569" },
  statusChipTextOn: { color: "#FFFFFF" },
});
