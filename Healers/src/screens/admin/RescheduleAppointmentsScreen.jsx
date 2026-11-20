import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  bulkPostponeAppointments,
  getChildCustomSlotOptions,
  getUsersByRole,
} from "../../api/admin/api";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";
import { fontSize, hp, wp } from "../../utils/responsive";

const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const label = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
const prettyDay = (k) =>
  fromKey(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const prettyFull = (k) =>
  fromKey(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

// aaj ka din; agar local time 6 PM ya us ke baad hai to kal se start
const buildWeek = () => {
  const now = new Date();
  const offset = now.getHours() >= 18 ? 1 : 0;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + i);
    return {
      key: toKey(d),
      dow: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
    };
  });
};

const specsOf = (t) => [].concat(t.speciality ?? t.specialities ?? t.services ?? []).map(String);

/**
 * route.params:
 *  source: "child" | "therapist"
 *  name:   child ka naam (child screen se) ya therapist ka naam (therapist screen se)
 *  appointments: [{ id, childId, childName, date, startTime, endTime,
 *                   therapistId, therapistName, speciality }]
 */
export default function RescheduleAppointmentsScreen({ navigation, route }) {
  const { source, name, appointments = [] } = route.params || {};
  const fromChild = source === "child";
  const insets = useSafeAreaInsets();
  const week = useMemo(buildWeek, []);

  const [items, setItems] = useState(appointments);
  const [activeId, setActiveId] = useState(appointments[0]?.id);
  // id -> { therapistId, therapistName, date, custom, slot }
  const [plan, setPlan] = useState({});
  const [slotState, setSlotState] = useState({ slots: [], loading: false, message: "" });
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  // therapist change (sirf child screen se)
  const [tpOpen, setTpOpen] = useState(false);
  const [tpSearch, setTpSearch] = useState("");
  const [tpItems, setTpItems] = useState([]);
  const [tpLoading, setTpLoading] = useState(false);

  const active = items.find((a) => a.id === activeId);
  const p = plan[activeId] || {};
  const therapistId = String(p.therapistId || active?.therapistId || "");
  const therapistName = p.therapistName || active?.therapistName;
  const date = p.date || null;
  const minutes = active ? toMin(active.endTime) - toMin(active.startTime) : 0;

  const patch = (id, obj) => setPlan((prev) => ({ ...prev, [id]: { ...prev[id], ...obj } }));

  // slots: active appointment / therapist / date badalne par
  useEffect(() => {
    if (!active || !date || !therapistId) {
      setSlotState({ slots: [], loading: false, message: "" });
      return undefined;
    }
    let alive = true;
    setSlotState({ slots: [], loading: true, message: "" });
    getChildCustomSlotOptions(active.childId, { therapistId, date, sessionMinutes: minutes })
      .then((res) => {
        if (alive) setSlotState({ slots: res?.data?.slots || [], loading: false, message: res?.data?.reason || "" });
      })
      .catch((e) => {
        if (alive) {
          setSlotState({
            slots: [],
            loading: false,
            message: e?.response?.data?.message || "Could not load available times.",
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [activeId, therapistId, date, minutes]);

  // same speciality wale therapists
  useEffect(() => {
    if (!tpOpen) return undefined;
    let alive = true;
    setTpLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await getUsersByRole({ role: "Therapist", search: tpSearch.trim() });
        const list = (res?.data || []).filter(
          (t2) => !active?.speciality || specsOf(t2).includes(String(active.speciality)),
        );
        if (alive) setTpItems(list);
      } catch (e) {
        if (alive) setTpItems([]);
      } finally {
        if (alive) setTpLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [tpOpen, tpSearch, activeId]);

  // dusre selected appointments ke saath overlap (same therapist ya same child)
  const clashes = (s) =>
    items.some((o) => {
      if (o.id === activeId) return false;
      const q = plan[o.id];
      if (!q?.slot || q.date !== date) return false;
      const sameTherapist = String(q.therapistId || o.therapistId) === therapistId;
      const sameChild = String(o.childId) === String(active.childId);
      if (!sameTherapist && !sameChild) return false;
      return toMin(s.startTime) < toMin(q.slot.endTime) && toMin(q.slot.startTime) < toMin(s.endTime);
    });

  const pickWeekDay = (key) => patch(activeId, { date: key, custom: false, slot: null });
  const backToWeek = () => patch(activeId, { date: null, custom: false, slot: null });
  const pickTherapist = (t) => {
    patch(activeId, { therapistId: t._id || t.id, therapistName: t.fullName || t.name, slot: null });
    setTpOpen(false);
    setTpSearch("");
  };
  const onPickDate = (event, selected) => {
    setShowPicker(false);
    if (event?.type === "dismissed" || !selected) return;
    patch(activeId, { date: toKey(selected), custom: true, slot: null });
  };

  const ready = items.filter((a) => plan[a.id]?.slot && plan[a.id]?.date);

  const submit = async () => {
    if (!ready.length || busy) return;
    setBusy(true);
    try {
      const res = await bulkPostponeAppointments(
        ready.map((a) => ({
          childId: a.childId,
          appointmentId: a.id,
          therapistId: plan[a.id].therapistId || a.therapistId,
          date: plan[a.id].date,
          startTime: plan[a.id].slot.startTime,
          endTime: plan[a.id].slot.endTime,
        })),
      );
      const results = res?.data?.results || [];
      const failedIds = results.filter((r) => !r.success).map((r) => String(r.appointmentId));

      if (!res?.success && !results.length) {
        return Alert.alert("Could not reschedule", res?.message || "Please try again.");
      }
      if (!failedIds.length) {
        return Alert.alert("Done", `${ready.length} appointment(s) rescheduled.`, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
      // kuch fail: baqi screen par rehne dein
      const firstErr = results.find((r) => !r.success)?.message;
      const left = items.filter((a) => failedIds.includes(String(a.id)));
      setItems(left);
      setActiveId(left[0]?.id);
      setPlan((prev) => {
        const next = {};
        left.forEach((a) => (next[a.id] = { ...prev[a.id], slot: null }));
        return next;
      });
      Alert.alert("Partly done", `${results.length - failedIds.length} rescheduled, ${failedIds.length} failed.\n${firstErr || ""}`);
    } catch (e) {
      Alert.alert("Could not reschedule", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.main}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: hp(120) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading} numberOfLines={2}>{name}</Text>
        <Text style={styles.sub}>
          {items.length} appointment{items.length === 1 ? "" : "s"} selected. Tap one, then pick a new date and time.
        </Text>

        {/* appointments: right-to-left scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          {items.map((a) => {
            const q = plan[a.id];
            const on = a.id === activeId;
            return (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.85}
                style={[styles.apCard, on && styles.apCardOn]}
                onPress={() => setActiveId(a.id)}
              >
                {!fromChild && <Text style={styles.apChild} numberOfLines={1}>{a.childName}</Text>}
                <Text style={styles.apDate}>{prettyDay(a.date)}</Text>
                <Text style={styles.apTime}>{label(a)}</Text>
                {fromChild && <Text style={styles.apMeta} numberOfLines={1}>with {a.therapistName}</Text>}
                {q?.slot ? (
                  <View style={styles.apNew}>
                    <Feather name="check-circle" size={fontSize(12)} color="#15803D" />
                    <Text style={styles.apNewText} numberOfLines={1}>
                      {prettyDay(q.date)} · {label(q.slot)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.apPending}>Select new time</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!!active && (
          <>
            {/* therapist card: sirf child se aane par */}
            {fromChild && (
              <>
                <Text style={styles.label}>Therapist</Text>
                <View style={styles.tpCard}>
                  <View style={styles.tpTop}>
                    <View style={styles.tpIcon}>
                      <Feather name="user" size={fontSize(16)} color={colors.primary} />
                    </View>
                    <Text style={styles.tpName} numberOfLines={1}>{therapistName}</Text>
                    <TouchableOpacity style={styles.changeBtn} onPress={() => setTpOpen((v) => !v)}>
                      <Feather name="repeat" size={14} color={colors.primary} />
                      <Text style={styles.changeText}>{tpOpen ? "Close" : "Change"}</Text>
                    </TouchableOpacity>
                  </View>

                  {tpOpen && (
                    <View style={{ marginTop: 10 }}>
                      <View style={styles.searchBox}>
                        <Feather name="search" size={16} color="#94A3B8" />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search therapist..."
                          placeholderTextColor="#94A3B8"
                          value={tpSearch}
                          onChangeText={setTpSearch}
                        />
                      </View>
                      {tpLoading ? (
                        <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />
                      ) : tpItems.length === 0 ? (
                        <Text style={styles.muted}>No therapist with the same speciality.</Text>
                      ) : (
                        tpItems.map((t) => {
                          const id = String(t._id || t.id);
                          return (
                            <TouchableOpacity key={id} style={styles.tpRow} onPress={() => pickTherapist(t)}>
                              <View style={[styles.radio, id === therapistId && styles.radioOn]}>
                                {id === therapistId && <View style={styles.radioDot} />}
                              </View>
                              <Text style={styles.tpRowName} numberOfLines={1}>{t.fullName || t.name}</Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* date: week days ya single date */}
            <Text style={styles.label}>New date</Text>
            {p.custom && date ? (
              <View style={styles.customDateRow}>
                <TouchableOpacity style={styles.dateField} onPress={() => setShowPicker(true)}>
                  <Feather name="calendar" size={16} color={colors.primary} />
                  <Text style={styles.dateFieldText}>{prettyFull(date)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={backToWeek}>
                  <Text style={styles.linkText}>Week days</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
                  {week.map((d) => {
                    const on = date === d.key;
                    return (
                      <TouchableOpacity
                        key={d.key}
                        style={[styles.dayChip, on && styles.dayChipOn]}
                        onPress={() => pickWeekDay(d.key)}
                      >
                        <Text style={[styles.dayDow, on && styles.dayTextOn]}>{d.dow}</Text>
                        <Text style={[styles.dayNum, on && styles.dayTextOn]}>{d.day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.pickDateBtn} onPress={() => setShowPicker(true)}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={styles.linkText}>Pick a single date</Text>
                </TouchableOpacity>
              </>
            )}

            {/* slots */}
            <Text style={styles.label}>New start time</Text>
            {!date ? (
              <Text style={styles.muted}>Choose a date first.</Text>
            ) : slotState.loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.muted}>Checking availability...</Text>
              </View>
            ) : slotState.slots.length === 0 ? (
              <Text style={styles.muted}>{slotState.message || "No availability on this date."}</Text>
            ) : (
              <View style={styles.slotCard}>
                <Text style={styles.slotHint}>
                  {minutes} minute sessions. Crossed-out times are already booked.
                </Text>
                <View style={styles.slotWrap}>
                  {slotState.slots.map((s) => {
                    const on = p.slot?.startTime === s.startTime;
                    const off = !!s.booked || clashes(s);
                    return (
                      <TouchableOpacity
                        key={s.startTime}
                        disabled={off}
                        activeOpacity={0.8}
                        style={[styles.slot, on && styles.slotOn, off && styles.slotOff]}
                        onPress={() => patch(activeId, { slot: { startTime: s.startTime, endTime: s.endTime } })}
                      >
                        <Text style={[styles.slotText, on && styles.slotTextOn, off && styles.slotTextOff]}>
                          {label(s)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={fromKey(date || week[0].key)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={fromKey(week[0].key)}
          onValueChange={onPickDate} // jo prop aap ke Postpone modal mein chal raha hai wahi
          accentColor={colors.primary}
          themeVariant="light"
        />
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Text style={styles.footNote}>
          {ready.length} of {items.length} ready. Only appointments with a new time are rescheduled.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, (!ready.length || busy) && { opacity: 0.5 }]}
          disabled={!ready.length || busy}
          onPress={submit}
        >
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Reschedule ({ready.length})</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: wp(16) },
  heading: { fontSize: fontSize(19), fontFamily: fonts.bold, color: "#0F172A" },
  sub: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", marginTop: 4, marginBottom: hp(12) },
  label: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: hp(16), marginBottom: hp(8) },
  muted: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8" },
  linkText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: colors.primary },

  cardsRow: { gap: wp(10), paddingRight: wp(16) },
  apCard: {
    width: wp(190), padding: wp(12), borderRadius: wp(14), backgroundColor: "#FFFFFF",
    borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  apCardOn: { borderColor: colors.primary, backgroundColor: "#F0F9FF" },
  apChild: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0B4A6F", marginBottom: 2 },
  apDate: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  apTime: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#475569", marginTop: 2 },
  apMeta: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#94A3B8", marginTop: 2 },
  apPending: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#B45309", marginTop: 8 },
  apNew: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8,
    backgroundColor: "#DCFCE7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  apNewText: { flex: 1, fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#15803D" },

  tpCard: { backgroundColor: "#FFFFFF", borderRadius: wp(14), padding: wp(12), borderWidth: 1, borderColor: "#E2E8F0" },
  tpTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  tpIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8F2FC",
    alignItems: "center", justifyContent: "center",
  },
  tpName: { flex: 1, fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  changeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: wp(12),
    paddingVertical: 6, borderRadius: wp(20), backgroundColor: "#E8F2FC",
  },
  changeText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC",
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 12, height: hp(44),
  },
  searchInput: { flex: 1, fontSize: fontSize(14), color: "#0F172A" },
  tpRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  tpRowName: { flex: 1, fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1",
    alignItems: "center", justifyContent: "center",
  },
  radioOn: { borderColor: "#0B4A6F" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B4A6F" },

  weekRow: { gap: wp(8) },
  dayChip: {
    width: wp(52), paddingVertical: hp(10), borderRadius: wp(14), alignItems: "center",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
  },
  dayChipOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  dayDow: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#64748B" },
  dayNum: { fontSize: fontSize(16), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 2 },
  dayTextOn: { color: "#FFFFFF" },
  pickDateBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: hp(10), alignSelf: "flex-start" },
  customDateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateField: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#0B4A6F",
  },
  dateFieldText: { flex: 1, fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0F172A" },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  slotCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14 },
  slotHint: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "orange" },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  slot: {
    paddingHorizontal: wp(8), paddingVertical: 8, borderRadius: 10, borderWidth: 1,
    borderColor: "#CBD5E1", backgroundColor: "#F8FAFC",
  },
  slotOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  slotOff: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  slotText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: "#334155" },
  slotTextOn: { color: "#FFFFFF" },
  slotTextOff: { color: "#CBD5E1", textDecorationLine: "line-through" },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, padding: wp(16),
    backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E2E8F0",
  },
  footNote: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#64748B", marginBottom: 8 },
  primaryBtn: {
    height: hp(50), borderRadius: wp(12), backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  primaryText: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#FFFFFF" },
});