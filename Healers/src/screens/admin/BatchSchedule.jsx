import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect } from "@react-navigation/native";

import {
  getBatchEligibleChildren,
  getBatchScheduleData,
  removeBatchAssignment,
  updateBatchChildren,
} from "../../api/admin/api";
import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";
import { therapistSpecialities } from "../../utils/specialities";

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
const TABS = [
  { id: "timetable", label: "Timetable" },
  { id: "sessions", label: "Sessions" },
  { id: "people", label: "People" },
];

const pad = (n) => String(n).padStart(2, "0");
const dateToKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const weekdayOf = (k) => DAYS[(keyToDate(k).getDay() + 6) % 7];
const prettyDay = (k) =>
  keyToDate(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const prettyFull = (k) =>
  keyToDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeRange = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
const specMeta = (id) =>
  therapistSpecialities.find((s) => s.id === id) || { label: id, bg: "#E0F2FE", color: "#0B4A6F" };

const groupByDate = (list) => {
  const out = [];
  list.forEach((s) => {
    const last = out[out.length - 1];
    if (last && last.date === s.date) last.items.push(s);
    else out.push({ date: s.date, items: [s] });
  });
  return out;
};

export default function BatchScheduleScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const batchId = route?.params?.batchId;

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState("timetable");
  const [showPast, setShowPast] = useState(false);
  const [therapistFilter, setTherapistFilter] = useState(null);

  const [childModal, setChildModal] = useState(false);
  const [options, setOptions] = useState([]);
  const [spotsLeft, setSpotsLeft] = useState(0);
  const [optLoading, setOptLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [removingChildId, setRemovingChildId] = useState(null);

  const today = dateToKey(new Date());

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const res = await getBatchScheduleData(batchId);
        if (res?.success) setData(res.data);
        else Alert.alert("Error", res?.message || "Could not load the batch schedule.");
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.message || "Could not load the batch schedule.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [batchId],
  );

  useFocusEffect(
    useCallback(() => {
      if (batchId) load();
    }, [batchId, load]),
  );

  // opened from "Add Children" on the batch card
  useEffect(() => {
    if (route?.params?.openAddChildren && data) {
      setTab("people");
      setPicked([]);
      setSearch("");
      setChildModal(true);
      navigation.setParams({ openAddChildren: false });
    }
  }, [route?.params?.openAddChildren, data, navigation]);

  // eligible children (debounced search)
  useEffect(() => {
    if (!childModal) return undefined;
    let alive = true;
    setOptions([]);
    setOptLoading(true);
    const t = setTimeout(async () => {
      try {
        // setOptions([]);
        const res = await getBatchEligibleChildren(batchId, search);
        if (alive) {
          const result = res?.data || {};
          setOptions(result.children || []);
          setSpotsLeft(result.remaining ?? 0);
        }
      } catch {
        if (alive) setOptions([]);
      } finally {
        if (alive) setOptLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [childModal, search, batchId]);

  const batch = data?.batch;
  const assignments = data?.assignments || [];
  const children = batch?.childrenIds || [];

  const sessions = useMemo(
    () =>
      assignments
        .flatMap((a) =>
          (a.sessions || [])
            .filter((s) => s.status !== "cancelled")
            .map((s) => ({
              ...s,
              assignmentId: a._id,
              therapistId: a.therapistId?._id,
              therapistName: a.therapistId?.fullName || "Therapist",
              speciality: a.speciality,
            })),
        )
        .sort((x, y) =>
          x.date === y.date ? x.startTime.localeCompare(y.startTime) : x.date.localeCompare(y.date),
        ),
    [assignments],
  );

  const upcomingAll = useMemo(() => sessions.filter((s) => s.date >= today), [sessions, today]);

  const timetable = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => (map[d] = []));
    upcomingAll.forEach((s) => {
      const d = weekdayOf(s.date);
      if (!map[d].some((x) => x.assignmentId === s.assignmentId && x.startTime === s.startTime)) {
        map[d].push(s);
      }
    });
    Object.values(map).forEach((l) => l.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [upcomingAll]);

  const filtered = therapistFilter
    ? sessions.filter((s) => s.therapistId === therapistFilter)
    : sessions;
  const upcoming = filtered.filter((s) => s.date >= today);
  const past = filtered.filter((s) => s.date < today).reverse();

  const relLabel = (key) => {
    if (key === today) return "Today";
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return key === dateToKey(t) ? "Tomorrow" : null;
  };

  const addChildren = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      const res = await updateBatchChildren(batchId, { addChildIds: picked });
      if (!res?.success) {
        Alert.alert("Could not add", res?.message || "Please try again.");
        return;
      }
      const skipped = res.data?.skippedSessions || 0;
      setChildModal(false);
      setPicked([]);
      await load();
      Alert.alert(
        "Children added",
        skipped
          ? `They were added to the upcoming sessions. ${skipped} session(s) were skipped because the child is already booked at that time.`
          : "They were added to every upcoming session.",
      );
    } catch (e) {
      console.log(e)
      Alert.alert("Could not add", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
      setOptions([]);
    }
  };

  const removeChild = (child) =>
    Alert.alert(
      "Remove child",
      `Remove ${child.fullName} from this batch? Their upcoming pending sessions will be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingChildId(String(child._id));
              const res = await updateBatchChildren(batchId, { removeChildIds: [child._id] });
              if (!res?.success) Alert.alert("Could not remove", res?.message || "Please try again.");
              Alert.alert(
                "Success",
                "Child removed successfully.",
                [
                  {
                    text: "OK",
                    onPress: () => load(),
                  },
                ]
              );
            } catch (e) {
              Alert.alert("Could not remove", e?.response?.data?.message || "Please try again.");
            } finally {
              setRemovingChildId(null);
            }
          },
        },
      ],
    );

  const removeTherapist = (a) =>
    Alert.alert(
      "Remove therapist",
      `Remove ${a.therapistId?.fullName || "this therapist"} (${specMeta(a.speciality).label}) and their upcoming sessions?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await removeBatchAssignment(batchId, a._id);
              Alert.alert(res?.success ? "Done" : "Could not remove", res?.message || "");
              await load();
            } catch (e) {
              Alert.alert("Could not remove", e?.response?.data?.message || "Please try again.");
            }
          },
        },
      ],
    );

  const SessionRow = ({ s }) => {
    const meta = specMeta(s.speciality);
    return (
      <View style={styles.sessionRow}>
        <View style={[styles.sessionBar, { backgroundColor: meta.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionTime}>{timeRange(s)}</Text>
          <Text style={styles.sessionSub}>{s.therapistName}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: meta.bg }]}>
          <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    );
  };

  const goCreate = () => navigation.navigate("BatchScheduleCreate", { batchId });

  if (loading) {
    return (
      <SafeAreaView style={styles.main}>
        <TopBar
          navigation={navigation}
          isNotificationOpen={isNotificationOpen}
          onToggleNotification={setIsNotificationOpen}
          headerTitle="Batch Schedule"
        />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <BottomBar activeTab="BatchManagment" onOpenNotifications={setIsNotificationOpen} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.main}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle="Batch Schedule"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />
        }
      >
        {/* summary */}
        <View style={styles.summary}>
          <Text style={styles.batchTitle}>{batch?.batchName}</Text>
          <Text style={styles.batchDates}>
            {batch?.dateFrom ? prettyFull(batch.dateFrom.slice(0, 10)) : "-"} to{" "}
            {batch?.dateTo ? prettyFull(batch.dateTo.slice(0, 10)) : "-"}
          </Text>
          <View style={styles.chipRow}>
            {(batch?.speciality || []).map((id) => {
              const m = specMeta(id);
              return (
                <View key={id} style={[styles.chip, { backgroundColor: m.bg }]}>
                  <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {children.length}/{batch?.maxChild}
              </Text>
              <Text style={styles.statLabel}>Children</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{assignments.length}</Text>
              <Text style={styles.statLabel}>Therapists</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{upcomingAll.length}</Text>
              <Text style={styles.statLabel}>Upcoming sessions</Text>
            </View>
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

        {/* ---------- TIMETABLE ---------- */}
        {tab === "timetable" &&
          (upcomingAll.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="calendar" size={34} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No schedule yet</Text>
              <Text style={styles.emptySub}>
                Pick a session length, choose therapists and their weekly times.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={goCreate}>
                <Text style={styles.primaryBtnText}>Create schedule</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly timetable</Text>
              {DAYS.map((d) => (
                <View key={d} style={styles.ttRow}>
                  <Text style={[styles.ttDay, !timetable[d].length && styles.muted]}>{d}</Text>
                  <View style={{ flex: 1 }}>
                    {timetable[d].length === 0 ? (
                      <Text style={styles.muted}>No sessions</Text>
                    ) : (
                      timetable[d].map((s) => {
                        const m = specMeta(s.speciality);
                        return (
                          <View key={`${s.assignmentId}-${s.startTime}`} style={styles.ttSlot}>
                            <View style={[styles.dot, { backgroundColor: m.color }]} />
                            <Text style={styles.ttTime}>{timeRange(s)}</Text>
                            <Text style={styles.ttWho} numberOfLines={1}>
                              {s.therapistName}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}

        {/* ---------- SESSIONS ---------- */}
        {tab === "sessions" && (
          <>
            {assignments.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !therapistFilter && styles.filterChipActive]}
                  onPress={() => setTherapistFilter(null)}
                >
                  <Text style={[styles.filterText, !therapistFilter && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                {assignments.map((a) => (
                  <TouchableOpacity
                    key={a._id}
                    style={[styles.filterChip, therapistFilter === a.therapistId?._id && styles.filterChipActive]}
                    onPress={() => setTherapistFilter(a.therapistId?._id)}
                  >
                    <Text
                      style={[styles.filterText, therapistFilter === a.therapistId?._id && styles.filterTextActive]}
                    >
                      {a.therapistId?.fullName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {upcoming.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="clock" size={34} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No upcoming sessions</Text>
              </View>
            ) : (
              groupByDate(upcoming).map((g) => (
                <View key={g.date} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{prettyDay(g.date)}</Text>
                    {relLabel(g.date) && <Text style={styles.dayRel}>{relLabel(g.date)}</Text>}
                  </View>
                  {g.items.map((s) => (
                    <SessionRow key={`${s.assignmentId}-${s._id}`} s={s} />
                  ))}
                </View>
              ))
            )}

            {past.length > 0 && (
              <>
                <TouchableOpacity style={styles.pastToggle} onPress={() => setShowPast((v) => !v)}>
                  <Text style={styles.pastToggleText}>
                    {showPast ? "Hide" : "Show"} past sessions ({past.length})
                  </Text>
                  <Feather name={showPast ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                </TouchableOpacity>
                {showPast &&
                  groupByDate(past).map((g) => (
                    <View key={g.date} style={[styles.dayGroup, { opacity: 0.6 }]}>
                      <View style={styles.dayHeader}>
                        <Text style={styles.dayTitle}>{prettyDay(g.date)}</Text>
                      </View>
                      {g.items.map((s) => (
                        <SessionRow key={`${s.assignmentId}-${s._id}`} s={s} />
                      ))}
                    </View>
                  ))}
              </>
            )}
          </>
        )}

        {/* ---------- PEOPLE ---------- */}
        {tab === "people" && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>Therapists</Text>
                <TouchableOpacity onPress={goCreate}>
                  <Text style={styles.linkText}>Add schedule</Text>
                </TouchableOpacity>
              </View>
              {assignments.length === 0 ? (
                <Text style={styles.muted}>No therapist assigned yet.</Text>
              ) : (
                assignments.map((a) => {
                  const m = specMeta(a.speciality);
                  const mine = upcomingAll.filter((s) => s.assignmentId === a._id);
                  const pattern = DAYS.filter((d) => mine.some((s) => weekdayOf(s.date) === d));
                  return (
                    <View key={a._id} style={styles.personRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.personName}>{a.therapistId?.fullName}</Text>
                        <Text style={styles.personSub}>
                          {mine.length
                            ? `${mine.length} upcoming · ${pattern.join(", ")}`
                            : "No upcoming sessions"}
                        </Text>
                      </View>
                      <View style={[styles.chip, { backgroundColor: m.bg, marginRight: 8 }]}>
                        <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                      </View>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => removeTherapist(a)}>
                        <Feather name="trash-2" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>
                  Children ({children.length}/{batch?.maxChild})
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPicked([]);
                    setOptions([]);
                    setSearch("");
                    setChildModal(true);
                  }}
                >
                  <Text style={styles.linkText}>Add children</Text>
                </TouchableOpacity>
              </View>
              {children.length === 0 ? (
                <Text style={styles.muted}>No children yet. New children join every upcoming session automatically.</Text>
              ) : (
                children.map((c) => (
                  <View key={c._id} style={styles.personRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(c.fullName || "?").slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.personName, { flex: 1 }]}>{c.fullName}</Text>
                    <TouchableOpacity style={styles.iconBtn} disabled={removingChildId === String(c._id)} onPress={() => removeChild(c)}>
                      {removingChildId === String(c._id) ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Feather name="x" size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {tab !== "people" && upcomingAll.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 90 }]}
          onPress={goCreate}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.fabText}>Add schedule</Text>
        </TouchableOpacity>
      )}

      <BottomBar activeTab="BatchManagment" onOpenNotifications={setIsNotificationOpen} />

      {/* add children */}
      <Modal visible={childModal} transparent animationType="slide" onRequestClose={() => setChildModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Add children</Text>
                <Text style={styles.sheetSub}>
                  {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left · they join all upcoming sessions
                </Text>
              </View>
              <TouchableOpacity onPress={() => setChildModal(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search child..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {optLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {!optLoading && options.length === 0 && <Text style={styles.muted}>No children found.</Text>}
              {options.map((c) => {
                const on = picked.includes(c._id);
                const full = !on && picked.length >= spotsLeft;
                return (
                  <TouchableOpacity
                    key={c._id}
                    style={[styles.pickRow, full && { opacity: 0.4 }]}
                    disabled={full}
                    onPress={() => setPicked((p) => (on ? p.filter((x) => x !== c._id) : [...p, c._id]))}
                  >
                    <View style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on && <Feather name="check" size={12} color="#FFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{c.fullName}</Text>
                      {!!c.fatherName && <Text style={styles.personSub}>Parent: {c.fatherName}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, (!picked.length || busy) && { opacity: 0.5 }]}
              disabled={!picked.length || busy}
              onPress={addChildren}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {picked.length ? `Add ${picked.length} child${picked.length === 1 ? "" : "ren"}` : "Select children"}
                </Text>
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
  batchTitle: { fontSize: 19, fontFamily: fonts.semiBold, color: "#0F172A" },
  batchDates: { fontSize: 13, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  chipText: { fontSize: 11, fontFamily: fonts.semiBold },

  statsRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: fonts.semiBold, color: "#0B4A6F" },
  statLabel: { fontSize: 11, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#F1F5F9" },

  tabs: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, fontFamily: fonts.semiBold, color: "#64748B" },
  tabTextActive: { color: "#0B4A6F" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14 },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: "#0F172A", marginBottom: 6 },
  linkText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },
  muted: { fontSize: 13, fontFamily: fonts.regular, color: "#94A3B8" },

  ttRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  ttDay: { width: 44, fontSize: 13, fontFamily: fonts.semiBold, color: "#0F172A" },
  ttSlot: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ttTime: { fontSize: 13, fontFamily: fonts.semiBold, color: "#0F172A" },
  ttWho: { flex: 1, fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },

  filterRow: { marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  filterText: { fontSize: 12, fontFamily: fonts.semiBold, color: "#475569" },
  filterTextActive: { color: "#FFFFFF" },

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
  sessionBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  sessionTime: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  sessionSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },

  pastToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  pastToggleText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 10,
  },
  personName: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  personSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontFamily: fonts.semiBold, color: "#0B4A6F" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: "#334155", marginTop: 6 },
  emptySub: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8", textAlign: "center", paddingHorizontal: 30 },

  primaryBtn: {
    marginTop: 14,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFFFFF" },

  fab: {
    position: "absolute",
    right: 20,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#FFFFFF" },

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontFamily: fonts.semiBold, color: "#0F172A" },
  sheetSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
});