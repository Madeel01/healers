import { useCallback, useContext, useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
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

import Feather from "@expo/vector-icons/Feather";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { Overview, getInvoiceDashboardSummaryApi } from "../../api/admin/api";
import { UnreadSummary } from "../../api/child/api";
import { AuthContext } from "../../context/AuthContext";
import { colors, commonStyles, fonts } from "../../styles/theme";
import { fontSize, hp, wp } from "../../utils/responsive";


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


const formatMoney = (amount) =>
  Number(amount || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

const Pill = ({ label, bg, color }) => (
  <View style={[ns.pill, { backgroundColor: bg }]}>
    <Text style={[ns.pillText, { color }]}>{label}</Text>
  </View>
);

const CountBadge = ({ count }) =>
  Number(count) > 0 ? (
    <View style={ns.countBadge}>
      <Text style={ns.countBadgeText}>{capCount(count)}</Text>
    </View>
  ) : null;


export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const [stats, setStats] = useState({
    totalChild: 0,
    therapistCount: 0,
    totalUsers: 0,
    sessionCount: 0,
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
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const userName = user?.fullName || user?.name || "";
  const profileImage = user?.profileImage || "";
  const userId = user?.id || user?._id;
  const role = user?.role;
  const isFocused = useIsFocused();

  const [finance, setFinance] = useState(INITIAL_FINANCE);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState("");

  const fetchOverviewData = async () => {
    try {
      const response = await Overview();
      const rawData = response?.data || response;

      setStats({
        totalChild: rawData?.totalChild || 0,
        therapistCount: rawData?.therapistCount || 0,
        totalUsers: rawData?.totalUsers || 0,
        sessionCount: rawData?.sessionCount || 0,
        leaveCount: rawData?.leaveCount || 0,
        unseenFeedbackCount: rawData?.unseenFeedbackCount || 0,
        unreadNotificationCount: rawData?.unreadNotificationCount || 0,
        unreadComplaintCount: rawData?.unreadComplaintCount || 0,
        totalMessageCount: rawData?.totalMessageCount || 0,
      });
    } catch (error) {
      console.log("Failed to fetch dashboard overview:", error);
    }
  };

  const getCurrentFormattedDate = () => {
    const options = { weekday: "long", month: "short", day: "numeric" };
    return new Date().toLocaleDateString("en-US", options);
  };

  const fetchUnreadSummary = async () => {
    try {
      if (!userId) return;
      const response = await UnreadSummary(userId, role);
      if (response?.success) {
        setUnreadData(response.data);
      }
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

  const latestMsg = unreadData.latestUnreadMessage;
  const senderImage = latestMsg?.sender?.profileImage;
  const senderName = latestMsg?.sender?.fullName || "New Message";
  const senderInitials = senderName
    ? senderName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "MSG";
  const unreadCount = Number(unreadData.totalUnreadCount) || 0;

  const refreshDashboard = async () => {
    try {
      await Promise.all([fetchOverviewData(), fetchUnreadSummary()]);
    } catch (error) {
      console.log("Dashboard refresh error:", error);
    }
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

    const interval = setInterval(() => {
      refreshDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, [isFocused, userId]);

  // finance runs a heavy aggregation, so load on focus only (no polling)
  useEffect(() => {
    if (isFocused) loadFinance();
  }, [isFocused, loadFinance]);

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
        {/* ================= FIRST DASHBOARD (unchanged, above Fee) ================= */}
        <View style={styles.headerRow}>
          <View style={styles.profileContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("ChildProfile")}
            >
              {profileImage
                ? (
                  <Image
                    source={{
                      uri: profileImage,
                    }}
                    style={styles.avatar}
                  />
                )
                : (
                  <View style={styles.avatarFallback}>
                    <Text
                      style={styles.avatarFallbackText}
                    >
                      {(userName || "User")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
            </TouchableOpacity>

            <View>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                {userName}
              </Text>
              <Text style={styles.headerDate}>{getCurrentFormattedDate()}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("Settings")}
            >
              <MaterialIcons name="settings" size={fontSize(22)} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton]} onPress={logout}>
              <MaterialIcons name="logout" size={fontSize(20)} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionTextContainer}>
          <Text style={styles.sectionTitle}>Dashboard Overview</Text>
          <Text style={styles.sectionSubtitle}>Welcome back, Admin</Text>
        </View>

        <LinearGradient
          colors={["#FCD5B5", "#FFF3EB", "#FFFFFF"]}
          locations={[0, 0.75, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.statsGrid}
        >
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: "#0061A5" }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Children")}
          >
            <View style={[styles.cardIconContainer, { backgroundColor: "#D1E4FF" }]}>
              <FontAwesome5 name="child" size={22} color={colors.primary} />
            </View>
            <Text style={styles.statLabelLight}>Total Child</Text>
            <Text style={styles.statValueLight}>
              {stats.totalChild.toLocaleString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: "#2892D9" }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Therapist")}
          >
            <View style={[styles.cardIconContainer, { backgroundColor: colors.primary }]}>
              <FontAwesome5 name="user-md" size={22} color="#49A7E6" />
            </View>
            <Text style={styles.statLabelLight}>Therapist</Text>
            <Text style={styles.statValueLight}>
              {stats.therapistCount.toLocaleString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: "#f39c12" }]}
            onPress={() => navigation.navigate("AllUsers")}
          >
            <View style={[styles.cardIconContainer, { backgroundColor: colors.white }]}>
              <MaterialCommunityIcons name="account-group" size={22} color="#F58B2A" />
            </View>
            <Text style={styles.statLabelLight}>Total Users</Text>
            <Text style={styles.statValueLight}>
              {stats.totalUsers.toLocaleString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, styles.messageCard]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={styles.messageIconWrapper}>
              <View style={styles.messageIconBox}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={fontSize(20)}
                  color="white"
                />
              </View>

              {unreadData.totalUnreadCount > 0 && (
                <View style={styles.messageBadge}>
                  <Text style={styles.messageBadgeText}>
                    {unreadData.totalUnreadCount > 99
                      ? "99+"
                      : unreadData.totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.messageLabel}>Messages</Text>
            <Text style={styles.messageValue}>
              {stats.totalMessageCount.toLocaleString()}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ================= SECOND DASHBOARD (replaces <Fee /> and everything below) ================= */}

        {/* ---------- Financial summary ---------- */}
        <View style={[ns.card, ns.financeCard]}>
          <View style={ns.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={ns.cardTitle}>Financial Summary</Text>
              <Text style={ns.cardSub}>Monthly fee collection & status</Text>
            </View>
            <View style={ns.fyPill}>
              <Text style={ns.fyPillText}>
                FY {finance.totalRevenue.fiscalYear}
              </Text>
            </View>
          </View>

          {financeLoading ? (
            <View style={ns.financeLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {!!financeError && (
                <View style={ns.errorBox}>
                  <Text style={ns.errorText}>{financeError}</Text>
                  <TouchableOpacity onPress={loadFinance}>
                    <Text style={ns.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={ns.revenueRow}
                onPress={() => openFee("revenue", "Total Revenue")}
              >
                <View style={ns.revenueLeft}>
                  <Text style={ns.revenueLabel}>Total Revenue</Text>
                  <Text
                    style={ns.revenueAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    PKR {formatMoney(finance.totalRevenue.amount)}
                  </Text>
                  <View style={ns.paymentsPill}>
                    <Feather name="trending-up" size={12} color="#16A34A" />
                    <Text style={ns.paymentsPillText}>
                      {finance.totalRevenue.paymentCount} payments
                    </Text>
                  </View>
                </View>

                {/* decorative bars only, not real data */}
                <View style={ns.bars}>
                  {BAR_HEIGHTS.map((h, i) => (
                    <View
                      key={i}
                      style={[
                        ns.bar,
                        { height: h, backgroundColor: BAR_COLORS[i] },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>

              <View style={ns.miniRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    ns.miniCard,
                    { backgroundColor: "#FFF5F5", borderColor: "#FEE2E2" },
                  ]}
                  onPress={() => openFee("overdue", "Overdue Fees")}
                >
                  <View style={ns.miniHeader}>
                    <View style={[ns.miniIcon, { backgroundColor: "#FEE2E2" }]}>
                      <MaterialIcons name="event-busy" size={16} color="#DC2626" />
                    </View>
                    <Text style={ns.miniLabel}>Overdue Fees</Text>
                  </View>
                  <Text
                    style={ns.miniAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    PKR {formatMoney(finance.overdueFees.amount)}
                  </Text>
                  <View style={ns.row}>
                    <View style={[ns.dot, { backgroundColor: "#EF4444" }]} />
                    <Text style={[ns.miniSub, { color: "#DC2626" }]}>
                      {finance.overdueFees.childrenCount} Children pending
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    ns.miniCard,
                    { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" },
                  ]}
                  onPress={() => openFee("unpaid", "Unpaid Fees")}
                >
                  <View style={ns.miniHeader}>
                    <View style={[ns.miniIcon, { backgroundColor: "#FEF3C7" }]}>
                      <MaterialIcons name="assignment-late" size={16} color="#F59E0B" />
                    </View>
                    <Text style={ns.miniLabel}>Unpaid Fees</Text>
                  </View>
                  <Text
                    style={ns.miniAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    PKR {formatMoney(finance.unpaidFees.amount)}
                  </Text>
                  <View style={ns.row}>
                    <View style={[ns.dot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={[ns.miniSub, { color: "#D97706" }]}>
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
          style={[ns.card, ns.messagesCard]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("ChildMessages")}
        >
          <View style={ns.rowBetween}>
            <View style={ns.row}>
              <MaterialCommunityIcons
                name="message-text"
                size={fontSize(20)}
                color="#2563EB"
              />
              <Text style={[ns.cardTitle, { marginLeft: 8 }]}>Messages</Text>
            </View>
            <View style={ns.row}>
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
            <View style={ns.msgPreview}>
              {senderImage ? (
                <Image source={{ uri: senderImage }} style={ns.msgAvatar} />
              ) : (
                <View style={[ns.msgAvatar, ns.msgAvatarFallback]}>
                  <Text style={ns.msgAvatarText}>{senderInitials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={ns.msgSender} numberOfLines={1}>
                  {senderName}
                </Text>
                <Text style={ns.msgSnippet} numberOfLines={1}>
                  {latestMsg?.text || "You have a new message!"}
                </Text>
              </View>
              <Text style={ns.msgTime}>{formatTime(latestMsg?.createdAt)}</Text>
            </View>
          ) : (
            <Text style={ns.caughtUp}>{"You're all caught up."}</Text>
          )}
        </TouchableOpacity>

        {/* ---------- Administration ---------- */}
        <View style={ns.sectionHeader}>
          <Text style={ns.sectionTitle}>Administration</Text>
          <Text style={ns.sectionMeta}>{ADMIN_ITEMS.length} modules</Text>
        </View>

        <View style={ns.adminGrid}>
          {ADMIN_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[ns.card, ns.adminCard]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={ns.rowBetween}>
                <View style={[ns.adminIconBox, { backgroundColor: item.iconBg }]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={fontSize(20)}
                    color={item.iconColor}
                  />
                  <CountBadge count={badgeFor(item.badgeKey)} />
                </View>
                <Feather name="chevron-right" size={fontSize(16)} color="#CBD5E1" />
              </View>
              <Text style={ns.adminTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={ns.adminSub} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------- Quick actions ---------- */}
        <View style={ns.sectionHeader}>
          <Text style={ns.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={ns.quickGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[ns.card, ns.quickTile, a.active && ns.quickTileActive]}
              activeOpacity={0.85}
              onPress={a.onPress}
            >
              <View
                style={[
                  ns.quickIconBox,
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
              <Text style={ns.quickLabel} numberOfLines={2}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------- Reports dropdown (opens below the tiles) ---------- */}
        {reportsExpanded && (
          <View style={[ns.card, ns.reportsCard]}>
            <TouchableOpacity
              style={[ns.reportItem, ns.reportItemBorder]}
              activeOpacity={0.7}
              onPress={() => {
                setReportsExpanded(false);
                navigation.navigate("AdminQuarterlyReports");
              }}
            >
              <View style={[ns.reportIcon, { backgroundColor: "#E3F8F2" }]}>
                <MaterialIcons name="insert-chart" size={21} color="#00725E" />
              </View>
              <View style={ns.reportText}>
                <Text style={ns.reportTitle}>Quarterly Report</Text>
                <Text style={ns.reportSub}>
                  Review child progress reports by therapist
                </Text>
              </View>
              <Feather name="chevron-right" size={fontSize(16)} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={ns.reportItem}
              activeOpacity={0.7}
              onPress={() => {
                setReportsExpanded(false);
                navigation.navigate("AdminAttendanceReport");
              }}
            >
              <View style={[ns.reportIcon, { backgroundColor: "#E0EDFF" }]}>
                <MaterialIcons name="event-available" size={21} color="#2563EB" />
              </View>
              <View style={ns.reportText}>
                <Text style={ns.reportTitle}>Attendance Report</Text>
                <Text style={ns.reportSub}>View attendance reports</Text>
              </View>
              <Feather name="chevron-right" size={fontSize(16)} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------- styles: FIRST dashboard (top part, unchanged) ------------- */

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(16),
    paddingBottom: hp(24),
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: hp(12),
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: wp(38),
    height: wp(38),
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: fontSize(20),
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    width: wp(180),
  },
  headerDate: {
    fontSize: fontSize(13),
    color: "#414750",
    fontFamily: fonts.regular,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTextContainer: {
    alignItems: "flex-start",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 24,
    marginTop: 10,
  },
  sectionSubtitle: {
    fontSize: fontSize(12),
    color: "#777D87",
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 35,
    minHeight: 240,
  },
  statCard: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconContainer: {
    width: 38,
    height: 38,
    padding: 8,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabelLight: {
    color: colors.white,
    fontSize: fontSize(14),
    marginTop: 5,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  statValueLight: {
    color: colors.white,
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    lineHeight: 20,
    marginTop: 3,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  messageCard: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",

    // Subtle shadow
    shadowColor: "#D99B36",
    shadowOffset: {
        width: 0,
        height: 1,
    },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    // elevation: 1,

    // // Light border
    borderWidth: 1,
    borderColor: "rgba(253, 213, 186, 0.7)",
    },
  messageIconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  messageIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F58B2A",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBadge: {
    position: "absolute",
    top: -6,
    right: -7,
    minWidth: 20,
    minHeight: 20,
    borderRadius: 10,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  messageBadgeText: {
    color: "#FFFFFF",
    fontSize: fontSize(9),
    fontFamily: fonts.bold,
    textAlign: "center",
  },
  messageLabel: {
    fontSize: fontSize(14),
    fontFamily: fonts.medium,
    color: "#101318",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 5,
    includeFontPadding: false,
  },
  messageValue: {
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: "#8d4b0e",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 3,
    includeFontPadding: false,
  },
});

/* ------------- styles: SECOND dashboard (bottom part) ------------- */

const ns = StyleSheet.create({
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