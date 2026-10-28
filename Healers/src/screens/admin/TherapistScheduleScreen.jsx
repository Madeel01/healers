// src/screens/admin/TherapistScheduleScreen.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import {
  cancelChildCustomAppointment,
  deleteChildCustomAppointment,
  getServices,
  getTherapistSchedule,
  getUsersByRole,
} from '../../api/admin/api';
import {
  colors,
  fonts,
} from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';
import PostponeCustomModal from './components/ChildCustomPostpond';

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
const PAGE = 20;
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
const TABS = [
  { id: "availability", label: "Availability" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

const TYPE_META = {
  additional: { label: "Additional", bg: "#EDE9FE", color: "#6D28D9" },
  alternate: { label: "Alternate", bg: "#DBEAFE", color: "#1D4ED8" },
  postponed: { label: "Postponed", bg: "#FEF3C7", color: "#B45309" },
  cancel: { label: "Cancelled", bg: "#FEE2E2", color: "#B91C1C" },
};
const ATTENDANCE_META = {
  Complete: { label: "Present", bg: "#DCFCE7", color: "#15803D" },
  Absent: { label: "Absent", bg: "#FEE2E2", color: "#B91C1C" },
  Pending: { label: "Pending", bg: "#F1F5F9", color: "#64748B" },
};

const pad = (n) => String(n).padStart(2, "0");
const dateToKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const prettyDay = (k) => keyToDate(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const prettyFull = (k) => keyToDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const timeRange = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);

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

const attendanceSummary = (children = []) => {
  const present = children.filter((c) => c.attendance === "Complete").length;
  const absent = children.filter((c) => c.attendance === "Absent").length;
  const pending = children.length - present - absent;
  return { present, absent, pending };
};
const Avatar = ({ uri, name, color, style, textStyle }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[style, { backgroundColor: color }]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[style, { backgroundColor: color }]}>
      <Text style={textStyle}>
        {name?.trim()?.charAt(0)?.toUpperCase() || "?"}
      </Text>
    </View>
  );
};
function SessionRow({ s, past, onPress, specMeta }) {
  const spec = s.speciality
    ? specMeta(s.speciality)
    : null;
  const tm = TYPE_META[s.sessionType];
  const att = attendanceSummary(s.children);
  const isCustom = s.type === "custom";
  const sub = isCustom ? s.children[0]?.fullName : past
    ? s.children.length === 0
      ? "No children"
      : `${att.present} present · ${att.absent} absent${att.pending ? ` · ${att.pending} pending` : ""}`
    : `${s.children.length} ${s.children.length === 1 ? "child" : "children"}`;

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={() => onPress(s)}>
      <View style={[styles.sessionRow, s.sessionType === "cancel" && styles.sessionRowCancelled]}>
        <View
          style={[
            styles.sessionBar,
            {
              backgroundColor: s.sessionType === "cancel"
                ? "#EF4444"
                : spec?.color || "#0B4A6F",
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sessionTime, isInactive(s) && styles.struck]}>{timeRange(s)}</Text>
          <Text style={styles.sessionSub} numberOfLines={1}>
            {s.batchName || (s.type === "custom" ? "Appointment with" : "Individual session")}
          </Text>
          <Text style={styles.sessionMeta}>{sub}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {/* {s.type === "custom"
            ? (
              <View style={[styles.chip, { backgroundColor: "#F3E8FF" }]}>
                <Text style={[styles.chipText, { color: "#6B21A8" }]}>Custom</Text>
              </View>
            )
            : (
              spec && (
                <View style={[styles.chip, { backgroundColor: spec.bg }]}>
                  <Text style={[styles.chipText, { color: spec.color }]}>{spec.label}</Text>
                </View>
              )
            )} */}
          {tm && (
            <View style={[styles.chip, { backgroundColor: tm.bg }]}>
              <Text style={[styles.chipText, { color: tm.color }]}>{tm.label}</Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={fontSize(18)} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}
function ActionRow({ icon, bg, color, title, sub, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.actionItem, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={fontSize(18)} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.actionItemTitle,
            { color: color === "#7E22CE" ? "#0F172A" : color },
          ]}
        >
          {title}
        </Text>
        <Text style={styles.actionItemSub}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={fontSize(18)} color="#94A3B8" />
    </TouchableOpacity>
  );
}
export default function TherapistScheduleScreen({ navigation, route }) {
  const { therapistId, therapistName, isActive } = route.params || {};
  const insets = useSafeAreaInsets();

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState("upcoming");
  const [pastLimit, setPastLimit] = useState(PAGE);
  const [detail, setDetail] = useState(null);
  const [services, setServices] = useState([]);
  const [acting, setActing] = useState(false);
  const [postponeTarget, setPostponeTarget] = useState(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const EMPTY_LIST = { items: [], page: 0, hasMore: true, loading: false, loaded: false };
  const [upcomingState, setUpcomingState] = useState(EMPTY_LIST);
  const [pastState, setPastState] = useState(EMPTY_LIST);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const res = await getTherapistSchedule(therapistId, { page: 1, limit: PAGE });
        if (res?.success) {
          const { upcoming, ...meta } = res.data;
          setData(meta);
          setUpcomingState({
            items: upcoming.items,
            page: 1,
            hasMore: upcoming.hasMore,
            loading: false,
            loaded: true,
          });
          setPastState(EMPTY_LIST); // past reloads when its tab opens
        } else Alert.alert("Error", res?.message || "Could not load the schedule.");
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.message || "Could not load the schedule.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [therapistId],
  );
  const loadMore = useCallback(
    async (section) => {
      const state = section === "upcoming" ? upcomingState : pastState;
      const setState = section === "upcoming" ? setUpcomingState : setPastState;
      if (state.loading || !state.hasMore) return;

      setState((p) => ({ ...p, loading: true }));
      try {
        const next = state.page + 1;
        const res = await getTherapistSchedule(therapistId, { section, page: next, limit: PAGE });
        if (res?.success) {
          setState((p) => ({
            items: [...p.items, ...res.data.items],
            page: next,
            hasMore: res.data.hasMore,
            loading: false,
            loaded: true,
          }));
        } else {
          setState((p) => ({ ...p, loading: false }));
        }
      } catch (e) {
        setState((p) => ({ ...p, loading: false }));
      }
    },
    [therapistId, upcomingState, pastState],
  );

  useEffect(() => {
    if (tab === "past" && !pastState.loaded && !pastState.loading) loadMore("past");
  }, [tab, pastState.loaded, pastState.loading, loadMore]);

  const onScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
    if (nearBottom && (tab === "upcoming" || tab === "past")) loadMore(tab);
  };

  useFocusEffect(
    useCallback(() => {
      if (therapistId) load();
    }, [therapistId, load]),
  );
  useEffect(() => {
    const servicesData = async () => {
      try {
        const res = await getServices({ search: "" });

        const activeServices = res.data.filter(
          (service) => service.isActive === true,
        );

        setServices(activeServices);
      } catch (error) {
        console.log(error);
      }
    };

    servicesData();
  }, []);
  const specMeta = useCallback(
    (id) => {
      return (
        services.find((service) => service.id === id) || {
          label: id,
          bg: "#E0F2FE",
          color: "#0B4A6F",
        }
      );
    },
    [services],
  );

  const today = data?.today || dateToKey(new Date());
  const upcoming = upcomingState.items;
  const past = pastState.items;
  const therapistActive = data?.therapist?.isActive ?? isActive ?? true;
  const availability = data?.availability || [];
  const specialties = data?.therapist?.specialties || [];

  const relLabel = (key) => {
    if (key === today) return "Today";
    const t = keyToDate(today);
    t.setDate(t.getDate() + 1);
    return key === dateToKey(t) ? "Tomorrow" : null;
  };

  // weekly pattern from recurring rules that are still in effect
  const weekly = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => (map[d] = []));
    availability
      .filter((r) => r.type === "recurring" && (!r.effectiveTo || r.effectiveTo >= today))
      .forEach((r) =>
        (r.slots || []).forEach((s) =>
          map[s.day].push({
            startTime: s.startTime,
            endTime: s.endTime,
            from: r.effectiveFrom && r.effectiveFrom > today ? r.effectiveFrom : null,
            to: r.effectiveTo || null,
          })
        )
      );
    Object.values(map).forEach((l) => l.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [availability, today]);

  const specificDates = useMemo(
    () =>
      availability
        .filter((r) => r.type === "custom" && r.date >= today)
        .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))),
    [availability, today],
  );

  const weeklyHours = useMemo(() => {
    let total = 0;
    DAYS.forEach((d) => {
      // only count slots already in effect, so future-dated rules don't inflate it
      weekly[d].filter((s) => !s.from).forEach((s) => (total += mins(s.endTime) - mins(s.startTime)));
    });
    const h = total / 60;
    return Number.isInteger(h) ? String(h) : h.toFixed(1);
  }, [weekly]);

  const activeUpcoming = upcoming.filter((s) => !isInactive(s));
  const batchCount = new Set(activeUpcoming.map((s) => s.batchId).filter(Boolean)).size;

  const goManage = () => {
    if (!therapistActive) return;
    navigation.navigate("TherapistAvailability", { therapistId, therapistName });
  };
  const confirmAction = ({ title, message, confirmText, call, success }) =>
    Alert.alert(title, message, [
      { text: "Keep", style: "cancel" },
      {
        text: confirmText,
        style: "destructive",
        onPress: async () => {
          try {
            setActing(true);
            const res = await call();
            if (!res?.success)
              return Alert.alert(
                "Could not complete",
                res?.message || "Please try again.",
              );
            setDetail(null);
            await load(1);
            Alert.alert("Done", success);
          } catch (e) {
            Alert.alert(
              "Could not complete",
              e?.response?.data?.message || "Please try again.",
            );
          } finally {
            setActing(false);
          }
        },
      },
    ]);

  const cancelAppointment = (s) => {
    const childId = s.children?.[0]?.childId;
    if (!childId) return;
    confirmAction({
      title: "Cancel appointment",
      message: `Cancel the appointment on ${prettyFull(s.date)}? It stays in the list as cancelled.`,
      confirmText: "Cancel appointment",
      call: () => cancelChildCustomAppointment(childId, s.id),
      success: "Appointment cancelled.",
    });
  };

  const deleteAppointment = (s) => {
    const childId = s.children?.[0]?.childId;
    if (!childId) return;
    confirmAction({
      title: "Delete appointment",
      message: `Permanently delete the appointment on ${prettyFull(s.date)}?`,
      confirmText: "Delete",
      call: () => deleteChildCustomAppointment(childId, s.id),
      success: "Appointment deleted.",
    });
  };

  const postponeAppointment = (s) => {
    setDetail(null);
    setTimeout(() => setPostponeTarget(s), Platform.OS === "ios" ? 400 : 0);
  };

  useEffect(() => {
    if (!pickerOpen) return undefined;
    let alive = true;
    setPickerLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await getUsersByRole({ role: "Child", search: pickerSearch.trim() });
        if (alive) setPickerItems(res?.data || []);
      } catch (e) {
        if (alive) setPickerItems([]);
      } finally {
        if (alive) setPickerLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pickerOpen, pickerSearch]);

  const openPicker = () => {
    setPickerSearch("");
    setPickerItems([]);
    setPickerOpen(true);
  };

  const pickChild = (c) => {
    setPickerOpen(false);
    navigation.navigate("ChildCustomAppointment", {
      childId: c._id || c.id,
      childName: c.fullName || c.name,
      therapistIdByScreen:therapistId
    });
  };

  if (loading) {
    return (
      <View style={styles.main}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.main}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* summary */}
        <View style={styles.summary}>
          <Text style={styles.title}>{data?.therapist?.fullName || therapistName || "Therapist"}</Text>
          {!therapistActive && (
            <View style={styles.inactiveBadge}>
              <View style={styles.inactiveDot} />
              <Text style={styles.inactiveBadgeText}>Inactive</Text>
            </View>
          )}
          {!!data?.therapist?.email && <Text style={styles.subtitle}>{data.therapist.email}</Text>}
          {specialties.length > 0 && (
            <View style={styles.chipRow}>
              {specialties.map((id) => {
                const m = specMeta(id);
                return (
                  <View key={id} style={[styles.chip, { backgroundColor: m.bg }]}>
                    <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data?.upcomingTotal ?? 0}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data?.pastTotal ?? 0}</Text>
              <Text style={styles.statLabel}>Past ({data?.pastDays || 90}d)</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{therapistActive ? `${weeklyHours}h` : "—"}</Text>
              <Text style={styles.statLabel}>Weekly hours</Text>
            </View>
            {/* <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{batchCount}</Text>
              <Text style={styles.statLabel}>Batches</Text>
            </View> */}
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

        {/* ---------- AVAILABILITY ---------- */}
        {tab === "availability"
          && (!therapistActive
            ? (
              <View style={styles.inactiveNotice}>
                <Feather name="user-x" size={fontSize(28)} color="#B91C1C" />
                <Text style={styles.inactiveNoticeTitle}>Therapist is inactive</Text>
                <Text style={styles.inactiveNoticeSub}>
                  Availability can't be viewed or managed while this therapist is inactive. Reactivate them from the
                  Therapists screen to set it again.
                </Text>
              </View>
            )
            : (
              <>
                <View style={styles.card}>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.cardTitle}>Weekly availability</Text>
                    <TouchableOpacity onPress={goManage}>
                      <Text style={styles.linkText}>Manage</Text>
                    </TouchableOpacity>
                  </View>

                  {DAYS.every((d) => weekly[d].length === 0)
                    ? <Text style={styles.muted}>No weekly availability set.</Text>
                    : (
                      DAYS.map((d) => (
                        <View key={d} style={styles.ttRow}>
                          <Text style={[styles.ttDay, !weekly[d].length && styles.muted]}>{d}</Text>
                          <View style={{ flex: 1 }}>
                            {weekly[d].length === 0 ? <Text style={styles.muted}>Not available</Text> : (
                              weekly[d].map((s, i) => (
                                <View key={`${d}-${i}`} style={styles.ttSlot}>
                                  <View style={[styles.dot, { backgroundColor: s.from ? "#F59E0B" : "#0B4A6F" }]} />
                                  <Text style={styles.ttTime}>{timeRange(s)}</Text>
                                  {(s.from || s.to) && (
                                    <Text style={styles.ttNote} numberOfLines={1}>
                                      {s.from ? `from ${prettyFull(s.from)}` : ""}
                                      {s.from && s.to ? " " : ""}
                                      {s.to ? `until ${prettyFull(s.to)}` : ""}
                                    </Text>
                                  )}
                                </View>
                              ))
                            )}
                          </View>
                        </View>
                      ))
                    )}
                </View>

                {specificDates.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Specific dates</Text>
                    {specificDates.map((r) => (
                      <View key={r._id} style={styles.dateRow}>
                        <Text style={styles.dateRowDay}>{prettyDay(r.date)}</Text>
                        <Text style={styles.ttTime}>{timeRange(r)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ))}

        {/* ---------- UPCOMING ---------- */}
        {tab === "upcoming"
          && (upcoming.length === 0
            ? (
              <View style={styles.empty}>
                <Feather name="calendar" size={fontSize(34)} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No upcoming sessions</Text>
                <Text style={styles.emptySub}>
                  Sessions appear here once this therapist have appointments with child.
                </Text>
              </View>
            )
            : (
              groupByDate(upcoming).map((g) => (
                <View key={g.date} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{prettyDay(g.date)}</Text>
                    {relLabel(g.date) && <Text style={styles.dayRel}>{relLabel(g.date)}</Text>}
                  </View>
                  {g.items.map((s) => (
                    <SessionRow key={s.id} s={s} past={false} onPress={setDetail} specMeta={specMeta} />
                  ))}
                </View>
              ))
            ))}
            {tab === "upcoming" && upcomingState.loading && (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            )}

        {/* ---------- PAST ---------- */}
        {tab === "past" && (
          !pastState.loaded ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
          ) : past.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clock" size={fontSize(34)} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No past sessions</Text>
              <Text style={styles.emptySub}>Showing the last {data?.pastDays || 90} days.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Showing the last {data?.pastDays || 90} days.</Text>
              {groupByDate(past).map((g) => (
                <View key={g.date} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{prettyDay(g.date)}</Text>
                  </View>
                  {g.items.map((s) => <SessionRow key={s.id} s={s} past onPress={setDetail} specMeta={specMeta} />)}
                </View>
              ))}
              {pastState.loading && (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
              )}
            </>
          )
        )}
      </ScrollView>

      {/* session details */}

      <Modal
        style={{ paddingBottom: insets.bottom }}
        visible={!!detail}
        transparent
        animationType="slide"
        onRequestClose={() => setDetail(null)}
      >
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
                    <Feather name="x" size={fontSize(22)} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.chipRow}>
                  {/* {detail.type === "custom"
                    ? (
                      <View style={[styles.chip, { backgroundColor: "#F3E8FF" }]}>
                        <Text style={[styles.chipText, { color: "#6B21A8" }]}>Custom Appointment</Text>
                      </View>
                    )
                    : (
                      detail.speciality && (
                        <View style={[styles.chip, { backgroundColor: specMeta(detail.speciality).bg }]}>
                          <Text style={[styles.chipText, { color: specMeta(detail.speciality).color }]}>
                            {specMeta(detail.speciality).label}
                          </Text>
                        </View>
                      )
                    )} */}
                  <View style={[styles.chip, { backgroundColor: TYPE_META[detail.sessionType]?.bg || "#F1F5F9" }]}>
                    <Text style={[styles.chipText, { color: TYPE_META[detail.sessionType]?.color || "#475569" }]}>
                      {TYPE_META[detail.sessionType]?.label || "Regular"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sheetBatch}>
                  {detail.type === "custom" ? "Type: Individual " : `Batch: ${detail.batchName || "N/A"}`}
                </Text>
                {(detail.children.length === 0 || detail.children.length > 1) && (
                  <Text style={styles.sheetSection}>Children ({detail.children.length})</Text>
                )}
                <View>
                  {detail.children.length === 0 ? (
                    <Text style={styles.muted}>No children in this session.</Text>
                  ) : detail.children.length === 1 ? (
                    <View style={styles.childRow}>
                      <Text style={styles.childLabel}>Child Name</Text>
                      <Text style={styles.childName}>
                        {detail.children[0].fullName}
                      </Text>
                    </View>
                  ) : (
                    detail.children.map((c, index) => {
                      const a = ATTENDANCE_META[c.attendance] || ATTENDANCE_META.Pending;

                      return (
                        <View key={`${c.childId}-${index}`} style={styles.childRow}>
                          <Avatar
                            uri={c.profileImage}
                            name={c.fullName || c.name}
                            color={getAvatarColor(c.fullName || c.name)}
                            style={styles.avatar}
                            textStyle={styles.avatarText}
                          />

                          <Text style={[styles.childName, { flex: 1 }]}>
                            {c.fullName}
                          </Text>

                          {(detail.isPast || c.attendance !== "Pending") && (
                            <View style={[styles.chip, { backgroundColor: a.bg }]}>
                              <Text style={[styles.chipText, { color: a.color }]}>
                                {a.label}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
                {detail.type === "custom" && (
                  <View>
                    {detail.canPostpone ||
                      detail.canCancel ||
                      !detail.isPast ? (
                      <>
                        <Text style={styles.sheetSection}>Actions</Text>
                        {acting && (
                          <ActivityIndicator
                            color={colors.primary}
                            style={{ marginTop: 10 }}
                          />
                        )}
                        {detail.canPostpone && (
                          <ActionRow
                            icon="calendar"
                            bg="#F3E8FF"
                            color="#7E22CE"
                            disabled={acting}
                            title="Postpone"
                            sub="Choose a new date and available time"
                            onPress={() => postponeAppointment(detail)}
                          />
                        )}
                        {detail.canCancel && (
                          <ActionRow
                            icon="x-circle"
                            bg="#FEF3C7"
                            color="#B45309"
                            disabled={acting}
                            title="Cancel appointment"
                            sub="Keep it in history as cancelled"
                            onPress={() => cancelAppointment(detail)}
                          />
                        )}
                        {!detail.isPast && (
                          <ActionRow
                            icon="trash-2"
                            bg="#FEE2E2"
                            color="#DC2626"
                            disabled={acting}
                            title="Delete"
                            sub="Remove this appointment completely"
                            onPress={() => deleteAppointment(detail)}
                          />
                        )}
                      </>
                    ) : (
                      <View style={styles.pastInfo}>
                        <Feather
                          name="lock"
                          size={fontSize(18)}
                          color="#64748B"
                        />
                        <Text style={styles.pastInfoText}>
                          This is a past appointment and can no longer be
                          changed.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>New appointment</Text>
                  <Text style={styles.sheetSub}>Select the child first</Text>
                </View>
                <TouchableOpacity onPress={() => setPickerOpen(false)}>
                  <Feather name="x" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBox, { marginTop: 8 }]}>
                <Feather name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search child..."
                  placeholderTextColor="#94A3B8"
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>

              {pickerLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />}

              <ScrollView style={{ maxHeight: 340, marginTop: 6 }} keyboardShouldPersistTaps="handled">
                {!pickerLoading && pickerItems.length === 0 && <Text style={styles.muted}>No children found.</Text>}
                {pickerItems.map((c) => (
                  <TouchableOpacity
                    key={c._id || c.id}
                    style={styles.pickRow}
                    onPress={() => pickChild(c)}
                  >
                    <Avatar
                      uri={c.profileImage}
                      name={c.fullName || c.name}
                      color={getAvatarColor(c.fullName || c.name)}
                      style={styles.avatar}
                      textStyle={styles.avatarText}
                    />
                    <Text style={[styles.childName, { flex: 1 }]}>{c.fullName || c.name}</Text>
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <TouchableOpacity
        style={[styles.fab]}
        activeOpacity={0.85}
        onPress={openPicker}
      >
        <Feather name="plus" size={fontSize(27)} color="#FFFFFF" />
        <Text style={styles.fabText}></Text>
      </TouchableOpacity>
      <PostponeCustomModal
        visible={!!postponeTarget}
        childId={postponeTarget?.children?.[0]?.childId}
        appointment={postponeTarget}
        onClose={() => setPostponeTarget(null)}
        onDone={() => {
          setPostponeTarget(null);
          load(1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: wp(16), paddingBottom: hp(24) },

  summary: { backgroundColor: "#FFFFFF", borderRadius: wp(18), padding: wp(16), marginBottom: wp(14) },
  title: { fontSize: fontSize(20), fontFamily: fonts.semiBold, color: "#0F172A" },
  subtitle: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#64748B" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: hp(10) },
  chip: { borderRadius: wp(20), paddingHorizontal: wp(10), paddingVertical: hp(4), alignSelf: "flex-start" },
  chipText: { fontSize: fontSize(10), fontFamily: fonts.semiBold, lineHeight: 16 },

  statsRow: { flexDirection: "row", marginTop: hp(14), paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: fontSize(18), fontFamily: fonts.semiBold, color: "#0B4A6F" },
  statLabel: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#64748B" },
  statDivider: { width: 1, backgroundColor: "#F1F5F9" },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: wp(12),
    padding: wp(4),
    marginBottom: wp(14),
  },
  tab: { flex: 1, paddingVertical: hp(9), borderRadius: wp(9), alignItems: "center" },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: "#64748B", lineHeight: 18 },
  tabTextActive: { color: "#0B4A6F" },

  card: { backgroundColor: "#FFFFFF", borderRadius: wp(18), padding: wp(16), marginBottom: wp(14) },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: wp(6) },
  cardTitle: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#0F172A", marginBottom: wp(6) },
  linkText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: colors.primary },
  muted: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#94A3B8" },
  hint: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8", marginBottom: wp(10) },

  ttRow: { flexDirection: "row", paddingVertical: hp(10), borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  ttDay: { width: 44, fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0F172A" },
  ttSlot: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: hp(3), flexWrap: "wrap" },
  dot: { width: 8, height: 8, borderRadius: wp(4) },
  ttTime: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0F172A" },
  ttNote: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#B45309" },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: hp(10),
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dateRowDay: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#475569" },

  dayGroup: { marginBottom: wp(14) },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: wp(6), paddingHorizontal: wp(2) },
  dayTitle: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  dayRel: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: colors.primary },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(14),
    padding: wp(12),
    marginBottom: wp(6),
    gap: 12,
  },
  sessionRowCancelled: { backgroundColor: "#FFF7F7" },
  sessionBar: { width: 4, alignSelf: "stretch", borderRadius: wp(2) },
  sessionTime: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  struck: { textDecorationLine: "line-through", color: "#94A3B8" },
  sessionSub: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", marginTop: hp(2) },
  sessionMeta: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#94A3B8", marginTop: hp(3) },

  moreBtn: { alignItems: "center", paddingVertical: hp(12) },
  moreBtnText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: colors.primary },

  empty: { alignItems: "center", paddingVertical: hp(40), gap: 6 },
  emptyTitle: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#334155", marginTop: hp(6) },
  emptySub: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: wp(30),
  },

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: wp(20),
    paddingBottom: 28,
    maxHeight: "88%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: wp(6) },
  sheetTitle: { fontSize: fontSize(19), fontFamily: fonts.semiBold, color: "#0F172A" },
  sheetSub: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#64748B", marginTop: hp(2) },
  sheetBatch: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#475569", marginTop: hp(10) },
  sheetSection: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginTop: hp(5),
    marginBottom: wp(4),
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: hp(10),
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  childName: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: wp(16),
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#f3f5f7" },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: wp(8),
    paddingVertical: hp(3),
    borderRadius: wp(12),
    marginTop: hp(6),
  },
  inactiveDot: { width: 6, height: 6, borderRadius: wp(3), backgroundColor: "#DC2626", marginRight: 5 },
  inactiveBadgeText: { color: "#B91C1C", fontSize: fontSize(11), fontFamily: fonts.semiBold },

  inactiveNotice: {
    alignItems: "center",
    backgroundColor: "#FFF7F7",
    borderRadius: wp(18),
    padding: wp(24),
    gap: 6,
    marginBottom: wp(14),
  },
  inactiveNoticeTitle: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#B91C1C", marginTop: hp(4) },
  inactiveNoticeSub: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionItemTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  actionItemSub: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 2,
  },
  pastInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
  },
  pastInfoText: {
    flex: 1,
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  childLabel: {
    flex: 1,
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: hp(46),
  },
  searchInput: { flex: 1, fontSize: fontSize(14), color: "#0F172A" },
  fab: {
    position: "absolute",
    right: 30,
    bottom: 20,
    height: hp(55),
    paddingHorizontal: wp(16),
    // paddingVertical: wp(30),
    borderRadius: wp(15),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#FFFFFF", lineHeight: 20 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
});
