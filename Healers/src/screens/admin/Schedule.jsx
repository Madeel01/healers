import React, {
  useCallback,
  useEffect,
  memo,
  useRef,
  useState,
} from 'react';

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
  getSessions,
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

const LIMIT = 15;

const SCOPES = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];
const RANGES = [
  { id: "all", label: "All" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];
const UPCOMING_RANGES = ["all", "this_week", "this_month"];
const PAST_RANGES = ["all", "this_week", "last_week", "this_month", "last_month"];

const TYPE_META = {
  additional: { label: "Additional", bg: "#EDE9FE", color: "#6D28D9" },
  alternate: { label: "Alternate", bg: "#DBEAFE", color: "#1D4ED8" },
  postponed: { label: "Postponed", bg: "#FEF3C7", color: "#B45309" },
  cancel: { label: "Cancelled", bg: "#FEE2E2", color: "#B91C1C" },
};
const ATT = {
  Complete: { label: "Attended", bg: "#DCFCE7", color: "#15803D" },
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

const isInactive = (s) => s.sessionType === "cancel" || s.sessionType === "postponed";

const attendanceSummary = (children = []) => {
  const present = children.filter((c) => c.attendance === "Complete").length;
  const absent = children.filter((c) => c.attendance === "Absent").length;
  return { present, absent, pending: children.length - present - absent };
};
const truncateText = (text, maxLength = 15) => {
  if (!text) return "";

  const value = String(text).trim();

  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...`
    : value;
};
// ---------- card (declared outside the screen so it never remounts) ----------
const SessionCard = memo(function SessionCard({
  s,
  onPress,
  specMeta,
}) {
  const isCustom = s.type === "custom";
  const spec = s.speciality ? specMeta(s.speciality) : null;
  const tm = TYPE_META[s.sessionType];
  const kids = s.children || [];
  const att = attendanceSummary(kids);
  const showAttendance = s.isPast && !isInactive(s);

  const title = isCustom ? kids[0]?.fullName || "Child appointment" : s.batchName;
  const meta = isCustom
    ? `Appointment with ${s.therapistName}`
    : `with ${s.therapistName} · ${kids.length} ${kids.length === 1 ? "child" : "children"}`;
  
  let attLine = null;
  let attChip = null;
  if (showAttendance) {
    if (isCustom) attChip = ATT[kids[0]?.attendance] || ATT.Pending;
    else attLine = `${att.present} attended · ${att.absent} absent${att.pending ? ` · ${att.pending} not marked` : ""}`;
  }

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={() => onPress(s)}>
      <View style={[styles.card, s.sessionType === "cancel" && styles.cardCancelled]}>
        <View
          style={[
            styles.bar,
            {
              backgroundColor: s.sessionType === "cancel" ? "#EF4444" : spec?.color || "#0B4A6F",
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.time, isInactive(s) && styles.struck]}>{timeRange(s)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          {!!attLine && <Text style={styles.attLine}>{attLine}</Text>}
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {spec && (
                <View style={[styles.chip, { backgroundColor: spec.bg }]}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.chipText, { color: spec.color }]}>
                    {truncateText(spec.label)}
                  </Text>
                </View>
              )
          }
          {tm && (
            <View style={[styles.chip, { backgroundColor: tm.bg }]}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.chipText, { color: tm.color }]}>
                {tm.label}
              </Text>
            </View>
          )}
          {attChip && (
            <View style={[styles.chip, { backgroundColor: attChip.bg }]}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.chipText, { color: attChip.color }]}>
                {attChip.label}
              </Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
})
function ActionRow({ icon, bg, color, title, sub, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.actionItem, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={fontSize(18)} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionItemTitle, { color: color === "#7E22CE" ? "#0F172A" : color }]}>{title}</Text>
        <Text style={styles.actionItemSub}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={fontSize(18)} color="#94A3B8" />
    </TouchableOpacity>
  );
}

export default function ScheduleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const rangeScrollRef = useRef(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [scope, setScope] = useState("upcoming");
  const [range, setRange] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [services, setServices] = useState([]);

  const [items, setItems] = useState([]);
  const [today, setToday] = useState(dateToKey(new Date()));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [detail, setDetail] = useState(null);
  const [acting, setActing] = useState(false);
  const [postponeTarget, setPostponeTarget] = useState(null);

  // child picker for "new custom appointment"
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const requestRef = useRef(0);
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
        services.find(
          (service) => service.id === id,
        ) || {
          label: id,
          bg: "#E0F2FE",
          color: "#0B4A6F",
        }
      );
    },
    [services],
  );

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (pageNum = 1, mode = "reset") => {
      const id = ++requestRef.current;
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "reset") setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await getSessions({ scope, range, search: query, page: pageNum, limit: LIMIT });
        if (id !== requestRef.current) return;

        if (!res?.success) {
          Alert.alert("Error", res?.message || "Could not load the schedule.");
          return;
        }

        if (res.today) setToday(res.today);
        setHasMore(!!res.hasMore);
        setPage(pageNum);
        setItems((prev) => {
          if (mode !== "more") return res.data || [];
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...(res.data || []).filter((x) => !seen.has(x.id))];
        });
      } catch (e) {
        if (id === requestRef.current) {
          Alert.alert("Error", e?.response?.data?.message || "Could not load the schedule.");
        }
      } finally {
        if (id === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [scope, range, query],
  );

  useFocusEffect(
    useCallback(() => {
      load(1, "reset");
    }, [load]),
  );

  const onEndReached = () => {
    if (hasMore && !loading && !loadingMore && !refreshing) load(page + 1, "more");
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
    });
  };

  const relLabel = (key) => {
    if (key === today) return "Today";
    const t = keyToDate(today);
    t.setDate(t.getDate() + 1);
    return key === dateToKey(t) ? "Tomorrow" : null;
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
            if (!res?.success) return Alert.alert("Could not complete", res?.message || "Please try again.");
            setDetail(null);
            await load(1, "reset");
            Alert.alert("Done", success);
          } catch (e) {
            Alert.alert("Could not complete", e?.response?.data?.message || "Please try again.");
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
  const changeScope = useCallback((id) => {
    setItems([]);
    setPage(1);
    setHasMore(false);
    setRange("all");
    setScope(id);
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => {
      const showHeader =
        index === 0 || items[index - 1]?.date !== item.date;

      const rel =
        scope === "upcoming" ? relLabel(item.date) : null;

      return (
        <View>
          {showHeader && (
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>
                {prettyDay(item.date)}
              </Text>

              {!!rel && (
                <Text style={styles.dayRel}>{rel}</Text>
              )}
            </View>
          )}

          <SessionCard
            s={item}
            onPress={setDetail}
            specMeta={specMeta}
          />
        </View>
      );
    },
    [items, scope, today, specMeta]
  );

  const detailKids = detail?.children || [];
  useEffect(() => {
    rangeScrollRef.current?.scrollTo({
      x: 0,
      animated: false,
    });
  }, [scope, range, items]);
  return (
    <View style={styles.main}>
      {/* search + filters */}
      <View style={styles.filters}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search child or therapist..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabs}>
          {SCOPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, scope === t.id && styles.tabActive]}
              onPress={() => changeScope(t.id)}
            >
              <Text style={[styles.tabText, scope === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          ref={rangeScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rangeScroll}
          contentContainerStyle={styles.typeRow}
        >
          {(scope === "upcoming" ? UPCOMING_RANGES : PAST_RANGES).map((rangeId) => {
            const r = RANGES.find((item) => item.id === rangeId);

            return (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.typeChip,
                  range === r.id && styles.typeChipActive,
                ]}
                onPress={() => setRange(r.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.typeText,
                    range === r.id && styles.typeTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading
        ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )
        : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(1, "refresh")}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name={query ? "search" : "calendar"} size={34} color="#94A3B8" />
                <Text style={styles.emptyTitle}>
                  {query ? "No matches found" : scope === "upcoming" ? "No upcoming sessions" : "No past sessions"}
                </Text>
                <Text style={styles.emptySub}>
                  {query
                    ? `Nothing matches "${query}".`
                    : scope === "upcoming"
                    ? "Tap + to create a custom appointment."
                    : "Showing the last 12 months."}
                </Text>
              </View>
            }
            ListFooterComponent={loadingMore
              ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />
              : null}
          />
        )}

      <TouchableOpacity
        style={[styles.fab]}
        activeOpacity={0.85}
        onPress={openPicker}
      >
        <Feather name="plus" size={fontSize(16)} color="#FFFFFF" />
        <Text style={styles.fabText}>New appointment</Text>
      </TouchableOpacity>

      {/* ---------- session details ---------- */}
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
                    <Feather name="x" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.chipRow}>
                  {detail.speciality && (
                        <View style={[styles.chip, { backgroundColor: specMeta(detail.speciality).bg }]}>
                          <Text style={[styles.chipText, { color: specMeta(detail.speciality).color }]}>
                            {specMeta(detail.speciality).label}
                          </Text>
                        </View>
                      )
                    }
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

                <Text style={styles.sheetSection}>Children ({detailKids.length})</Text>
                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {detailKids.length === 0 ? <Text style={styles.muted}>No children in this session.</Text> : (
                    detailKids.map((c, index) => {
                      const a = ATT[c.attendance] || ATT.Pending;
                      const showChip = detail.isPast || c.attendance !== "Pending";
                      return (
                        <View key={`${c.childId}-${index}`} style={styles.childRow}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{(c.fullName || "?").slice(0, 1).toUpperCase()}</Text>
                          </View>
                          <Text style={[styles.childName, { flex: 1 }]}>{c.fullName}</Text>
                          {showChip && (
                            <View style={[styles.chip, { backgroundColor: a.bg }]}>
                              <Text style={[styles.chipText, { color: a.color }]}>
                                {c.attendance === "Pending" ? "Not marked" : a.label}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {detail.type === "custom" && (
                  <View style={{ marginTop: 14 }}>
                    {(detail.canPostpone || detail.canCancel || !detail.isPast) ? (
                      <>
                        <Text style={styles.sheetSection}>Actions</Text>
                        {detail.canPostpone && (
                          <ActionRow
                            icon="calendar" bg="#F3E8FF" color="#7E22CE" disabled={acting}
                            title="Postpone" sub="Choose a new date and available time"
                            onPress={() => postponeAppointment(detail)}
                          />
                        )}
                        {detail.canCancel && (
                          <ActionRow
                            icon="x-circle" bg="#FEF3C7" color="#B45309" disabled={acting}
                            title="Cancel appointment" sub="Keep it in history as cancelled"
                            onPress={() => cancelAppointment(detail)}
                          />
                        )}
                        {!detail.isPast && (
                          <ActionRow
                            icon="trash-2" bg="#FEE2E2" color="#DC2626" disabled={acting}
                            title="Delete" sub="Remove this appointment completely"
                            onPress={() => deleteAppointment(detail)}
                          />
                        )}
                        {acting && <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />}
                      </>
                    ) : (
                      <View style={styles.pastInfo}>
                        <Feather name="lock" size={fontSize(18)} color="#64748B" />
                        <Text style={styles.pastInfoText}>This is a past appointment and can no longer be changed.</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------- pick a child for a custom appointment ---------- */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
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
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(c.fullName || c.name || "?").slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.childName, { flex: 1 }]}>{c.fullName || c.name}</Text>
                  <Feather name="chevron-right" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <PostponeCustomModal
        visible={!!postponeTarget}
        childId={postponeTarget?.children?.[0]?.childId}
        appointment={postponeTarget}
        onClose={() => setPostponeTarget(null)}
        onDone={() => {
          setPostponeTarget(null);
          load(1, "reset");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },

  filters: { paddingHorizontal: 16, paddingTop: 8 },
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

  tabs: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4, marginTop: 10 },
  tab: { flex: 1, paddingVertical: hp(9), borderRadius: wp(9), alignItems: "center" },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#64748B" },
  tabTextActive: { color: "#0B4A6F" },

  rangeScroll: {
    marginTop: 10,
    marginBottom: 4,
    flexGrow: 0,
  },

  typeRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 8,
    paddingRight: 4,
  },

  typeChip: {
    paddingHorizontal: wp(14),
    paddingVertical: hp(7),
    borderRadius: wp(16),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexShrink: 0,
  },
  typeChipActive: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  typeText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: "#475569" },
  typeTextActive: { color: "#FFFFFF" },

  listContent: { padding: 16, paddingBottom: 170, flexGrow: 1 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  dayTitle: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  dayRel: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: colors.primary },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
    gap: 12,
  },
  cardCancelled: { backgroundColor: "#FFF7F7" },
  bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  time: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  struck: { textDecorationLine: "line-through", color: "#94A3B8" },
  title: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#334155", marginTop: 2 },
  meta: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  attLine: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#94A3B8", marginTop: 3 },

  chip: {
    borderRadius: wp(20),
    paddingHorizontal: wp(10),
    paddingVertical: hp(4),
    alignSelf: "flex-start",
    // maxWidth: wp(100),
  },
  chipText: { fontSize: fontSize(10), fontFamily: fonts.semiBold,lineHeight:16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 6 },
  emptyTitle: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#334155", marginTop: 6 },
  emptySub: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 30,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 10,
    height: hp(45),
    paddingHorizontal: wp(16),
    borderRadius: wp(25),
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

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start" },
  sheetTitle: { fontSize: fontSize(18), fontFamily: fonts.semiBold, color: "#0F172A" },
  sheetSub: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  sheetSection: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginTop: 16,
    marginBottom: 4,
  },
  muted: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#94A3B8", marginVertical: 12 },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 4,
  },
  detailLabel: { fontSize: fontSize(13), fontFamily: fonts.regular, color: "#64748B" },
  detailValue: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    maxWidth: "65%",
    textAlign: "right",
  },

  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  childName: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0B4A6F" },
  actionItem: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionItemTitle: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  actionItemSub: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  pastInfo: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12 },
  pastInfoText: { flex: 1, fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B" },
});
