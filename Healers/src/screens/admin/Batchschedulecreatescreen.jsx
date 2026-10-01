import React, { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";

import {
  getBatchSlotOptions,
  getBatchTherapistOptions,
  previewBatchSchedule,
  saveBatchSchedule,
} from "../../api/admin/api";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";
import { therapistSpecialities } from "../../utils/specialities";

const DURATIONS = [45, 60, 90, 120];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAY = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const specMeta = (id) =>
  therapistSpecialities.find((s) => s.id === id) || { label: id, bg: "#E0F2FE", color: "#0B4A6F" };
const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const overlaps = (a, b) => mins(a.startTime) < mins(b.endTime) && mins(b.startTime) < mins(a.endTime);
const label = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
const prettyDay = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

export default function BatchScheduleCreateScreen({ navigation, route }) {
  const { batchId } = route.params;

  const [step, setStep] = useState(1);
  const [minutes, setMinutes] = useState(null);

  const [groups, setGroups] = useState([]); // [{ speciality, therapists:[...] }]
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [team, setTeam] = useState([]); // [{ key, therapistId, speciality, name }]

  const [options, setOptions] = useState({}); // key -> { Mon:[{startTime,endTime}] }
  const [blocked, setBlocked] = useState({}); // day -> [{startTime,endTime,therapistName}]
  const [picked, setPicked] = useState({}); // key -> { Mon:[slot] }
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [review, setReview] = useState(null);
  const [resolution, setResolution] = useState({}); // key -> "skip" | "remove"
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBatchTherapistOptions(batchId);
        setGroups(res?.data || []);
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.message || "Could not load therapists.");
      } finally {
        setLoadingGroups(false);
      }
    })();
  }, [batchId]);

  // ---------- step 1 ----------
  const toggleTherapist = (speciality, t) => {
    const key = `${t._id}|${speciality}`;
    setTeam((cur) =>
      cur.some((x) => x.key === key)
        ? cur.filter((x) => x.key !== key)
        : [...cur, { key, therapistId: t._id, speciality, name: t.fullName }],
    );
  };

  const goToSlots = async () => {
    if (!minutes) return Alert.alert("Session time", "Choose how long each session lasts.");
    if (!team.length) return Alert.alert("Therapists", "Select at least one therapist.");

    setLoadingSlots(true);
    try {
      const res = await getBatchSlotOptions(batchId, {
        sessionMinutes: minutes,
        therapists: team.map(({ therapistId, speciality }) => ({ therapistId, speciality })),
      });
      if (!res?.success) return Alert.alert("Error", res?.message || "Could not load slots.");

      const map = {};
      res.data.forEach((r) => {
        map[`${r.therapistId}|${r.speciality}`] = r.days;
      });
      setOptions(map);
      setBlocked(res.blocked || {});
      setPicked({});
      setStep(2);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.message || "Could not load slots.");
    } finally {
      setLoadingSlots(false);
    }
  };

  // ---------- step 2 ----------
  // why a slot can't be used (null = free). Covers times already used by the
  // batch and times picked for any other therapist / speciality.
  const takenReason = (key, day, slot) => {
    const b = (blocked[day] || []).find((x) => overlaps(x, slot));
    if (b) return `Already used by ${b.therapistName} in this batch.`;
    for (const other of team) {
      const hit = (picked[other.key]?.[day] || []).find(
        (x) => overlaps(x, slot) && !(other.key === key && x.startTime === slot.startTime),
      );
      if (hit) return `${other.name} already has ${label(hit)} on ${FULL_DAY[day]}.`;
    }
    return null;
  };

  const isPicked = (key, day, slot) =>
    (picked[key]?.[day] || []).some((x) => x.startTime === slot.startTime);

  const toggleSlot = (key, day, slot) => {
    if (isPicked(key, day, slot)) {
      setPicked((p) => ({
        ...p,
        [key]: { ...p[key], [day]: (p[key]?.[day] || []).filter((x) => x.startTime !== slot.startTime) },
      }));
      return;
    }
    const reason = takenReason(key, day, slot);
    if (reason) return Alert.alert("Time not available", reason);
    setPicked((p) => ({ ...p, [key]: { ...p[key], [day]: [...(p[key]?.[day] || []), slot] } }));
  };

  const removeFromTeam = (key) => {
    const next = team.filter((t) => t.key !== key);
    setTeam(next);
    setPicked((p) => {
      const { [key]: _drop, ...rest } = p;
      return rest;
    });
    if (!next.length) setStep(1);
  };

  const pickedCount = (key) => DAYS.reduce((n, d) => n + (picked[key]?.[d]?.length || 0), 0);

  const buildPlans = (skipMap = {}) =>
    team
      .filter((t) => skipMap[t.key] !== "remove")
      .map((t) => ({
        therapistId: t.therapistId,
        speciality: t.speciality,
        slots: DAYS.flatMap((d) =>
          (picked[t.key]?.[d] || []).map((s) => ({ day: d, startTime: s.startTime, endTime: s.endTime })),
        ),
      }));

  // ---------- review ----------
  const startReview = async () => {
    const missing = team.find((t) => pickedCount(t.key) === 0);
    if (missing) {
      return Alert.alert("Pick a slot", `${missing.name} has no slot selected. Pick one or remove them.`);
    }
    setBusy(true);
    try {
      const res = await previewBatchSchedule(batchId, { sessionMinutes: minutes, plans: buildPlans() });
      if (!res?.success) return Alert.alert("Error", res?.message || "Could not check the schedule.");
      setResolution({});
      setReview(res.data);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.message || "Could not check the schedule.");
    } finally {
      setBusy(false);
    }
  };

  const conflictGroups = useMemo(() => {
    const g = {};
    (review?.conflicts || []).forEach((c) => {
      const k = `${c.therapistId}|${c.speciality}`;
      (g[k] = g[k] || { key: k, name: c.therapistName, speciality: c.speciality, items: [] }).items.push(c);
    });
    return Object.values(g);
  }, [review]);

  const confirmSave = async () => {
    const plans = buildPlans(resolution);
    if (!plans.length) return Alert.alert("Nothing to create", "Every therapist was removed.");

    setBusy(true);
    try {
      const res = await saveBatchSchedule(batchId, { sessionMinutes: minutes, plans, skipConflicts: true });
      if (!res?.success) return Alert.alert("Could not save", res?.message || "Please try again.");
      setReview(null);
      const d = res.data || {};
      Alert.alert(
        "Schedule created",
        `${d.created} sessions for ${d.children} children.` +
          (d.skippedConflicts ? `\n${d.skippedConflicts} conflicting date(s) skipped.` : "") +
          (d.children === 0 ? "\nNo children yet. They join these sessions automatically when added." : ""),
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert("Could not save", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ---------- render ----------
  return (
    <SafeAreaView style={styles.main}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
        >
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{step === 1 ? "Session time & therapists" : "Choose weekly slots"}</Text>
          <Text style={styles.headerSub}>Step {step} of 2</Text>
        </View>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressBar, { flex: step }]} />
        <View style={{ flex: 2 - step }} />
      </View>

      {step === 1 ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>How long is each session?</Text>
          <View style={styles.row}>
            {DURATIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.durBtn, minutes === m && styles.durBtnOn]}
                onPress={() => setMinutes(m)}
              >
                <Text style={[styles.durText, minutes === m && styles.durTextOn]}>{m} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Therapists</Text>
          <Text style={styles.hint}>Pick one or more for each speciality of this batch.</Text>

          {loadingGroups ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            groups.map((g) => {
              const m = specMeta(g.speciality);
              return (
                <View key={g.speciality} style={styles.card}>
                  <View style={[styles.chip, { backgroundColor: m.bg }]}>
                    <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                  </View>

                  {g.therapists.length === 0 && (
                    <Text style={styles.muted}>No therapist has this speciality yet.</Text>
                  )}

                  {g.therapists.map((t) => {
                    const on = team.some((x) => x.key === `${t._id}|${g.speciality}`);
                    const off = !t.hasAvailability;
                    return (
                      <TouchableOpacity
                        key={t._id}
                        style={[styles.therapistRow, off && { opacity: 0.45 }]}
                        disabled={off}
                        onPress={() => toggleTherapist(g.speciality, t)}
                      >
                        <View style={[styles.checkbox, on && styles.checkboxOn]}>
                          {on && <Feather name="check" size={12} color="#FFF" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.therapistName}>{t.fullName}</Text>
                          {off && <Text style={styles.subText}>No availability set for this batch period</Text>}
                          {!off && t.alreadyAssigned && <Text style={styles.subText}>Already in this batch</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            {minutes} minute sessions. A time picked for one therapist is locked for everyone else, so
            the children never have two classes at once.
          </Text>

          {team.map((t) => {
            const m = specMeta(t.speciality);
            const count = pickedCount(t.key);
            return (
              <View key={t.key} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.therapistName}>{t.name}</Text>
                    <View style={[styles.chip, { backgroundColor: m.bg, marginTop: 4 }]}>
                      <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.countText}>{count} picked</Text>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => removeFromTeam(t.key)}>
                    <Feather name="x" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {DAYS.map((d) => {
                  const slots = options[t.key]?.[d] || [];
                  return (
                    <View key={d} style={styles.dayRow}>
                      <Text style={[styles.dayLabel, !slots.length && styles.muted]}>{d}</Text>
                      <View style={{ flex: 1 }}>
                        {slots.length === 0 ? (
                          <Text style={styles.muted}>No slot available on {FULL_DAY[d]}</Text>
                        ) : (
                          <View style={styles.slotWrap}>
                            {slots.map((s) => {
                              const on = isPicked(t.key, d, s);
                              const taken = !on && !!takenReason(t.key, d, s);
                              return (
                                <TouchableOpacity
                                  key={s.startTime}
                                  style={[styles.slot, on && styles.slotOn, taken && styles.slotTaken]}
                                  onPress={() => toggleSlot(t.key, d, s)}
                                >
                                  <Text
                                    style={[
                                      styles.slotText,
                                      on && styles.slotTextOn,
                                      taken && styles.slotTextTaken,
                                    ]}
                                  >
                                    {label(s)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {step === 1 ? (
          <TouchableOpacity
            style={[styles.primaryBtn, loadingSlots && { opacity: 0.6 }]}
            disabled={loadingSlots}
            onPress={goToSlots}
          >
            {loadingSlots ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Next</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={startReview}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Review schedule</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* review + conflicts */}
      <Modal visible={!!review} transparent animationType="slide" onRequestClose={() => setReview(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {review && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Review schedule</Text>
                  <TouchableOpacity onPress={() => setReview(null)}>
                    <Feather name="x" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.bigNumber}>{review.total} sessions</Text>
                  <Text style={styles.hint}>
                    for {review.children} {review.children === 1 ? "child" : "children"}. Children added later
                    join these sessions automatically.
                  </Text>

                  {review.perTherapist.map((p) => (
                    <View key={`${p.therapistId}|${p.speciality}`} style={styles.reviewRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.therapistName}>{p.name}</Text>
                        <Text style={styles.subText}>{specMeta(p.speciality).label}</Text>
                      </View>
                      <Text style={styles.countText}>{p.sessions} sessions</Text>
                    </View>
                  ))}

                  {review.unavailableCount > 0 && (
                    <Text style={styles.note}>
                      {review.unavailableCount} date(s) fall outside the therapist's availability and will be left out.
                    </Text>
                  )}

                  {conflictGroups.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { color: "#B91C1C" }]}>Conflicts</Text>
                      <Text style={styles.hint}>
                        These therapists (or children) are already booked. Skip the clashing dates, or remove the
                        therapist from this schedule.
                      </Text>

                      {conflictGroups.map((g) => {
                        const choice = resolution[g.key] || "skip";
                        return (
                          <View key={g.key} style={styles.conflictCard}>
                            <Text style={styles.conflictName}>
                              {g.name} · {specMeta(g.speciality).label}
                            </Text>
                            <Text style={styles.conflictCount}>{g.items.length} clashing date(s)</Text>

                            {g.items.slice(0, 3).map((c) => (
                              <View key={`${c.date}-${c.startTime}`} style={{ marginTop: 6 }}>
                                <Text style={styles.conflictLine}>
                                  {prettyDay(c.date)} · {label(c)}
                                </Text>
                                {c.reasons.map((r) => (
                                  <Text key={r} style={styles.conflictReason}>
                                    {r}
                                  </Text>
                                ))}
                              </View>
                            ))}
                            {g.items.length > 3 && <Text style={styles.conflictReason}>+{g.items.length - 3} more</Text>}

                            <View style={styles.segment}>
                              {[
                                { id: "skip", text: "Skip these dates" },
                                { id: "remove", text: "Remove therapist" },
                              ].map((o) => (
                                <TouchableOpacity
                                  key={o.id}
                                  style={[styles.segBtn, choice === o.id && styles.segBtnOn]}
                                  onPress={() => setResolution((r) => ({ ...r, [g.key]: o.id }))}
                                >
                                  <Text style={[styles.segText, choice === o.id && styles.segTextOn]}>{o.text}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                </ScrollView>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setReview(null)} disabled={busy}>
                    <Text style={styles.secondaryText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1.4, marginTop: 0 }, busy && { opacity: 0.6 }]}
                    disabled={busy}
                    onPress={confirmSave}
                  >
                    {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create sessions</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: "#0F172A" },
  headerSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  progress: { flexDirection: "row", height: 3, marginHorizontal: 16, backgroundColor: "#E2E8F0", borderRadius: 2 },
  progressBar: { backgroundColor: colors.primary, borderRadius: 2 },

  content: { padding: 16, paddingBottom: 120 },
  sectionTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", lineHeight: 18, marginBottom: 8 },
  muted: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8" },
  subText: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  note: { fontSize: 12, fontFamily: fonts.regular, color: "#B45309", marginTop: 10, lineHeight: 18 },

  row: { flexDirection: "row", gap: 10 },
  durBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  durBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  durText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#334155" },
  durTextOn: { color: "#FFFFFF" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, marginTop: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  chipText: { fontSize: 11, fontFamily: fonts.semiBold },

  therapistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  therapistName: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  countText: { fontSize: 12, fontFamily: fonts.semiBold, color: "#0B4A6F" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  dayRow: { flexDirection: "row", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  dayLabel: { width: 42, fontSize: 13, fontFamily: fonts.semiBold, color: "#0F172A", paddingTop: 6 },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  slotOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  slotTaken: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  slotText: { fontSize: 12, fontFamily: fonts.semiBold, color: "#334155" },
  slotTextOn: { color: "#FFFFFF" },
  slotTextTaken: { color: "#CBD5E1", textDecorationLine: "line-through" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  primaryBtn: {
    marginTop: 0,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFFFFF" },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.primary },

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 26,
    maxHeight: "90%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 19, fontFamily: fonts.semiBold, color: "#0F172A" },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 14 },
  bigNumber: { fontSize: 26, fontFamily: fonts.semiBold, color: "#0B4A6F" },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },

  conflictCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  conflictName: { fontSize: 14, fontFamily: fonts.semiBold, color: "#991B1B" },
  conflictCount: { fontSize: 12, fontFamily: fonts.regular, color: "#B91C1C", marginTop: 2 },
  conflictLine: { fontSize: 12, fontFamily: fonts.semiBold, color: "#7F1D1D" },
  conflictReason: { fontSize: 12, fontFamily: fonts.regular, color: "#7F1D1D", marginTop: 1 },
  segment: { flexDirection: "row", backgroundColor: "#FEE2E2", borderRadius: 10, padding: 3, marginTop: 12 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segBtnOn: { backgroundColor: "#FFFFFF" },
  segText: { fontSize: 12, fontFamily: fonts.semiBold, color: "#B91C1C" },
  segTextOn: { color: "#7F1D1D" },
});