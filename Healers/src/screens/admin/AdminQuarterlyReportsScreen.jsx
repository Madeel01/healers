import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { getAdminQuarterlyReports } from "../../api/admin/api";
import { colors, commonStyles, fonts } from "../../styles/theme";
import { fontSize, hp, wp } from "../../utils/responsive";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const PRIMARY_BLUE = "#035388";
const GOALS_LIMIT = 3;

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

const nameOf = (u) => u?.fullName || u?.name || "Unknown";
const STATUS_COLORS = {
  pending: {
    bg: "#F1F5F9",
    fill: "#CBD5E1",
    text: "#475569",
    border: "#CBD5E1",
  },
  in_progress: {
    bg: "#E0F2FE",
    fill: "#93C5FD",
    text: "#0B598F",
    border: "#93C5FD",
  },
  completed: {
    bg: "#DCFCE7",
    fill: "#86EFAC",
    text: "#166534",
    border: "#86EFAC",
  },
};

const avgOf = (goals = []) => {
  const vals = goals
    .map((g) => g.progress)
    .filter((v) => typeof v === "number");
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const overallAvg = (programs = []) =>
  avgOf(programs.flatMap((p) => p.goals || []));
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
    <View
      style={[
        style,
        {
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Text style={textStyle}>
        {name?.trim()?.charAt(0)?.toUpperCase() || "?"}
      </Text>
    </View>
  );
};
const getStatusKey = (g) => {
  if (typeof g.progress === "number") {
    if (g.progress >= 100) return "completed";
    if (g.progress > 0) return "in_progress";
    return "pending";
  }
  const s = String(g.status || "").toLowerCase().replace(/[\s-]/g, "_");
  return STATUS_COLORS[s] ? s : "pending";
};
const GoalsText = ({ goals }) => {
  const [expanded, setExpanded] = useState(false);
  const list = (goals || []).filter((g) => g.goalName);
  if (!list.length) return null;

  const hidden = list.length - GOALS_LIMIT;
  const shown = expanded ? list : list.slice(0, GOALS_LIMIT);

  return (
    <View style={styles.goalWrap}>
      {shown.map((g, i) => {
        const hasProgress = typeof g.progress === "number";
        const pct = hasProgress ? Math.min(100, Math.max(0, g.progress)) : 0;
        const statusKey = getStatusKey(g);
        const c = STATUS_COLORS[statusKey];

        return (
            <View
            key={`${g.goalId || g.goalName}-${i}`}
            style={[
                styles.goalChip,
                { backgroundColor: c.bg, borderColor: c.border },
            ]}
            >
            {hasProgress && (
                <View
                style={[
                    styles.goalFill,
                    { width: `${pct}%`, backgroundColor: c.fill },
                ]}
                />
            )}
            <View style={styles.goalChipContent}>
                <Text style={[styles.goalChipText, { color: c.text }]}>
                {g.goalName}
                </Text>
                {hasProgress && (
                <Text style={[styles.goalPct, { color: c.text }]}>{pct}%</Text>
                )}
            </View>
            </View>
        );
        })}

      {hidden > 0 && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.seeMoreChip}
          onPress={() => setExpanded((e) => !e)}
        >
          <Text style={styles.seeMoreChipText}>
            {expanded ? "See less" : `See more (+${hidden})`}
          </Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={fontSize(12)}
            color="#004E9F"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function AdminQuarterlyReportsScreen() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(null); // null = all
  const [search, setSearch] = useState("");

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, children: 0, therapists: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState(null);
  const [openPrograms, setOpenPrograms] = useState({});

  const fetchReports = useCallback(
    async (pageToLoad = 1, mode = "load") => {
      try {
        if (mode === "more") setLoadingMore(true);
        else if (mode === "refresh") setRefreshing(true);
        else setLoading(true);

        const res = await getAdminQuarterlyReports({
          year,
          quarter: quarter || undefined,
          search: search.trim() || undefined,
          page: pageToLoad,
          limit: 15,
        });

        if (res?.success) {
          setItems((prev) =>
            pageToLoad === 1 ? res.data : [...prev, ...res.data],
          );
          setStats(res.stats || { total: 0, children: 0, therapists: 0 });
          setHasMore(!!res.pagination?.hasMore);
          setPage(pageToLoad);
        }
      } catch (e) {
        console.error("Admin quarterly reports error:", e?.response?.data || e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [year, quarter, search],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchReports(1), 350);
    return () => clearTimeout(t);
  }, [fetchReports]);

  const openDetail = (report) => {
    setSelected(report);
    setOpenPrograms({ [report.programs?.[0]?.programId]: true });
  };

  const renderCard = ({ item }) => {
    const child = nameOf(item.userId);
    const accent = getAvatarColor(child);
    const firstReport = (item.programs || []).find((p) =>
      p.report?.trim(),
    )?.report;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => openDetail(item)}
      >
        <View style={[styles.cardEdge, { backgroundColor: accent }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Avatar
              uri={item.userId?.profileImage}
              name={child}
              color={accent}
              style={styles.avatar}
              textStyle={styles.avatarText}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.childName} numberOfLines={1}>
                {child}
              </Text>
              <Text style={styles.therapistName} numberOfLines={1}>
                by {nameOf(item.therapistId)}
              </Text>
            </View>
            <View style={styles.quarterBadge}>
              <Text style={styles.quarterBadgeText}>
                {item.quarter} {item.year}
              </Text>
            </View>
          </View>

          {!!firstReport && (
            <Text style={styles.preview} numberOfLines={2}>
              {firstReport}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.metaPill}>
              <Feather name="layers" size={fontSize(12)} color="#64748B" />
              <Text style={styles.metaText}>
                {item.programs?.length || 0} programs
              </Text>
            </View>
            <Text style={styles.dateText}>
              {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
          </View>
          {overallAvg(item.programs) !== null && (
            <View style={[styles.metaPill, { backgroundColor: "#E0F2FE", marginTop:10, }]}>
              <Feather name="trending-up" size={fontSize(12)} color="#0B598F" />
              <Text style={[styles.metaText, { color: "#0B598F" }]}>
                Avg {overallAvg(item.programs)}%
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.headerBanner}>
        <Text style={styles.bannerTitle}>Quarterly Reports</Text>
        <Text style={styles.bannerSub}>
          Overview of reports submitted by therapists
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatTile
          label="Reports"
          value={stats.total}
          color="#0B598F"
          icon="file-text"
        />
        <StatTile
          label="Children"
          value={stats.children}
          color="#7C3AED"
          icon="users"
        />
        <StatTile
          label="Therapists"
          value={stats.therapists}
          color="#00725E"
          icon="user-check"
        />
      </View>

      <View style={styles.yearRow}>
        <TouchableOpacity
          onPress={() => setYear((y) => y - 1)}
          style={styles.yearBtn}
        >
          <Feather name="chevron-left" size={fontSize(18)} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.yearText}>{year}</Text>
        <TouchableOpacity
          onPress={() => setYear((y) => y + 1)}
          style={styles.yearBtn}
        >
          <Feather name="chevron-right" size={fontSize(18)} color="#334155" />
        </TouchableOpacity>
      </View>

      <View style={styles.segment}>
        {[null, ...QUARTERS].map((q) => {
          const active = quarter === q;
          return (
            <TouchableOpacity
              key={q || "all"}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => setQuarter(q)}
            >
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
              >
                {q || "All"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather
            name="search"
            size={fontSize(16)}
            color="#94A3B8"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search child or therapist..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
    </View>
  );

  const selectedChild = nameOf(selected?.userId);

  return (
    <View style={[styles.mainContainer, commonStyles.container]}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i._id)}
        renderItem={renderCard}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchReports(1, "refresh")}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore && !loadingMore && !loading)
            fetchReports(page + 1, "more");
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY_BLUE} />
          ) : (
            <View style={styles.empty}>
              <Feather name="inbox" size={fontSize(36)} color="#94A3B8" />
              <Text style={styles.emptyText}>No reports found</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={{ marginVertical: 16 }}
              color={PRIMARY_BLUE}
            />
          ) : null
        }
      />

      {/* DETAIL MODAL */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelected(null)}>
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheet, { maxHeight: "88%" }]}>
                <View style={styles.sheetHandle} />
                {selected && (
                  <>
                    <View style={styles.detailHeader}>
                      <Avatar
                        uri={selected.userId?.profileImage}
                        name={selectedChild}
                        color={getAvatarColor(selectedChild)}
                        style={styles.detailAvatar}
                        textStyle={styles.avatarText}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailChild}>{selectedChild}</Text>
                        <Text style={styles.detailSub}>
                          {selected.quarter} {selected.year} · by{" "}
                          {nameOf(selected.therapistId)}
                        </Text>
                        <Text style={styles.detailSub}>
                          Updated{" "}
                          {new Date(selected.updatedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelected(null)}>
                        <Feather name="x" size={fontSize(20)} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={{ marginTop: 14 }}
                    >
                      {(selected.programs || []).map((p) => {
                        const open = !!openPrograms[p.programId];
                        const avg = avgOf(p.goals);
                        return (
                          <View key={p.programId} style={styles.programBox}>
                            <TouchableOpacity
                              style={styles.programHeader}
                              onPress={() =>
                                setOpenPrograms((s) => ({
                                  ...s,
                                  [p.programId]: !open,
                                }))
                              }
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={styles.programName}
                                  numberOfLines={2}
                                >
                                  {p.programName}
                                </Text>
                                {avg !== null && (
                                  <View style={styles.avgRow}>
                                    <View style={styles.avgTrack}>
                                      <View
                                        style={[
                                          styles.avgFill,
                                          { width: `${avg}%` },
                                        ]}
                                      />
                                    </View>
                                    <Text style={styles.avgText}>{avg}%</Text>
                                  </View>
                                )}
                              </View>
                              <Feather
                                name={open ? "chevron-up" : "chevron-down"}
                                size={fontSize(18)}
                                color="#64748B"
                              />
                            </TouchableOpacity>

                            {open && (
                              <View style={styles.programBody}>
                                <GoalsText goals={p.goals} />
                                <Text style={styles.reportText}>
                                  {p.report?.trim() ||
                                    "No report written for this program."}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function StatTile({ label, value, color, icon }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: color + "1A" }]}>
        <Feather name={icon} size={fontSize(16)} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  listContent: { paddingBottom: 30 },

  headerBanner: {
    backgroundColor: PRIMARY_BLUE,
    paddingHorizontal: wp(20),
    paddingVertical: hp(22),
    paddingBottom: hp(30),
  },
  bannerTitle: {
    fontSize: fontSize(20),
    fontFamily: fonts.bold,
    color: "#FFF",
    lineHeight: 26,
  },
  bannerSub: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#CFE3F2",
    marginTop: 2,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: wp(20),
    marginTop: -hp(16),
  },
  statTile: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: wp(12),
    padding: wp(12),
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statIcon: {
    width: wp(32),
    height: wp(32),
    borderRadius: wp(16),
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: fontSize(20), fontFamily: fonts.bold, marginTop: 6 },
  statLabel: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 18,
  },
  yearBtn: { padding: 6, backgroundColor: "#F1F4FA", borderRadius: 999 },
  yearText: {
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: colors.blackFont,
  },

  segment: {
    flexDirection: "row",
    marginHorizontal: wp(20),
    marginTop: 12,
    padding: 4,
    backgroundColor: "#F1F4FA",
    borderRadius: wp(12),
  },
  segmentItem: {
    flex: 1,
    paddingVertical: hp(8),
    borderRadius: wp(9),
    alignItems: "center",
  },
  segmentItemActive: { backgroundColor: PRIMARY_BLUE },
  segmentText: {
    fontSize: fontSize(13),
    fontFamily: fonts.medium,
    color: "#004E9F",
  },
  segmentTextActive: { color: "#FFF" },

  searchRow: { paddingHorizontal: wp(20), marginTop: 14, marginBottom: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    backgroundColor: "#F1F5F9",
    borderRadius: wp(10),
    paddingHorizontal: wp(12),
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#0F172A",
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: wp(12),
    marginHorizontal: wp(20),
    marginBottom: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardEdge: { width: 5 },
  cardBody: { flex: 1, padding: wp(14) },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: wp(42),
    height: wp(42),
    borderRadius: wp(12),
    overflow: "hidden",
  },
  avatarText: { color: "#FFF", fontSize: fontSize(16), fontFamily: fonts.bold },
  childName: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  therapistName: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  quarterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: PRIMARY_BLUE,
  },
  quarterBadgeText: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
    color: "#FFF",
  },
  preview: {
    marginTop: 10,
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#475569",
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:"center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  metaText: {
    fontSize: fontSize(11),
    fontFamily: fonts.medium,
    color: "#64748B",
  },
  dateText: {
    marginLeft: "auto",
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  empty: { alignItems: "center", marginTop: 50, gap: 8 },
  emptyText: {
    fontSize: fontSize(14),
    fontFamily: fonts.medium,
    color: "#64748B",
  },

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: wp(20),
    borderTopRightRadius: wp(20),
    padding: wp(20),
    paddingBottom: hp(30),
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 14,
  },

  detailHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailAvatar: {
    width: wp(52),
    height: wp(52),
    borderRadius: wp(14),
    overflow: "hidden",
  },
  detailChild: {
    fontSize: fontSize(18),
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  detailSub: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 2,
  },

  programBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: wp(10),
    marginBottom: 10,
    overflow: "hidden",
  },
  programHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: wp(14),
    backgroundColor: "#F8FAFC",
    gap: 8,
  },
  programName: {
    flex: 1,
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  programBody: { padding: wp(14) },
  goalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  goalChip: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 999,
  },
  goalChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  goalFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  goalChipText: { fontSize: fontSize(11), fontFamily: fonts.medium },
  goalPct: { fontSize: fontSize(11), fontFamily: fonts.bold },

  avgRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  avgTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  avgFill: { height: 5, borderRadius: 3, backgroundColor: PRIMARY_BLUE },
  avgText: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
    color: "#334155",
  },
  seeMoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#004E9F",
    backgroundColor: "#FFFFFF",
  },
  seeMoreChipText: {
    fontSize: fontSize(11),
    fontFamily: fonts.medium,
    color: "#004E9F",
  },
  reportText: {
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
});
