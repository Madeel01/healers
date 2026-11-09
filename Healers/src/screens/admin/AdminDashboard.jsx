import {
  useContext,
  useEffect,
  useState,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';

import { Overview } from '../../api/admin/api';
import { UnreadSummary } from '../../api/child/api';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';
import Administration from './components/Administration';
import Fee from './components/Fee';

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

  // useEffect(() => {
  //   if (!isFocused) return;

  //   const OverviewData = async () => {
  //     try {
  //       await fetchOverviewData();
  //     } catch (error) {
  //       console.log("Failed to fetch overview data:", error);
  //     }
  //   };

  //   OverviewData();

  //   const interval = setInterval(() => {
  //     OverviewData();
  //   }, 60000);

  //   return () => {
  //     clearInterval(interval);
  //   };
  // }, [isFocused]);

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

  // useEffect(() => {
  //   if (!isFocused || !userId) {
  //     return;
  //   }
  //   fetchUnreadSummary();
  //   const interval = setInterval(() => {
  //     fetchUnreadSummary();
  //   }, 5000);

  //   return () => {
  //     clearInterval(interval);
  //   };
  // }, [isFocused, userId]);

  const latestMsg = unreadData.latestUnreadMessage;
  const senderImage = latestMsg?.sender?.profileImage;
  const senderName = latestMsg?.sender?.fullName || "New Message";
  const senderInitials = senderName
    ? senderName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "MSG";
  const refreshDashboard = async () => {
    try {
      await Promise.all([
        fetchOverviewData(),
        fetchUnreadSummary(),
      ]);
    } catch (error) {
      console.log("Dashboard refresh error:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    await refreshDashboard();

    setRefreshing(false);
  };
  useEffect(() => {
    if (!isFocused || !userId) return;

    refreshDashboard();

    const interval = setInterval(() => {
      refreshDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, [isFocused, userId]);
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

          {/* <TouchableOpacity
            style={[styles.statCard, styles.messageCard]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={styles.messageTopRow}>
              <View style={styles.messageIconBox}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={fontSize(24)}
                  color="#F43F5E"
                />
              </View>

              {unreadData.totalUnreadCount > 0 && (
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>
                    {unreadData.totalUnreadCount > 99
                      ? "99+"
                      : unreadData.totalUnreadCount} New
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.messageLabel}>Messages</Text>
            <Text style={styles.messageValue}>
              {stats.totalMessageCount.toLocaleString()}
            </Text>
          </TouchableOpacity> */}
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
                  color="#F58B2A"
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
          {/* <TouchableOpacity
            style={[styles.statCard, { backgroundColor: "#fff" }]}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#D1FAE5" }]}>
              <Feather name="message-square" size={24} color="#10B981" /> */}
              {/* {unreadData.hasUnread && <View style={styles.cardBadgeDot} />} */}
              {/* {unreadData.totalUnreadCount > 0 && (
                <View style={styles.messageCountBadge}>
                  <Text style={styles.messageCountBadgeText}>
                    {unreadData.totalUnreadCount > 99
                      ? "99+"
                      : unreadData.totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.gridCardTitle}>Messages</Text>
          </TouchableOpacity> */}
        </LinearGradient>

        <Fee customstyles={styles} />

        {unreadData.hasUnread && (
          <TouchableOpacity
            style={styles.messageBanner}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={styles.messageBannerHeader}>
              <View style={styles.messageBannerTitleRow}>
                <View style={styles.bannerIconBox}>
                  <Feather name="message-square" size={16} color="#7CB342" />
                </View>
                <Text style={styles.messageBannerTitle}>Messages</Text>
              </View>
              <View style={styles.badgeNew}>
                <Text style={styles.badgeNewText}>
                  {unreadData.totalUnreadCount} {unreadData.totalUnreadCount === 1 ? "New" : "New Messages"}
                </Text>
              </View>
            </View>

            <View style={styles.messageCardContent}>
              {senderImage
                ? (
                  <Image
                    source={{ uri: senderImage }}
                    style={styles.msgAvatarImage}
                  />
                )
                : (
                  <View style={styles.msgAvatarCircle}>
                    <Text style={styles.msgAvatarText}>
                      {senderInitials}
                    </Text>
                  </View>
                )}
              <View style={styles.msgTextContainer}>
                <Text style={styles.teacherName}>{senderName}</Text>
                <Text style={styles.messageSnippet} numberOfLines={1}>
                  {latestMsg?.text || "You have a new message!"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        <Administration
          customstyles={styles}
          leaveCount={stats.leaveCount}
          feedbackCount={stats.unseenFeedbackCount}
          broadcastCount={stats.unreadNotificationCount}
        />

        <Text style={styles.sectionHeadTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate("ComplainManagement")}
        >
          <View style={[styles.quickIconBox, { backgroundColor: "#FEE2E2", position: "relative" }]}>
            <Feather name="message-square" size={22} color="#DC2626" />
            {Number(stats.unreadComplaintCount) > 0 && (
              <View style={styles.messageCountBadge}>
                <Text style={styles.messageCountBadgeText}>
                  {Number(stats.unreadComplaintCount) > 99 ? "99+" : stats.unreadComplaintCount}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Manage Complaints</Text>
            <Text style={styles.quickActionSub}>View and respond to complaints</Text>
          </View>
          <AntDesign name="right" size={20} color="#717781" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate("FeeManagement")}>
          <View style={[styles.quickIconBox, { backgroundColor: "#DCFCE7" }]}>
            <MaterialIcons name="payments" size={22} color="#16A34A" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Fee Management</Text>
            <Text style={styles.quickActionSub}>Manage fees and payments</Text>
          </View>
          <AntDesign name="right" size={20} color="#717781" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate("ServiceManagement")}>
          <View style={[styles.quickIconBox, { backgroundColor: "#dbfef9" }]}>
            <MaterialIcons name="medical-services" size={22} color="#25ebb0" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Service Management</Text>
            <Text style={styles.quickActionSub}>Create and manage services</Text>
          </View>
          <AntDesign name="right" size={20} color="#717781" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate("InvoiceManagement")}>
          <View style={[styles.quickIconBox, { backgroundColor: "#DBEAFE" }]}>
            <MaterialIcons name="receipt-long" size={22} color="#2563EB" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Invoice Management</Text>
            <Text style={styles.quickActionSub}>Generate and manage invoices</Text>
          </View>
          <AntDesign name="right" size={20} color="#717781" />
        </TouchableOpacity>

        {/* Reports Dropdown */}
        <View style={styles.quickActionWrapper}>
          <TouchableOpacity
            style={styles.quickActionCard}
            activeOpacity={0.8}
            onPress={() => setReportsExpanded(!reportsExpanded)}
          >
            <View
              style={[
                styles.quickIconBox,
                { backgroundColor: "#E3F8F2" },
              ]}
            >
              <MaterialIcons
                name="assessment"
                size={22}
                color="#00725E"
              />
            </View>

            <View style={styles.quickActionText}>
              <Text style={styles.quickActionTitle}>
                Reports
              </Text>
              <Text style={styles.quickActionSub}>
                View and manage reports
              </Text>
            </View>

            <AntDesign
              name={reportsExpanded ? "down" : "right"}
              size={20}
              color="#717781"
            />
          </TouchableOpacity>

          {reportsExpanded && (
            <View style={styles.dropdownContainer}>
              {/* Quarterly Report */}
              <TouchableOpacity
                style={styles.dropdownItem}
                activeOpacity={0.7}
                onPress={() => {
                  setReportsExpanded(false);
                  navigation.navigate("AdminQuarterlyReports");
                }}
              >
                <View style={styles.dropdownIcon}>
                  <MaterialIcons
                    name="insert-chart"
                    size={21}
                    color="#00725E"
                  />
                </View>

                <View style={styles.quickActionText}>
                  <Text style={styles.dropdownTitle}>
                    Quarterly Report
                  </Text>
                  <Text style={styles.quickActionSub}>
                    Review child progress reports by therapist
                  </Text>
                </View>

                <AntDesign name="right" size={16} color="#717781" />
              </TouchableOpacity>

              {/* Attendance Report */}
              <TouchableOpacity
                style={styles.dropdownItem}
                activeOpacity={0.7}
                onPress={() => {
                  setReportsExpanded(false);
                  navigation.navigate("AdminAttendanceReport");
                }}
              >
                <View style={styles.dropdownIcon}>
                  <MaterialIcons
                    name="event-available"
                    size={21}
                    color="#2563EB"
                  />
                </View>

                <View style={styles.quickActionText}>
                  <Text style={styles.dropdownTitle}>
                    Attendance Report
                  </Text>
                  <Text style={styles.quickActionSub}>
                    View attendance reports
                  </Text>
                </View>

                <AntDesign name="right" size={16} color="#717781" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {
          /*
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate("AdminQuarterlyReports")}
        >
          <View style={[styles.quickIconBox, { backgroundColor: "#E3F8F2" }]}>
            <MaterialIcons name="assessment" size={22} color="#00725E" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Quarterly Reports</Text>
            <Text style={styles.quickActionSub}>Review child progress reports by therapist</Text>
          </View>
          <AntDesign name="right" size={20} color="#717781" />
        </TouchableOpacity> */
        }
      </ScrollView>
    </View>
  );
}

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
  avatarContainer: {
    width: wp(40),
    height: wp(40),
    borderRadius: 999,
    backgroundColor: "#1669A9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: wp(38),
    height: wp(38),
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: fontSize(22),
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    width: wp(180),
  },
  headerDate: {
    fontSize: fontSize(14),
    color: "#414750",
    fontFamily: fonts.regular,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap:6,
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
  sectionHeadTitle: {
    fontSize: fontSize(24),
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 32,
    marginVertical: 10,
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
  loadingContainer: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
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
  statLabelDark: {
    color: "#181C1E",
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    textAlign: "center",
  },

  quickActionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    elevation: 1,
  },
  quickIconBox: {
    width: 42,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionText: {
    flex: 1,
    marginLeft: 12,
    paddingRight: hp(10),
  },
  quickActionTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 20,
  },
  quickActionSub: {
    fontSize: fontSize(14),
    color: "#414750",
    fontFamily: fonts.regular,
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
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  cardBadgeDot: {
    position: "absolute",
    top: 2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  gridCardTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#191C20",
    textAlign: "center",
    lineHeight: 18,
  },
  messageBanner: {
    backgroundColor: "#E1F3D8",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  messageBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  messageBannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBannerTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#191C20",
    lineHeight: 24,
  },
  badgeNew: {
    backgroundColor: "#7CB342",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeNewText: {
    fontSize: fontSize(12),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  messageCardContent: {
    backgroundColor: "rgba(255,255,255,.6)",
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  msgAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#E1F3D8",
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#7CB342",
    lineHeight: 24,
  },
  msgTextContainer: {
    flex: 1,
  },
  teacherName: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#191C20",
    lineHeight: 24,
  },
  messageSnippet: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
  },
  msgAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
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

    // Shadow (Android)
    elevation: 4,
  },
  messageCountBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: wp(24),
    minHeight: hp(24),
    paddingHorizontal: 3,
    borderRadius: 88,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  messageCountBadgeText: {
    color: "#FFFFFF",
    fontSize: fontSize(8),
    fontFamily: fonts.semiBold,
    textAlign: "center",
  },
  quickActionWrapper: {
    marginBottom: 10,
  },

  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginTop: -4,
    marginHorizontal: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  dropdownIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },

  dropdownTitle: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },
  // messageCard: {
  //   backgroundColor: "#FFFFFF",
  //   alignItems: "flex-start",
  //   justifyContent: "center",
  //   padding: wp(16),
  //   height: hp(100),
  // },
  // messageTopRow: {
  //   width: "100%",
  //   flexDirection: "row",
  //   justifyContent: "space-between",
  //   alignItems: "flex-start",
  // },
  // messageIconBox: {
  //   width: wp(38),
  //   height: wp(38),
  //   borderRadius: wp(12),
  //   backgroundColor: "#FFECEF",
  //   alignItems: "center",
  //   justifyContent: "center",
  // },
  // newPill: {
  //   backgroundColor: "#F43F5E",
  //   paddingHorizontal: wp(6),
  //   paddingVertical: hp(3),
  //   borderRadius: 999,
  // },
  // newPillText: {
  //   color: "#FFFFFF",
  //   fontSize: fontSize(9),
  //   fontFamily: fonts.bold,
  // },
  // messageLabel: {
  //   marginTop: hp(2),
  //   fontSize: fontSize(14),
  //   fontFamily: fonts.medium,
  //   color: "#64748B",
  //   lineHeight: 21,
  // },
  // messageValue: {
  //   marginTop:2,
  //   fontSize: fontSize(16),
  //   fontFamily: fonts.bold,
  //   color: "#0F172A",
  //   lineHeight: 22,
  // },
messageCard: {
  backgroundColor: "#eed098",
  alignItems: "center",
  justifyContent: "center",
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
  backgroundColor: "#FFECEF",
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
  color: "#64748B",
  textAlign: "center",
  lineHeight: 20,
  marginTop: 5,
  includeFontPadding: false,
},

messageValue: {
  fontSize: fontSize(16),
  fontFamily: fonts.bold,
  color: "#0F172A",
  textAlign: "center",
  lineHeight: 20,
  marginTop: 3,
  includeFontPadding: false,
},
});
