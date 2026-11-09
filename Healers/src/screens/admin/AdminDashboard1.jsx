import { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { Overview, getInvoiceDashboardSummaryApi } from "../../api/admin/api";
import { UnreadSummary } from "../../api/child/api";
import { AuthContext } from "../../context/AuthContext";
import { colors, commonStyles, fonts } from "../../styles/theme";
import { fontSize, hp, wp } from "../../utils/responsive";

/* ----------------------------- constants ----------------------------- */

const SCREEN_W = Dimensions.get("window").width;
const H_PAD = wp(16);
const TILE_GAP = 10;
const QUICK_TILE_W = (SCREEN_W - H_PAD * 2 - TILE_GAP * 3) / 4;

const INITIAL_FINANCE = {
  overdueFees: { amount: 0, childrenCount: 0, invoiceCount: 0 },
  unpaidFees: { amount: 0, childrenCount: 0, invoiceCount: 0 },
  totalRevenue: {
    amount: 0,
    paymentCount: 0,
    fiscalYear: new Date().getFullYear(),
  },
};

// Batch Management and Therapist Management are intentionally removed.
const ADMIN_ITEMS = [
  {
    key: "program",
    title: "Program Builder",
    subtitle: "Manage Programs",
    route: "ProgramBuilder",
    icon: "view-grid-plus",
    iconBg: "#F3E8FF",
    iconColor: "#9333EA",
  },
  {
    key: "leave",
    title: "Leave Requests",
    subtitle: "Approve or reject leaves",
    route: "LeaveRequest",
    icon: "calendar-check",
    iconBg: "#E0EDFF",
    iconColor: "#2563EB",
    badgeKey: "leave",
  },
  {
    key: "feedback",
    title: "Feedback Management",
    subtitle: "Review client feedback",
    route: "Feedback",
    icon: "message-text-outline",
    iconBg: "#FEE2E2",
    iconColor: "#DC2626",
    badgeKey: "feedback",
  },
  {
    key: "broadcast",
    title: "Broadcast Management",
    subtitle: "Announcements & notices",
    route: "BroadcastManagement",
    icon: "broadcast",
    iconBg: "#DCFCE7",
    iconColor: "#16A34A",
    badgeKey: "broadcast",
  },
];

const BAR_HEIGHTS = [18, 26, 34, 44, 54, 64, 80];
const BAR_COLORS = [
  "#DBEAFE",
  "#BFDBFE",
  "#93C5FD",
  "#7CB1FA",
  "#5B97F6",
  "#3B7BF0",
  "#2563EB",
];

/* ------------------------------ helpers ------------------------------ */

const formatMoney = (amount) =>
  Number(amount || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatToday = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const formatTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const capCount = (n) => (Number(n) > 99 ? "99+" : String(n));

/* --------------------------- small components -------------------------- */

const Pill = ({ label, bg, color }) => (
  <View style={[styles.pill, { backgroundColor: bg }]}>
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </View>
);

const CountBadge = ({ count }) =>
  Number(count) > 0 ? (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{capCount(count)}</Text>
    </View>
  ) : null;

const StatCard = ({ icon, iconBg, iconColor, pill, label, value, onPress }) => (
  <TouchableOpacity
    style={[styles.card, styles.statCard]}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <View style={styles.rowBetween}>
      <View style={[styles.statIconBox, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons
          name={icon}
          size={fontSize(20)}
          color={iconColor}
        />
      </View>
      <Pill {...pill} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </TouchableOpacity>
);

/* ------------------------------ main screen ----------------------------- */

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const userId = user?.id || user?._id;
  const role = user?.role;
  const userName = user?.fullName || user?.name || "";
  const profileImage = user?.profileImage || "";

  const [refreshing, setRefreshing] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);

  const [stats, setStats] = useState({
    totalChild: 0,
    therapistCount: 0,
    totalUsers: 0,
    leaveCount: 0,
    unseenFeedbackCount: 0,
    unreadNotificationCount: 0,
    unreadComplaintCount: 0,
    totalMessageCount: 0,
  });
  const [unreadData, setUnreadData] = useState({
    hasUnread: false,
    totalUnreadCount: 0,
    latestUnreadMessage: null,
  });

  const [finance, setFinance] = useState(INITIAL_FINANCE);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState("");

  /* ------------------------------- data ------------------------------- */

  const fetchOverviewData = async () => {
    try {
      const response = await Overview();
      const raw = response?.data || response;
      setStats({
        totalChild: raw?.totalChild || 0,
        therapistCount: raw?.therapistCount || 0,
        totalUsers: raw?.totalUsers || 0,
        leaveCount: raw?.leaveCount || 0,
        unseenFeedbackCount: raw?.unseenFeedbackCount || 0,
        unreadNotificationCount: raw?.unreadNotificationCount || 0,
        unreadComplaintCount: raw?.unreadComplaintCount || 0,
        totalMessageCount: raw?.totalMessageCount || 0,
      });
    } catch (error) {
      console.log("Failed to fetch dashboard overview:", error);
    }
  };

  const fetchUnreadSummary = async () => {
    try {
      if (!userId) return;
      const response = await UnreadSummary(userId, role);
      if (response?.success) setUnreadData(response.data);
    } catch (err) {
      console.log("fetchUnreadSummary error:", err);
    }
  };

  const loadFinance = useCallback(async () => {
    try {
      setFinanceError("");
      const response = await getInvoiceDashboardSummaryApi();
      if (!response?.success) {
        throw new Error(
          response?.message || "Unable to load financial summary.",
        );
      }
      setFinance({
        overdueFees: {
          ...INITIAL_FINANCE.overdueFees,
          ...response.data?.overdueFees,
        },
        unpaidFees: {
          ...INITIAL_FINANCE.unpaidFees,
          ...response.data?.unpaidFees,
        },
        totalRevenue: {
          ...INITIAL_FINANCE.totalRevenue,
          ...response.data?.totalRevenue,
        },
      });
    } catch (err) {
      setFinanceError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load financial summary.",
      );
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  const refreshDashboard = async () => {
    await Promise.all([fetchOverviewData(), fetchUnreadSummary()]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshDashboard(), loadFinance()]);
    setRefreshing(false);
  };

  // counts + unread: poll every 5s while the screen is focused
  useEffect(() => {
    if (!isFocused || !userId) return;
    refreshDashboard();
    const interval = setInterval(refreshDashboard, 5000);
    return () => clearInterval(interval);
  }, [isFocused, userId]);

  // finance runs a heavy aggregation, so load on focus only (no polling)
  useEffect(() => {
    if (isFocused) loadFinance();
  }, [isFocused, loadFinance]);

  /* ----------------------------- derived ------------------------------ */

  const unreadCount = Number(unreadData.totalUnreadCount) || 0;
  const latestMsg = unreadData.latestUnreadMessage;
  const senderName = latestMsg?.sender?.fullName || "New Message";
  const senderImage = latestMsg?.sender?.profileImage;
  const senderInitials = senderName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const badgeFor = (key) => {
    if (key === "leave") return stats.leaveCount;
    if (key === "feedback") return stats.unseenFeedbackCount;
    if (key === "broadcast") return stats.unreadNotificationCount;
    return 0;
  };

  const quickActions = [
    {
      key: "services",
      label: "Services",
      icon: "hospital-box",
      primary: true,
      onPress: () => navigation.navigate("ServiceManagement"),
    },
    {
      key: "complaints",
      label: "Manage Complaints",
      icon: "clipboard-text-outline",
      iconBg: "#F3E8FF",
      iconColor: "#9333EA",
      badge: stats.unreadComplaintCount,
      onPress: () => navigation.navigate("ComplainManagement"),
    },
    {
      key: "fee",
      label: "Fee Management",
      icon: "credit-card-outline",
      iconBg: "#DCFCE7",
      iconColor: "#16A34A",
      onPress: () => navigation.navigate("FeeManagement"),
    },
    {
      key: "invoice",
      label: "Invoice Management",
      icon: "file-document-outline",
      iconBg: "#E0EDFF",
      iconColor: "#2563EB",
      onPress: () => navigation.navigate("InvoiceManagement"),
    },
    {
      key: "reports",
      label: "Reports",
      icon: "chart-box-outline",
      iconBg: "#E3F8F2",
      iconColor: "#00725E",
      active: reportsExpanded,
      onPress: () => setReportsExpanded((v) => !v),
    },
  ];

  const openFee = (type, headerTitle) =>
    navigation.navigate("FeeDetail", { type, layout: { headerTitle } });

  /* ------------------------------- UI --------------------------------- */

  return (
    <View style={[commonStyles.container]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ---------- Header ---------- */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("ChildProfile")}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(userName || "A").trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {userName || "Admin"}
            </Text>
            <Text style={styles.headerDate}>{formatToday()}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("BroadcastManagement")}
            >
              <Feather name="bell" size={fontSize(18)} color="#2563EB" />
              {stats.unreadNotificationCount > 0 && (
                <View style={styles.bellDot} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("Settings")}
            >
              <MaterialIcons
                name="settings"
                size={fontSize(19)}
                color="#475569"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={logout}>
              <MaterialIcons
                name="logout"
                size={fontSize(19)}
                color="#DC2626"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------- Welcome banner ---------- */}
        <LinearGradient
          colors={["#2563EB", "#3B82F6", "#5B9BFA"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>
              {"Welcome back,\n"}
              {userName || "Admin"}
            </Text>
            <Text style={styles.bannerSub}>
              {"Here's what's happening at your institution today."}
            </Text>
          </View>
          <View style={styles.bannerArt}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={fontSize(46)}
              color="#BFDBFE"
            />
          </View>
        </LinearGradient>

        {/* ---------- Stat cards ---------- */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="account-group"
            iconBg="#E0EDFF"
            iconColor="#2563EB"
            pill={{ label: "Enrolled", bg: "#E0EDFF", color: "#2563EB" }}
            label="Total Child"
            value={Number(stats.totalChild).toLocaleString()}
            onPress={() => navigation.navigate("Children")}
          />
          <StatCard
            icon="doctor"
            iconBg="#F3E8FF"
            iconColor="#9333EA"
            pill={{ label: "Active", bg: "#F3E8FF", color: "#9333EA" }}
            label="Therapist"
            value={Number(stats.therapistCount).toLocaleString()}
            onPress={() => navigation.navigate("Therapist")}
          />
          <StatCard
            icon="account-multiple"
            iconBg="#DCFCE7"
            iconColor="#16A34A"
            pill={{ label: "All roles", bg: "#DCFCE7", color: "#16A34A" }}
            label="Total Users"
            value={Number(stats.totalUsers).toLocaleString()}
            onPress={() => navigation.navigate("AllUsers")}
          />
          <StatCard
            icon="message-text"
            iconBg="#FEE2E2"
            iconColor="#DC2626"
            pill={
              unreadCount > 0
                ? {
                    label: `${capCount(unreadCount)} New`,
                    bg: "#EF4444",
                    color: "#FFFFFF",
                  }
                : { label: "Up to date", bg: "#F1F5F9", color: "#64748B" }
            }
            label="Messages"
            value={Number(stats.totalMessageCount).toLocaleString()}
            onPress={() => navigation.navigate("ChildMessages")}
          />
        </View>

        {/* ---------- Financial summary ---------- */}
        <View style={[styles.card, styles.financeCard]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Financial Summary</Text>
              <Text style={styles.cardSub}>Monthly fee collection & status</Text>
            </View>
            <View style={styles.fyPill}>
              <Text style={styles.fyPillText}>
                FY {finance.totalRevenue.fiscalYear}
              </Text>
            </View>
          </View>

          {financeLoading ? (
            <View style={styles.financeLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {!!financeError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{financeError}</Text>
                  <TouchableOpacity onPress={loadFinance}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.revenueRow}
                onPress={() => openFee("revenue", "Total Revenue")}
              >
                <View style={styles.revenueLeft}>
                  <Text style={styles.revenueLabel}>Total Revenue</Text>
                  <Text
                    style={styles.revenueAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    PKR {formatMoney(finance.totalRevenue.amount)}
                  </Text>
                  <View style={styles.paymentsPill}>
                    <Feather name="trending-up" size={12} color="#16A34A" />
                    <Text style={styles.paymentsPillText}>
                      {finance.totalRevenue.paymentCount} payments
                    </Text>
                  </View>
                </View>

                {/* decorative bars only, not real data */}
                <View style={styles.bars}>
                  {BAR_HEIGHTS.map((h, i) => (
                    <View
                      key={i}
                      style={[
                        styles.bar,
                        { height: h, backgroundColor: BAR_COLORS[i] },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>

              <View style={styles.miniRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.miniCard,
                    { backgroundColor: "#FFF5F5", borderColor: "#FEE2E2" },
                  ]}
                  onPress={() => openFee("overdue", "Overdue Fees")}
                >
                  <View style={styles.miniHeader}>
                    <View
                      style={[styles.miniIcon, { backgroundColor: "#FEE2E2" }]}
                    >
                      <MaterialIcons
                        name="event-busy"
                        size={16}
                        color="#DC2626"
                      />
                    </View>
                    <Text style={styles.miniLabel}>Overdue Fees</Text>
                  </View>
                  <Text
                    style={styles.miniAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    PKR {formatMoney(finance.overdueFees.amount)}
                  </Text>
                  <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                    <Text style={[styles.miniSub, { color: "#DC2626" }]}>
                      {finance.overdueFees.childrenCount} Children pending
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.miniCard,
                    { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" },
                  ]}
                  onPress={() => openFee("unpaid", "Unpaid Fees")}
                >
                  <View style={styles.miniHeader}>
                    <View
                      style={[styles.miniIcon, { backgroundColor: "#FEF3C7" }]}
                    >
                      <MaterialIcons
                        name="assignment-late"
                        size={16}
                        color="#F59E0B"
                      />
                    </View>
                    <Text style={styles.miniLabel}>Unpaid Fees</Text>
                  </View>
                  <Text
                    style={styles.miniAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    PKR {formatMoney(finance.unpaidFees.amount)}
                  </Text>
                  <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={[styles.miniSub, { color: "#D97706" }]}>
                      {finance.unpaidFees.invoiceCount} invoices unpaid
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ---------- Messages ---------- */}
        <TouchableOpacity
          style={[styles.card, styles.messagesCard]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("ChildMessages")}
        >
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="message-text"
                size={fontSize(20)}
                color="#2563EB"
              />
              <Text style={[styles.cardTitle, { marginLeft: 8 }]}>
                Messages
              </Text>
            </View>
            <View style={styles.row}>
              {unreadCount > 0 && (
                <Pill
                  label={`${capCount(unreadCount)} New`}
                  bg="#2563EB"
                  color="#FFFFFF"
                />
              )}
              <Feather
                name="chevron-right"
                size={fontSize(18)}
                color="#94A3B8"
                style={{ marginLeft: 6 }}
              />
            </View>
          </View>

          {unreadData.hasUnread && latestMsg ? (
            <View style={styles.msgPreview}>
              {senderImage ? (
                <Image source={{ uri: senderImage }} style={styles.msgAvatar} />
              ) : (
                <View style={[styles.msgAvatar, styles.msgAvatarFallback]}>
                  <Text style={styles.msgAvatarText}>{senderInitials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.msgSender} numberOfLines={1}>
                  {senderName}
                </Text>
                <Text style={styles.msgSnippet} numberOfLines={1}>
                  {latestMsg?.text || "You have a new message!"}
                </Text>
              </View>
              <Text style={styles.msgTime}>
                {formatTime(latestMsg?.createdAt)}
              </Text>
            </View>
          ) : (
            <Text style={styles.caughtUp}>{"You're all caught up."}</Text>
          )}
        </TouchableOpacity>

        {/* ---------- Administration ---------- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <Text style={styles.sectionMeta}>{ADMIN_ITEMS.length} modules</Text>
        </View>

        <View style={styles.adminGrid}>
          {ADMIN_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.card, styles.adminCard]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={styles.rowBetween}>
                <View style={[styles.adminIconBox, { backgroundColor: item.iconBg }]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={fontSize(20)}
                    color={item.iconColor}
                  />
                  <CountBadge count={badgeFor(item.badgeKey)} />
                </View>
                <Feather name="chevron-right" size={fontSize(16)} color="#CBD5E1" />
              </View>
              <Text style={styles.adminTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.adminSub} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------- Quick actions ---------- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[
                styles.card,
                styles.quickTile,
                a.active && styles.quickTileActive,
              ]}
              activeOpacity={0.85}
              onPress={a.onPress}
            >
              <View
                style={[
                  styles.quickIconBox,
                  a.primary
                    ? { backgroundColor: "#2563EB", width: 48, height: 48 }
                    : { backgroundColor: a.iconBg },
                ]}
              >
                <MaterialCommunityIcons
                  name={a.icon}
                  size={fontSize(a.primary ? 26 : 20)}
                  color={a.primary ? "#FFFFFF" : a.iconColor}
                />
                <CountBadge count={a.badge} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------- Reports dropdown (opens below the tiles) ---------- */}
        {reportsExpanded && (
          <View style={[styles.card, styles.reportsCard]}>
            <TouchableOpacity
              style={[styles.reportItem, styles.reportItemBorder]}
              activeOpacity={0.7}
              onPress={() => {
                setReportsExpanded(false);
                navigation.navigate("AdminQuarterlyReports");
              }}
            >
              <View style={[styles.reportIcon, { backgroundColor: "#E3F8F2" }]}>
                <MaterialIcons name="insert-chart" size={21} color="#00725E" />
              </View>
              <View style={styles.reportText}>
                <Text style={styles.reportTitle}>Quarterly Report</Text>
                <Text style={styles.reportSub}>
                  Review child progress reports by therapist
                </Text>
              </View>
              <Feather name="chevron-right" size={fontSize(16)} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportItem}
              activeOpacity={0.7}
              onPress={() => {
                setReportsExpanded(false);
                navigation.navigate("AdminAttendanceReport");
              }}
            >
              <View style={[styles.reportIcon, { backgroundColor: "#E0EDFF" }]}>
                <MaterialIcons name="event-available" size={21} color="#2563EB" />
              </View>
              <View style={styles.reportText}>
                <Text style={styles.reportTitle}>Attendance Report</Text>
                <Text style={styles.reportSub}>View attendance reports</Text>
              </View>
              <Feather name="chevron-right" size={fontSize(16)} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* -------------------------------- styles -------------------------------- */

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingBottom: hp(32) },

  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    elevation: 2,
    shadowColor: "#1E293B",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  /* header */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: hp(12),
    gap: 10,
  },
  avatar: { width: wp(44), height: wp(44), borderRadius: 999 },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: fontSize(18),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
  headerTextWrap: { flex: 1 },
  headerTitle: {
    fontSize: fontSize(20),
    lineHeight: 26,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  headerDate: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#1E293B",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#F59E0B",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  /* banner */
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    padding: wp(20),
    minHeight: hp(130),
    overflow: "hidden",
  },
  bannerTextWrap: { flex: 1, paddingRight: 10 },
  bannerTitle: {
    fontSize: fontSize(22),
    lineHeight: 28,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
  bannerSub: {
    marginTop: 8,
    fontSize: fontSize(12),
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: "#DBEAFE",
  },
  bannerArt: {
    width: wp(78),
    height: wp(78),
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "6deg" }],
  },

  /* pills + badges */
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: fontSize(10), fontFamily: fonts.semiBold },
  countBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: fontSize(9),
    fontFamily: fonts.bold,
  },

  /* stats */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginTop: 14,
  },
  statCard: { width: "48.5%", padding: wp(14) },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    marginTop: 12,
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  statValue: {
    marginTop: 2,
    fontSize: fontSize(26),
    lineHeight: 34,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },

  /* finance */
  financeCard: { marginTop: 14, padding: wp(16) },
  cardTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  cardSub: {
    marginTop: 2,
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },
  fyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  fyPillText: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#334155",
  },
  financeLoading: { paddingVertical: 40, alignItems: "center" },
  errorBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#BA1A1A",
  },
  retryText: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  revenueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  revenueLeft: { flex: 1 },
  revenueLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  revenueAmount: {
    marginTop: 2,
    fontSize: fontSize(24),
    lineHeight: 32,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  paymentsPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  paymentsPillText: {
    fontSize: fontSize(11),
    fontFamily: fonts.medium,
    color: "#16A34A",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: 80,
  },
  bar: { width: 10, borderRadius: 5 },
  miniRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  miniCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: wp(12),
  },
  miniHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  miniLabel: {
    flex: 1,
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#334155",
  },
  miniAmount: {
    marginTop: 10,
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  miniSub: { marginTop: 2, fontSize: fontSize(11), fontFamily: fonts.regular },

  /* messages */
  messagesCard: { marginTop: 14, padding: wp(16) },
  msgPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  msgAvatar: { width: 40, height: 40, borderRadius: 20 },
  msgAvatarFallback: {
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#2563EB",
  },
  msgSender: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  msgSnippet: {
    marginTop: 2,
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  msgTime: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },
  caughtUp: {
    marginTop: 10,
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  /* section headers */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: fontSize(18),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  sectionMeta: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  /* administration */
  adminGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  adminCard: { width: "48.5%", padding: wp(14), minHeight: hp(120) },
  adminIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  adminTitle: {
    marginTop: 14,
    fontSize: fontSize(14),
    lineHeight: 19,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  adminSub: {
    marginTop: 2,
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  /* quick actions */
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP },
  quickTile: {
    width: QUICK_TILE_W,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  quickTileActive: { borderColor: "#2563EB", backgroundColor: "#F5F9FF" },
  quickIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    marginTop: 8,
    fontSize: fontSize(10),
    lineHeight: 13,
    fontFamily: fonts.medium,
    color: "#334155",
    textAlign: "center",
  },

  /* reports dropdown */
  reportsCard: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 4 },
  reportItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  reportItemBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reportText: { flex: 1, marginLeft: 12, paddingRight: 8 },
  reportTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  reportSub: {
    marginTop: 2,
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
});