import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect } from "@react-navigation/native";

import {
  deleteChildCustomAppointment,
  getChildBatchOptions,
  getChildSchedule,
  updateBatchChildren,
} from "../../api/admin/api";
import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";
import { therapistSpecialities } from "../../utils/specialities";

const PAGE = 20;

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "batches", label: "Batches" },
];

const TYPE_META = {
  additional: { label: "Additional", bg: "#EDE9FE", color: "#6D28D9" },
  alternate: { label: "Alternate", bg: "#DBEAFE", color: "#1D4ED8" },
  postponed: { label: "Postponed", bg: "#FEF3C7", color: "#B45309" },
  cancel: { label: "Cancelled", bg: "#FEE2E2", color: "#B91C1C" },
};
const ATT = {
  Complete: { label: "Attended", bg: "#DCFCE7", color: "#15803D" },
  Absent: { label: "Absent", bg: "#FEE2E2", color: "#B91C1C" },
  NotMarked: { label: "Not marked", bg: "#F1F5F9", color: "#64748B" },
};

const pad = (n) => String(n).padStart(2, "0");
const dateToKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const prettyDay = (k) =>
  keyToDate(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const prettyFull = (k) =>
  keyToDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const timeRange = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
const specMeta = (id) =>
  therapistSpecialities.find((s) => s.id === id) || { label: id, bg: "#E0F2FE", color: "#0B4A6F" };
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const groupByDate = (list) => {
  const out = [];
  list.forEach((s) => {
    const last = out[out.length - 1];
    if (last && last.date === s.date) last.items.push(s);
    else out.push({ date: s.date, items: [s] });
  });
  return out;
};

const isInactive = (s) => s.sessionType === "cancel" || s.sessionType === "postponed";

// attended / absent chip; "Not marked" only for sessions that already happened
const attendanceMeta = (s) => {
  if (isInactive(s)) return null;
  if (s.attendance === "Complete") return ATT.Complete;
  if (s.attendance === "Absent") return ATT.Absent;
  return s.isPast ? ATT.NotMarked : null;
};

// ---------- row (declared outside the screen so it never remounts) ----------
function SessionRow({ s, onPress }) {
  const isCustom = s.type === "custom";
  const spec = s.speciality ? specMeta(s.speciality) : null;
  const tm = TYPE_META[s.sessionType];
  const att = attendanceMeta(s);

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={() => onPress(s)}>
      <View style={[styles.sessionRow, s.sessionType === "cancel" && styles.sessionRowCancelled]}>
        <View
          style={[
            styles.sessionBar,
            { backgroundColor: isCustom ? "#8B5CF6" : s.sessionType === "cancel" ? "#EF4444" : spec?.color || "#0B4A6F" },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionTime, isInactive(s) && styles.struck]}>{timeRange(s)}</Text>
          <Text style={styles.sessionSub} numberOfLines={1}>
            {isCustom ? "Custom appointment" : s.batchName}
          </Text>
          <Text style={styles.sessionMeta} numberOfLines={1}>
            with {s.therapistName}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {att && (
            <View style={[styles.chip, { backgroundColor: att.bg }]}>
              <Text style={[styles.chipText, { color: att.color }]}>{att.label}</Text>
            </View>
          )}
          {tm && (
            <View style={[styles.chip, { backgroundColor: tm.bg }]}>
              <Text style={[styles.chipText, { color: tm.color }]}>{tm.label}</Text>
            </View>
          )}
          {!att && !tm && isCustom && (
            <View style={[styles.chip, { backgroundColor: "#F3E8FF" }]}>
              <Text style={[styles.chipText, { color: "#6B21A8" }]}>Custom</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

export default function ChildScheduleScreen({ navigation, route }) {
  const { childId, childName } = route.params || {};

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState("upcoming");
  const [pastLimit, setPastLimit] = useState(PAGE);
  const [detail, setDetail] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // enroll modal
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [optLoading, setOptLoading] = useState(false);
  const [pickedBatch, setPickedBatch] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const res = await getChildSchedule(childId);
        if (res?.success) setData(res.data);
        else Alert.alert("Error", res?.message || "Could not load the schedule.");
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.message || "Could not load the schedule.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [childId],
  );

  useFocusEffect(
    useCallback(() => {
      if (childId) load();
    }, [childId, load]),
  );

  // batches the child can join
  useEffect(() => {
    if (!enrollOpen) return undefined;
    let alive = true;
    setOptLoading(true);
    setOptions([]);
    setPickedBatch(null);
    (async () => {
      try {
        const res = await getChildBatchOptions(childId);
        if (alive) setOptions(res?.data || []);
      } catch (e) {
        if (alive) Alert.alert("Error", e?.response?.data?.message || "Could not load batches.");
      } finally {
        if (alive) setOptLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enrollOpen, childId]);

  const today = data?.today || dateToKey(new Date());
  const upcoming = data?.upcoming || [];
  const past = data?.past || [];
  const batches = data?.batches || [];
  const stats = data?.stats || { present: 0, absent: 0, notMarked: 0, total: 0 };
  const child = data?.child;

  const marked = stats.present + stats.absent;
  const rate = marked > 0 ? `${Math.round((stats.present / marked) * 100)}%` : "-";
  const activeUpcoming = upcoming.filter((s) => !isInactive(s));

  const relLabel = (key) => {
    if (key === today) return "Today";
    const t = keyToDate(today);
    t.setDate(t.getDate() + 1);
    return key === dateToKey(t) ? "Tomorrow" : null;
  };

  const goCustom = () => navigation.navigate("ChildCustomAppointment", { childId, childName });

  const enroll = async () => {
    if (!pickedBatch || enrolling) return;
    setEnrolling(true);
    try {
      const res = await updateBatchChildren(pickedBatch, { addChildIds: [childId] });
      if (!res?.success) return Alert.alert("Could not enroll", res?.message || "Please try again.");
      const skipped = res.data?.skippedSessions || 0;
      setEnrollOpen(false);
      await load();
      Alert.alert(
        "Enrolled",
        skipped
          ? `Added to the upcoming sessions. ${skipped} session(s) were skipped because the child is already booked at that time.`
          : "Added to every upcoming session of this batch.",
      );
    } catch (e) {
      Alert.alert("Could not enroll", e?.response?.data?.message || "Please try again.");
    } finally {
      setEnrolling(false);
    }
  };

  const removeFromBatch = (b) =>
    Alert.alert(
      "Remove from batch",
      `Remove ${data?.child?.fullName || "this child"} from ${b.batchName}? Their upcoming pending sessions in this batch will be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingId(String(b._id));
              const res = await updateBatchChildren(b._id, { removeChildIds: [childId] });
              if (!res?.success) return Alert.alert("Could not remove", res?.message || "Please try again.");
              await load();
            } catch (e) {
              Alert.alert("Could not remove", e?.response?.data?.message || "Please try again.");
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
    );

  const cancelAppointment = (s) =>
    Alert.alert("Cancel appointment", `Cancel the appointment on ${prettyFull(s.date)}?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel appointment",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelling(true);
            const res = await deleteChildCustomAppointment(childId, s.id);
            if (!res?.success) return Alert.alert("Could not cancel", res?.message || "Please try again.");
            setDetail(null);
            await load();
          } catch (e) {
            Alert.alert("Could not cancel", e?.response?.data?.message || "Please try again.");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);

  const header = (
    <TopBar
      navigation={navigation}
      isNotificationOpen={isNotificationOpen}
      onToggleNotification={setIsNotificationOpen}
      headerTitle="Child Schedule"
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.main}>
        {header}
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <BottomBar activeTab="Children" onOpenNotifications={setIsNotificationOpen} />
      </SafeAreaView>
    );
  }

  const detailAtt = detail ? attendanceMeta(detail) : null;

  return (
    <SafeAreaView style={styles.main}>
      {header}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}
      >
        {/* summary */}
        <View style={styles.summary}>
          <Text style={styles.title}>{child?.fullName || childName || "Child"}</Text>
          {!!child?.fatherName && <Text style={styles.subtitle}>Parent: {child.fatherName}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{rate}</Text>
              <Text style={styles.statLabel}>Attendance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{activeUpcoming.length}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{batches.length}</Text>
              <Text style={styles.statLabel}>Batches</Text>
            </View>
          </View>

          <Text style={styles.statNote}>
            Last {data?.pastDays || 90} days: {stats.present} attended · {stats.absent} absent · {stats.notMarked} not marked
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setEnrollOpen(true)}>
              <Feather name="layers" size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>Enroll in batch</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goCustom}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.secondaryText}>Appointment</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* tabs */}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------- UPCOMING ---------- */}
        {tab === "upcoming" &&
          (upcoming.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="calendar" size={34} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No upcoming sessions</Text>
              <Text style={styles.emptySub}>Enroll this child in a batch or create a custom appointment.</Text>
            </View>
          ) : (
            groupByDate(upcoming).map((g) => (
              <View key={g.date} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{prettyDay(g.date)}</Text>
                  {relLabel(g.date) && <Text style={styles.dayRel}>{relLabel(g.date)}</Text>}
                </View>
                {g.items.map((s) => (
                  <SessionRow key={s.id} s={s} onPress={setDetail} />
                ))}
              </View>
            ))
          ))}

        {/* ---------- PAST ---------- */}
        {tab === "past" &&
          (past.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clock" size={34} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No past sessions</Text>
              <Text style={styles.emptySub}>Showing the last {data?.pastDays || 90} days.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Showing the last {data?.pastDays || 90} days.</Text>
              {groupByDate(past.slice(0, pastLimit)).map((g) => (
                <View key={g.date} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{prettyDay(g.date)}</Text>
                  </View>
                  {g.items.map((s) => (
                    <SessionRow key={s.id} s={s} onPress={setDetail} />
                  ))}
                </View>
              ))}
              {past.length > pastLimit && (
                <TouchableOpacity style={styles.moreBtn} onPress={() => setPastLimit((n) => n + PAGE)}>
                  <Text style={styles.moreBtnText}>Show more ({past.length - pastLimit} left)</Text>
                </TouchableOpacity>
              )}
            </>
          ))}

        {/* ---------- BATCHES ---------- */}
        {tab === "batches" &&
          (batches.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="layers" size={34} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Not in any batch</Text>
              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 12 }]} onPress={() => setEnrollOpen(true)}>
                <Text style={styles.primaryText}>Enroll in batch</Text>
              </TouchableOpacity>
            </View>
          ) : (
            batches.map((b) => (
              <View key={b._id} style={styles.card}>
                <View style={styles.cardHeadRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{b.batchName}</Text>
                    <Text style={styles.sessionSub}>
                      {prettyFull(String(b.dateFrom).slice(0, 10))} to {prettyFull(String(b.dateTo).slice(0, 10))}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    disabled={removingId === String(b._id)}
                    onPress={() => removeFromBatch(b)}
                  >
                    {removingId === String(b._id) ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Feather name="user-minus" size={16} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.chipRow}>
                  {asList(b.speciality).map((id) => {
                    const m = specMeta(id);
                    return (
                      <View key={id} style={[styles.chip, { backgroundColor: m.bg }]}>
                        <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                      </View>
                    );
                  })}
                  <View style={[styles.chip, { backgroundColor: "#F1F5F9" }]}>
                    <Text style={[styles.chipText, { color: "#475569" }]}>
                      {b.childCount}/{b.maxChild} children
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ))}
      </ScrollView>

      <BottomBar activeTab="Children" onOpenNotifications={setIsNotificationOpen} />

      {/* session details */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {detail && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{prettyFull(detail.date)}</Text>
                    <Text style={styles.sheetSub}>
                      {timeRange(detail)} · {mins(detail.endTime) - mins(detail.startTime)} min
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Feather name="x" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.chipRow}>
                  {detail.type === "custom" ? (
                    <View style={[styles.chip, { backgroundColor: "#F3E8FF" }]}>
                      <Text style={[styles.chipText, { color: "#6B21A8" }]}>Custom appointment</Text>
                    </View>
                  ) : (
                    detail.speciality && (
                      <View style={[styles.chip, { backgroundColor: specMeta(detail.speciality).bg }]}>
                        <Text style={[styles.chipText, { color: specMeta(detail.speciality).color }]}>
                          {specMeta(detail.speciality).label}
                        </Text>
                      </View>
                    )
                  )}
                  <View style={[styles.chip, { backgroundColor: TYPE_META[detail.sessionType]?.bg || "#F1F5F9" }]}>
                    <Text style={[styles.chipText, { color: TYPE_META[detail.sessionType]?.color || "#475569" }]}>
                      {TYPE_META[detail.sessionType]?.label || "Regular"}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Therapist</Text>
                  <Text style={styles.detailValue}>{detail.therapistName}</Text>
                </View>
                {detail.type !== "custom" && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Batch</Text>
                    <Text style={styles.detailValue}>{detail.batchName}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Attendance</Text>
                  {detailAtt ? (
                    <View style={[styles.chip, { backgroundColor: detailAtt.bg }]}>
                      <Text style={[styles.chipText, { color: detailAtt.color }]}>{detailAtt.label}</Text>
                    </View>
                  ) : (
                    <Text style={styles.detailValue}>
                      {isInactive(detail) ? "-" : "Not started yet"}
                    </Text>
                  )}
                </View>

                {detail.canCancel && (
                  <TouchableOpacity
                    style={[styles.dangerBtn, cancelling && { opacity: 0.6 }]}
                    disabled={cancelling}
                    onPress={() => cancelAppointment(detail)}
                  >
                    {cancelling ? (
                      <ActivityIndicator color="#EF4444" />
                    ) : (
                      <Text style={styles.dangerText}>Cancel appointment</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* enroll in batch */}
      <Modal visible={enrollOpen} transparent animationType="slide" onRequestClose={() => setEnrollOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Enroll in batch</Text>
                <Text style={styles.sheetSub}>They join every upcoming session of the batch.</Text>
              </View>
              <TouchableOpacity onPress={() => setEnrollOpen(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {optLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {options.length === 0 && (
                  <Text style={styles.muted}>No open batches available. Batches that ended or are full are hidden.</Text>
                )}
                {options.map((b) => {
                  const on = pickedBatch === b._id;
                  return (
                    <TouchableOpacity
                      key={b._id}
                      style={[styles.pickRow, on && styles.pickRowOn]}
                      onPress={() => setPickedBatch(b._id)}
                    >
                      <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{b.batchName}</Text>
                        <Text style={styles.sessionSub}>
                          {prettyFull(String(b.dateFrom).slice(0, 10))} to {prettyFull(String(b.dateTo).slice(0, 10))}
                        </Text>
                        <View style={styles.chipRow}>
                          {asList(b.speciality).map((id) => {
                            const m = specMeta(id);
                            return (
                              <View key={id} style={[styles.chip, { backgroundColor: m.bg }]}>
                                <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                              </View>
                            );
                          })}
                          <View style={[styles.chip, { backgroundColor: "#F1F5F9" }]}>
                            <Text style={[styles.chipText, { color: "#475569" }]}>
                              {b.remaining} spot{b.remaining === 1 ? "" : "s"} left
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, styles.fullBtn, (!pickedBatch || enrolling) && { opacity: 0.5 }]}
              disabled={!pickedBatch || enrolling}
              onPress={enroll}
            >
              {enrolling ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>{pickedBatch ? "Enroll" : "Select a batch"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 160 },

  summary: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14 },
  title: { fontSize: 19, fontFamily: fonts.semiBold, color: "#0F172A" },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  chipText: { fontSize: 11, fontFamily: fonts.semiBold },

  statsRow: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: fonts.semiBold, color: "#0B4A6F" },
  statLabel: { fontSize: 11, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#F1F5F9" },
  statNote: { fontSize: 11, fontFamily: fonts.regular, color: "#94A3B8", textAlign: "center", marginTop: 10 },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#FFFFFF" },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.primary },
  fullBtn: { flex: 0, marginTop: 14, height: 48 },

  tabs: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, fontFamily: fonts.semiBold, color: "#64748B" },
  tabTextActive: { color: "#0B4A6F" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 12 },
  cardHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: "#0F172A" },
  muted: { fontSize: 13, fontFamily: fonts.regular, color: "#94A3B8", marginVertical: 12 },
  hint: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8", marginBottom: 10 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  dayGroup: { marginBottom: 14 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, paddingHorizontal: 2 },
  dayTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  dayRel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
    gap: 12,
  },
  sessionRowCancelled: { backgroundColor: "#FFF7F7" },
  sessionBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  sessionTime: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  struck: { textDecorationLine: "line-through", color: "#94A3B8" },
  sessionSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  sessionMeta: { fontSize: 11, fontFamily: fonts.regular, color: "#94A3B8", marginTop: 3 },

  moreBtn: { alignItems: "center", paddingVertical: 12 },
  moreBtnText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },

  empty: { alignItems: "center", paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: "#334155", marginTop: 6 },
  emptySub: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8", textAlign: "center", paddingHorizontal: 30 },

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  sheetTitle: { fontSize: 19, fontFamily: fonts.semiBold, color: "#0F172A" },
  sheetSub: { fontSize: 13, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  detailLabel: { fontSize: 13, fontFamily: fonts.regular, color: "#64748B" },
  detailValue: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", maxWidth: "65%", textAlign: "right" },
  dangerBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#EF4444" },

  pickRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  pickRowOn: { borderColor: "#0B4A6F" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioOn: { borderColor: "#0B4A6F" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B4A6F" },
});