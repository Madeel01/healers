import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, fonts } from "../../styles/theme";
import {
  createService,
  deleteService,
  getServices,
  updateService,
} from "../../api/admin/api";
import ColorPicker from "react-native-wheel-color-picker";

const PRESETS = [
  "#C2410C", "#991B1B", "#065F46", "#854D0E",
  "#1D4ED8", "#6D28D9", "#9D174D", "#155E75",
];

const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const tint = (hex, amount = 0.85) => {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return (
    "#" +
    [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")
  );
};

const emptyForm = { label: "", color: PRESETS[0] };

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

  const fetchItems = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getServices({ includeInactive: true });
      if (res.success) setItems(res.data || []);
    } catch (err) {
      console.log("Fetch services error:", err);
      Alert.alert("Error", "Failed to load services.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => fetchItems());
    return unsub;
  }, [navigation, fetchItems]);

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
        fetchItems();
      } else {
        Alert.alert("Error", res.message || "Something went wrong.");
      }
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item, value) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: value } : i)));
    try {
      const res = await updateService(item.id, { isActive: value });
      if (!res.success) throw new Error(res.message);
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
            Alert.alert("Cannot delete", err?.response?.data?.message || "Failed to delete.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Services"}
      />

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchItems(true)}
              colors={[colors.primary]}
            />
          }
        >
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="briefcase" size={32} color="#94A3B8" />
              <Text style={styles.emptyText}>No services yet</Text>
              <Text style={styles.emptySub}>Tap + to add your first service.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={[styles.card, !item.isActive && { opacity: 0.55 }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: item.bg }]}>
                    <Text style={[styles.badgeText, { color: item.color }]}>{item.label}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                      <Feather name="edit-2" size={16} color="#0B4A6F" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{item.isActive ? "Active" : "Inactive"}</Text>
                    <Switch
                      value={item.isActive}
                      onValueChange={(v) => handleToggleActive(item, v)}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 90 }]} onPress={openCreate}>
        <Feather name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={isFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFormOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.formCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? "Edit Service" : "Add Service"}</Text>
              <TouchableOpacity onPress={() => setIsFormOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Service Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Counselling"
              placeholderTextColor="#94A3B8"
              value={form.label}
              onChangeText={(t) => setForm((p) => ({ ...p, label: t }))}
            />

            <Text style={styles.fieldLabel}>Color</Text>
            <TouchableOpacity
            style={styles.colorSelector}
            onPress={() => {
                setTempColor(form.color);
                setIsColorOpen(true);
            }}
            >
            <View style={[styles.colorDot, { backgroundColor: form.color }]} />
            <Text style={styles.colorHex}>{form.color.toUpperCase()}</Text>
            <Feather name="chevron-right" size={18} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Preview</Text>
            <View style={[styles.badge, { backgroundColor: tint(form.color), alignSelf: "flex-start" }]}>
                <Text style={[styles.badgeText, { color: form.color }]}>
                    {form.label.trim() || "Service"}
                </Text>
            </View>

            <View style={styles.bottomRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsFormOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>{editing ? "Update" : "Create"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
            <Feather name="x" size={20} color="#64748B" />
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
                { backgroundColor: c, borderColor: tempColor.toLowerCase() === c.toLowerCase() ? "#0F172A" : "transparent" },
                ]}
            />
            ))}
        </View>

        <View style={[styles.badge, { backgroundColor: tint(tempColor), alignSelf: "flex-start", marginTop: 12 }]}>
            <Text style={[styles.badgeText, { color: tempColor }]}>
            {form.label.trim() || "Service"}
            </Text>
        </View>

        <View style={styles.bottomRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsColorOpen(false)}>
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
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, paddingBottom: 120 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 6 },
  emptyText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#334155", marginTop: 8 },
  emptySub: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontSize: 13, fontFamily: fonts.semiBold },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },

  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 15,
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
    padding: 20,
  },
  formCard: {
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
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },
  bottomRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary },
  saveBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontFamily: fonts.semiBold, color: "#FFFFFF" },
  colorSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    },
    colorDot: { width: 22, height: 22, borderRadius: 11 },
    colorHex: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: "#0F172A" },
    pickerWrap: { height: 280, marginBottom: 8 },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    presetDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
});