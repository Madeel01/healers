import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

import {
  createAvailability,
  deleteAvailability,
  getAvailability,
  updateAvailability,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import { colors, fonts } from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const FULL_DAY = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const DEFAULT_START = "09:00";
const DEFAULT_END = "13:00";

const pad = (n) => String(n).padStart(2, "0");
const dateToKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const dateToTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const timeToDate = (t) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const prettyDate = (k) =>
  keyToDate(k).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const summarizeDays = (days = []) => {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && WEEKDAYS.every((d) => days.includes(d))) return "Mon – Fri";
  return days.join(", ");
};

const timeLabel = (start, end) => formatTo12Hour(`${start}-${end}`);

// per-day form state: every weekday has its own on/off + times
const emptyDays = (enabledDays = WEEKDAYS) =>
  DAYS.reduce((acc, d) => {
    acc[d] = { enabled: enabledDays.includes(d), startTime: DEFAULT_START, endTime: DEFAULT_END };
    return acc;
  }, {});

const emptyForm = () => ({
  type: "recurring",
  days: emptyDays(),
  effectiveFrom: dateToKey(new Date()),
  date: "",
  startTime: DEFAULT_START,
  endTime: DEFAULT_END,
});

export default function TherapistAvailabilityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { therapistId, therapistName } = route.params || {};

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null); // full rule being edited (type is locked)
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null); // { field: 'date'|'startTime'|'endTime', day?: 'Mon' }

  const [detailRule, setDetailRule] = useState(null);

  const isEdit = editingRule !== null;

  const fetchRules = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const res = await getAvailability({ therapistId });
        setRules(res?.data || []);
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.message || "Could not load availability.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [therapistId],
  );

  useFocusEffect(
    useCallback(() => {
      fetchRules();
    }, [fetchRules]),
  );

  const setField = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const setDayField = (day, field, value) =>
    setForm((p) => ({ ...p, days: { ...p.days, [day]: { ...p.days[day], [field]: value } } }));

  const toggleDay = (day) => setDayField(day, "enabled", !form.days[day].enabled);

  const selectWeekdays = () =>
    setForm((p) => ({
      ...p,
      days: DAYS.reduce((acc, d) => {
        acc[d] = { ...p.days[d], enabled: WEEKDAYS.includes(d) };
        return acc;
      }, {}),
    }));

  // copy the first enabled day's times onto every enabled day
  const applySameTimes = () => {
    const first = DAYS.find((d) => form.days[d].enabled);
    if (!first) return;
    const { startTime, endTime } = form.days[first];
    setForm((p) => ({
      ...p,
      days: DAYS.reduce((acc, d) => {
        acc[d] = p.days[d].enabled ? { ...p.days[d], startTime, endTime } : p.days[d];
        return acc;
      }, {}),
    }));
  };

  const openAdd = () => {
    setEditingRule(null);
    setForm(emptyForm());
    setPicker(null);
    setModalOpen(true);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    if (rule.type === "recurring") {
      const days = emptyDays([]);
      (rule.slots || []).forEach((s) => {
        days[s.day] = { enabled: true, startTime: s.startTime, endTime: s.endTime };
      });
      setForm({ ...emptyForm(), type: "recurring", days, effectiveFrom: rule.effectiveFrom || dateToKey(new Date()), effectiveTo: rule.effectiveTo || "" });
    } else {
      setForm({
        ...emptyForm(),
        type: "custom",
        date: rule.date || "",
        startTime: rule.startTime,
        endTime: rule.endTime,
      });
    }
    setPicker(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setPicker(null);
    setModalOpen(false);
  };

  const validate = () => {
    if (form.type === "recurring") {
      const enabled = DAYS.filter((d) => form.days[d].enabled);
      if (enabled.length === 0) {
        Alert.alert("Missing info", "Select at least one day.");
        return false;
      }
      for (const d of enabled) {
        if (form.days[d].endTime <= form.days[d].startTime) {
          Alert.alert("Invalid time", `${FULL_DAY[d]}: end time must be after start time.`);
          return false;
        }
      }
      return true;
    }
    if (!form.date) {
      Alert.alert("Missing info", "Select a date.");
      return false;
    }
    if (form.endTime <= form.startTime) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return false;
    }
    if (form.effectiveTo && form.effectiveTo < form.effectiveFrom) {
        Alert.alert("Invalid dates", "End date cannot be before start date.");
        return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (saving || !validate()) return;

    const payload =
      form.type === "recurring"
        ? {
            therapistId,
            type: "recurring",
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo || null,
            slots: DAYS.filter((d) => form.days[d].enabled).map((d) => ({
              day: d,
              startTime: form.days[d].startTime,
              endTime: form.days[d].endTime,
            })),
          }
        : {
            therapistId,
            type: "custom",
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
          };

    setSaving(true);
    try {
      if (isEdit) {
        await updateAvailability(editingRule._id, payload);
      } else {
        await createAvailability(payload);
      }
      setPicker(null);
      setModalOpen(false);
      await fetchRules();
    } catch (e) {
      Alert.alert("Could not save", e?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (rule) => {
    setDeletingId(rule._id);
    try {
      await deleteAvailability(rule._id);
      setRules((prev) => prev.filter((r) => r._id !== rule._id));
    } catch (e) {
      Alert.alert("Could not delete", e?.response?.data?.message || "Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (rule) => {
    Alert.alert("Delete availability", "Remove this availability?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => doDelete(rule) },
    ]);
  };

  // ---------- date / time picker ----------
  const isTimePicker = picker && !["date", "effectiveFrom","effectiveTo"].includes(picker.field);

  const pickerValue = () => {
    if (!picker) return new Date();
    const raw = picker.day ? form.days[picker.day][picker.field] : form[picker.field];
    if (isTimePicker) return timeToDate(raw);
    return raw ? keyToDate(raw) : new Date();
  };

  const onPickerChange = (event, selected) => {
    if (Platform.OS === "android") setPicker(null);
    if (!selected || !picker) return;
    const value = isTimePicker ? dateToTime(selected) : dateToKey(selected);
    if (picker.day) setDayField(picker.day, picker.field, value);
    else setField(picker.field, value);
  };

  const renderPicker = () => (
    <View>
      <DateTimePicker
        value={pickerValue()}
        mode={isTimePicker ? "time" : "date"}
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onValueChange={onPickerChange}
        onDismiss={() => setPicker(null)}
      />
      {Platform.OS === "ios" && (
        <TouchableOpacity style={styles.pickerDone} onPress={() => setPicker(null)}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ---------- list ----------
  const renderRule = ({ item }) => {
    const isCustom = item.type === "custom";
    const slots = item.slots || [];
    const sameTimes =
      slots.length > 0 &&
      slots.every((s) => s.startTime === slots[0].startTime && s.endTime === slots[0].endTime);

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setDetailRule(item)}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, isCustom ? styles.badgeCustom : styles.badgeWeekly]}>
            <Text style={[styles.typeBadgeText, isCustom ? styles.badgeCustomText : styles.badgeWeeklyText]}>
              {isCustom ? "Specific date" : "Every week"}
            </Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
              <Feather name="edit-2" size={16} color="#0B4A6F" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              disabled={deletingId === item._id}
              onPress={() => handleDelete(item)}
            >
              {deletingId === item._id ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Feather name="trash-2" size={16} color="#EF4444" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.cardTitle}>
          {isCustom ? prettyDate(item.date) : summarizeDays(slots.map((s) => s.day))}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="clock" size={14} color="#64748B" />
          <Text style={styles.metaText}>
            {isCustom
              ? timeLabel(item.startTime, item.endTime)
              : sameTimes
                ? timeLabel(slots[0].startTime, slots[0].endTime)
                : "Different times each day"}
          </Text>
        </View>
        {!isCustom && item.effectiveFrom && (
            <View style={styles.metaRow}>
                <Feather name="calendar" size={14} color="#64748B" />
                <Text style={styles.metaText}>
                    From {prettyDate(item.effectiveFrom)}
                    {item.effectiveTo ? ` until ${prettyDate(item.effectiveTo)}` : " · no end date"}
                </Text>
            </View>
        )}

        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>View details</Text>
          <Feather name="chevron-right" size={14} color="#94A3B8" />
        </View>
      </TouchableOpacity>
    );
  };

  const modalTitle = !isEdit
    ? "Add Availability"
    : editingRule.type === "recurring"
      ? "Edit Weekly Availability"
      : "Edit Specific Date";

  return (
    <SafeAreaView style={styles.mainContainer}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle="Availability"
      />

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(item) => item._id}
          renderItem={renderRule}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchRules(true)} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>{therapistName || "Therapist"}</Text>
              <Text style={styles.pageSubTitle}>
                Set when this therapist is free. Classes can only be scheduled inside these times.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="clock" size={36} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No availability yet</Text>
              <Text style={styles.emptySub}>Tap + to add the first one.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 90 }]} onPress={openAdd} activeOpacity={0.85}>
        <Feather name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ============ DETAILS MODAL ============ */}
      <Modal
        visible={!!detailRule}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailRule(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {detailRule && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {detailRule.type === "custom" ? "Specific Date" : "Weekly Availability"}
                  </Text>
                  <TouchableOpacity onPress={() => setDetailRule(null)}>
                    <Feather name="x" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailSub}>{therapistName || "Therapist"}</Text>
                {detailRule.type === "recurring" && detailRule.effectiveFrom && (
                    <Text style={styles.detailSub}>
                        From {prettyDate(detailRule.effectiveFrom)}
                        {detailRule.effectiveTo ? ` until ${prettyDate(detailRule.effectiveTo)}` : " · no end date"}
                    </Text>
                )}
                <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {detailRule.type === "custom" ? (
                    <View style={styles.detailRow}>
                      <View>
                        <Text style={styles.detailDay}>{prettyDate(detailRule.date)}</Text>
                      </View>
                      <Text style={styles.detailTime}>
                        {timeLabel(detailRule.startTime, detailRule.endTime)}
                      </Text>
                    </View>
                  ) : (
                    (detailRule.slots || []).map((s) => (
                      <View key={s.day} style={styles.detailRow}>
                        <Text style={styles.detailDay}>{FULL_DAY[s.day]}</Text>
                        <Text style={styles.detailTime}>{timeLabel(s.startTime, s.endTime)}</Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      const r = detailRule;
                      setDetailRule(null);
                      handleDelete(r);
                    }}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      const r = detailRule;
                      setDetailRule(null);
                      openEdit(r);
                    }}
                  >
                    <Text style={styles.saveBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ============ ADD / EDIT MODAL ============ */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!isEdit && (
                <>
                  <Text style={styles.fieldLabel}>Repeat</Text>
                  <View style={styles.segment}>
                    {[
                      { id: "recurring", label: "Every week" },
                      { id: "custom", label: "Specific date" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.segmentBtn, form.type === opt.id && styles.segmentBtnActive]}
                        onPress={() => {
                          setPicker(null);
                          setField("type", opt.id);
                        }}
                      >
                        <Text style={[styles.segmentText, form.type === opt.id && styles.segmentTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {form.type === "recurring" ? (
                <>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Days</Text>
                    <View style={styles.linksRow}>
                      <TouchableOpacity onPress={selectWeekdays}>
                        <Text style={styles.linkText}>Mon - Fri</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={applySameTimes}>
                        <Text style={styles.linkText}>Same time for all</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.daysRow}>
                    {DAYS.map((day) => {
                      const active = form.days[day].enabled;
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.dayChip, active && styles.dayChipActive]}
                          onPress={() => {
                            setPicker(null);
                            toggleDay(day);
                          }}
                        >
                          <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                    <Text style={styles.fieldLabel}>Starting from</Text>
                    <TouchableOpacity style={styles.selector} onPress={() => setPicker({ field: "effectiveFrom" })}>
                    <Text style={styles.selectorText}>
                        {form.effectiveFrom ? prettyDate(form.effectiveFrom) : "Select date"}
                    </Text>
                    <Feather name="calendar" size={18} color="#64748B" />
                    </TouchableOpacity>
                    {picker?.field === "effectiveFrom" && renderPicker()}
                    <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Until (optional)</Text>
                    {!!form.effectiveTo && (
                        <TouchableOpacity onPress={() => setField("effectiveTo", "")}>
                        <Text style={styles.linkText}>No end date</Text>
                        </TouchableOpacity>
                    )}
                    </View>
                    <TouchableOpacity style={styles.selector} onPress={() => setPicker({ field: "effectiveTo" })}>
                    <Text style={[styles.selectorText, !form.effectiveTo && styles.placeholder]}>
                        {form.effectiveTo ? prettyDate(form.effectiveTo) : "No end date"}
                    </Text>
                    <Feather name="calendar" size={18} color="#64748B" />
                    </TouchableOpacity>
                    {picker?.field === "effectiveTo" && renderPicker()}
                  {DAYS.filter((d) => form.days[d].enabled).map((day) => (
                    <View key={day} style={styles.dayBlock}>
                      <Text style={styles.dayBlockTitle}>{FULL_DAY[day]}</Text>
                      <View style={styles.timeRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.smallLabel}>Start</Text>
                          <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPicker({ field: "startTime", day })}
                          >
                            <Text style={styles.selectorText}>{formatTo12Hour(form.days[day].startTime)}</Text>
                            <Feather name="clock" size={16} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.smallLabel}>End</Text>
                          <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPicker({ field: "endTime", day })}
                          >
                            <Text style={styles.selectorText}>{formatTo12Hour(form.days[day].endTime)}</Text>
                            <Feather name="clock" size={16} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {picker?.day === day && renderPicker()}
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TouchableOpacity style={styles.selector} onPress={() => setPicker({ field: "date" })}>
                    <Text style={[styles.selectorText, !form.date && styles.placeholder]}>
                      {form.date ? prettyDate(form.date) : "Select date"}
                    </Text>
                    <Feather name="calendar" size={18} color="#64748B" />
                  </TouchableOpacity>

                  <View style={styles.timeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Start time</Text>
                      <TouchableOpacity style={styles.selector} onPress={() => setPicker({ field: "startTime" })}>
                        <Text style={styles.selectorText}>{formatTo12Hour(form.startTime)}</Text>
                        <Feather name="clock" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>End time</Text>
                      <TouchableOpacity style={styles.selector} onPress={() => setPicker({ field: "endTime" })}>
                        <Text style={styles.selectorText}>{formatTo12Hour(form.endTime)}</Text>
                        <Feather name="clock" size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {picker && !picker.day && renderPicker()}
                </>
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{isEdit ? "Update" : "Save"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomBar activeTab="Therapist" onOpenNotifications={setIsNotificationOpen} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 140, flexGrow: 1 },

  headerBlock: { marginBottom: 16 },
  pageTitle: { fontSize: 22, fontFamily: fonts.semiBold, color: "#181C1E", lineHeight: 30 },
  pageSubTitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.blackFont, lineHeight: 19, marginTop: 2 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  typeBadgeText: { fontSize: 11, fontFamily: fonts.semiBold },
  badgeWeekly: { backgroundColor: "#E0F2FE" },
  badgeWeeklyText: { color: "#0B4A6F" },
  badgeCustom: { backgroundColor: "#FEF3C7" },
  badgeCustomText: { color: "#B45309" },
  cardActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: "#0F172A", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  metaText: { fontSize: 13, fontFamily: fonts.regular, color: "#475569" },
  tapHint: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 6 },
  tapHintText: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8" },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 6 },
  emptyTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: "#334155", marginTop: 6 },
  emptySub: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8" },

  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: "90%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A" },

  detailSub: { fontSize: 13, fontFamily: fonts.regular, color: "#64748B" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailDay: { fontSize: 15, fontFamily: fonts.semiBold, color: "#0F172A" },
  detailTime: { fontSize: 14, fontFamily: fonts.regular, color: "#475569" },

  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6, marginTop: 14 },
  smallLabel: { fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 4 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  linksRow: { flexDirection: "row", gap: 14 },
  linkText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary, marginBottom: 6 },

  segment: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#475569" },
  segmentTextActive: { color: "#FFFFFF" },

  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayChipActive: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  dayChipText: { fontSize: 13, fontFamily: fonts.semiBold, color: "#475569" },
  dayChipTextActive: { color: "#FFFFFF" },

  dayBlock: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayBlockTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", marginBottom: 8 },

  selector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  selectorText: { fontSize: 14, fontFamily: fonts.regular, color: "#0F172A" },
  placeholder: { color: "#94A3B8" },
  timeRow: { flexDirection: "row", gap: 12 },

  pickerDone: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 12 },
  pickerDoneText: { fontSize: 15, fontFamily: fonts.bold, color: "#0B598F" },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.primary },
  deleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#EF4444" },
  saveBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFFFFF" },
});