import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';

import {
  getUnreadNotificationCountApi,
  switchUserApi,
} from '../../api/authApi';
import {
  getChildUpcomingSessions,
  getCNICUSERS,
  UnreadSummary,
} from '../../api/child/api';
import ChildBottomBar from '../../components/ChildBottomBar';
import NotificationModal from '../../components/NotificationModal';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { therapistSpecialities } from '../../utils/specialities';

export default function ChildDashboardScreen({ navigation }) {
  const { user, logout, switchUser } = useContext(AuthContext);
  const userName = user?.fullName || user?.name || "";
  const profileImage = user?.profileImage || "";
  const userId = user?.id || user?.id;
  const role = user?.role;
  const fatherCnic = user?.fatherCnic;
  // console.log("user", user);
  const [unreadData, setUnreadData] = useState({
    hasUnread: false,
    totalUnreadCount: 0,
    latestUnreadMessage: null,
  });
  const [cnicUsers, setCnicUsers] = useState([]);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchingUser, setSwitchingUser] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [totalUpcomingSessions, setTotalUpcomingSessions] = useState(0);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  const fetchNotificationUnreadCount = async () => {
    try {
      const response = await getUnreadNotificationCountApi();

      if (response?.success) {
        setNotificationUnreadCount(response.count || 0);
      }
    } catch (error) {
      console.log("fetchNotificationUnreadCount error:", error);
    }
  };
  const fetchCNICusers = async () => {
    try {
      if (!fatherCnic) return;
      const response = await getCNICUSERS(fatherCnic);
      if (response?.success) {
        setCnicUsers(response.data || []);
      }
    } catch (err) {
      console.log("cnic error:", err);
    }
  };

  const handleOpenSwitchUser = async () => {
    await fetchCNICusers();
    setShowSwitchModal(true);
  };
  const handleSwitchUser = async (selectedUser) => {
    try {
      setSwitchingUser(true);

      const response = await switchUserApi(selectedUser._id);

      if (!response?.success) {
        return;
      }

      setShowSwitchModal(false);

      await switchUser(response.token, response.user);
    } catch (error) {
      console.log(
        "switch user error:",
        error?.response?.data || error?.message,
      );
    } finally {
      setSwitchingUser(false);
    }
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
  const fetchUpcomingSessions = async () => {
    try {
      setUpcomingLoading(true);

      const response = await getChildUpcomingSessions();

      if (response?.success) {
        setUpcomingSessions(
          response.data || [],
        );

        setTotalUpcomingSessions(
          response.totalUpcoming || 0,
        );
      }
    } catch (error) {
      console.log(
        "fetchUpcomingSessions error:",
        error?.response?.data
          || error?.message,
      );
    } finally {
      setUpcomingLoading(false);
    }
  };
  const getSpeciality = (specialtyId) => {
    if (!specialtyId) {
      return null;
    }

    const normalizedId = specialtyId;

    return therapistSpecialities.find(
      (item) => item.id === normalizedId,
    );
  };
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused || !userId) {
      return;
    }

    fetchUnreadSummary();
    fetchNotificationUnreadCount();
    fetchUpcomingSessions();

    const interval = setInterval(() => {
      fetchUnreadSummary();
    }, 5000);

    const intervalUnread = setInterval(() => {
      fetchNotificationUnreadCount();
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(intervalUnread);
    };
  }, [isFocused, userId]);

  const latestMsg = unreadData.latestUnreadMessage;
  const senderImage = latestMsg?.sender?.profileImage;
  const senderName = latestMsg?.sender?.fullName || "New Message";
  const senderInitials = senderName
    ? senderName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "MSG";

  const bellShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notificationUnreadCount > 0) {
      const shakeAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(bellShake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(bellShake, {
            toValue: -1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(bellShake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(bellShake, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.delay(1200),
        ]),
      );

      shakeAnimation.start();

      return () => {
        shakeAnimation.stop();
        bellShake.setValue(0);
      };
    }

    bellShake.stopAnimation();
    bellShake.setValue(0);
  }, [notificationUnreadCount]);

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <View style={styles.headerRow}>
        <View style={styles.profileContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("ChildProfile")}
          >
            {profileImage
              ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatar}
                />
              )
              : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(userName || "")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
          </TouchableOpacity>

          <View style={styles.userDetails}>
            <Text style={styles.userName}>{userName}</Text>
            <TouchableOpacity
              style={styles.dropdownRow}
              activeOpacity={0.7}
              onPress={handleOpenSwitchUser}
            >
              <Text style={styles.userSubtext}>
                {userId
                  ? userId.length > 10
                    ? `${userId.slice(0, 10)}...`
                    : userId
                  : ""}
              </Text>

              <Feather
                name="chevron-down"
                size={16}
                color="#0F172A"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 12 }]}
            activeOpacity={0.7}
            onPress={() => setShowNotificationModal(true)}
          >
            <View style={styles.notificationWrapper}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: bellShake.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ["-12deg", "12deg"],
                      }),
                    },
                  ],
                }}
              >
                <Feather
                  name="bell"
                  size={20}
                  color="#64748B"
                />
              </Animated.View>

              {notificationUnreadCount > 0 && <View style={styles.redDot} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconButton, { marginLeft: 8 }]} onPress={logout}>
            <MaterialIcons name="logout" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("ChildFeedback")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#FDE6D2" }]}>
              <Feather name="star" size={24} color="#F97316" />
            </View>
            <Text style={styles.gridCardTitle}>Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#D1FAE5" }]}>
              <Feather name="message-square" size={24} color="#10B981" />
              {unreadData.hasUnread && <View style={styles.cardBadgeDot} />}
            </View>
            <Text style={styles.gridCardTitle}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Notifications")}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Entypo name="modern-mic" size={24} color="#EF4444" />
            </View>
            <Text style={styles.gridCardTitle}>School {"\n"} Announcements</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <MaterialCommunityIcons name="receipt" size={24} color="#EF4444" />
            </View>
            <Text style={styles.gridCardTitle}>Billing & Invoices</Text>
          </TouchableOpacity>
        </View>

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

        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionHeaderTitle, { marginBottom: 12 }]}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.actionItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("ChildVideo")}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: "rgba(22,105,169,.4)" }]}>
                <Feather name="play" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, styles.actionLabelActive]}>Media</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("ChildReport")}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: "#FDE2D6" }]}>
                <Feather name="calendar" size={20} color="#EA580C" />
              </View>
              <Text style={styles.actionLabel}>Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("ChildAttendance")}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: "rgba(255,220,196,.6)" }]}>
                <Feather name="user" size={20} color="#EA580C" />
              </View>
              <Text style={styles.actionLabel}>Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.classesSection}>
          <View style={styles.classesHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              Upcoming Sessions
            </Text>

            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>
                {totalUpcomingSessions}
              </Text>
            </View>
          </View>

          {upcomingLoading
            ? (
              <View style={styles.sessionLoading}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />
              </View>
            )
            : upcomingSessions.length === 0
            ? (
              <View style={styles.noSessionsCard}>
                <Feather
                  name="calendar"
                  size={24}
                  color="#94A3B8"
                />

                <Text style={styles.noSessionsText}>
                  No upcoming sessions
                </Text>
              </View>
            )
            : (
              upcomingSessions.map((session) => {
                const speciality = getSpeciality(session.specialty);

                return (
                  <View
                    key={session.appointmentId}
                    style={styles.classCard}
                  >
                    {session.therapistImage
                      ? (
                        <Image
                          source={{ uri: session.therapistImage }}
                          style={styles.sessionAvatar}
                        />
                      )
                      : (
                        <View style={styles.classIconCircle}>
                          <Text style={styles.sessionInitial}>
                            {(session.therapistName || "T")
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}

                    <View style={styles.classInfoContainer}>
                      <Text style={styles.className}>
                        {session.therapistName}
                      </Text>

                      {speciality && (
                        <View
                          style={[
                            styles.specialityBadge,
                            { backgroundColor: speciality.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.specialityBadgeText,
                              { color: speciality.color },
                            ]}
                          >
                            {speciality.label}
                          </Text>
                        </View>
                      )}

                      <View style={styles.sessionDetailsRow}>
                        <Feather
                          name="calendar"
                          size={13}
                          color="#64748B"
                        />
                        <Text style={styles.sessionDetailText}>
                          {new Date(session.date).toLocaleDateString(
                            "en-US",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </Text>
                      </View>

                      <View style={styles.sessionDetailsRow}>
                        <Feather
                          name="clock"
                          size={13}
                          color="#64748B"
                        />
                        <Text style={styles.sessionDetailText}>
                          {session.startTime} - {session.endTime}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
        </View>
      </ScrollView>

      <Modal
        visible={showSwitchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSwitchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.switchModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Switch User</Text>
                <Text style={styles.modalSubtitle}>
                  Select another user
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowSwitchModal(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.userList}
            >
              {cnicUsers.length === 0
                ? (
                  <View style={styles.emptyContainer}>
                    <Feather
                      name="users"
                      size={40}
                      color="#94A3B8"
                    />

                    <Text style={styles.emptyText}>
                      No other users found
                    </Text>
                  </View>
                )
                : (
                  cnicUsers.map((item) => (
                    <TouchableOpacity
                      key={String(item._id)}
                      style={styles.switchUserCard}
                      activeOpacity={0.75}
                      disabled={switchingUser}
                      onPress={() => handleSwitchUser(item)}
                    >
                      {item.profileImage
                        ? (
                          <Image
                            source={{ uri: item.profileImage }}
                            style={styles.switchUserAvatar}
                          />
                        )
                        : (
                          <View style={styles.switchUserAvatarFallback}>
                            <Text style={styles.switchUserAvatarText}>
                              {item.fullName
                                ?.trim()
                                ?.charAt(0)
                                ?.toUpperCase() || "U"}
                            </Text>
                          </View>
                        )}

                      <View style={styles.switchUserInfo}>
                        <Text style={styles.switchUserName}>
                          {item.fullName}
                        </Text>

                        <Text style={styles.switchUserRole}>
                          {item.role}
                        </Text>

                        {!!item.email && (
                          <Text style={styles.switchUserEmail}>
                            {item.email}
                          </Text>
                        )}
                      </View>

                      {switchingUser
                        ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        )
                        : (
                          <Feather
                            name="chevron-right"
                            size={20}
                            color="#94A3B8"
                          />
                        )}
                    </TouchableOpacity>
                  ))
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      <ChildBottomBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#0052A3",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: 4,
  },
  notificationWrapper: {
    position: "relative",
  },
  redDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "#DC2626",
  },

  userDetails: {
    justifyContent: "center",
  },
  userName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 24,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userSubtext: {
    color: "#191C20",
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
    marginBottom: 20,
  },
  gridCard: {
    width: "47.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
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
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  gridCardTitle: {
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 12,
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
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#7CB342",
    lineHeight: 24,
  },
  msgTextContainer: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#191C20",
    lineHeight: 24,
  },
  messageSnippet: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
  },
  msgAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  quickActionsSection: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#191C20",
    lineHeight: 24,
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 32,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: "#191C20",
    fontFamily: fonts.regular,
    lineHeight: 24,
  },
  actionLabelActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  classesSection: {
    marginBottom: 16,
  },
  classesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    justifyContent: "space-between",
  },
  counterBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: fonts.regular,
    lineHeight: 16,
  },
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
  },
  classIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 24,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  classInfoContainer: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#191C20",
  },
  classSubtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: colors.blackFont,
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
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },

  switchModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: "75%",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0F172A",
  },

  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  userList: {
    gap: 10,
  },

  switchUserCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  switchUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  switchUserAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },

  switchUserAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563EB",
  },

  switchUserInfo: {
    flex: 1,
    marginLeft: 12,
  },

  switchUserName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },

  switchUserRole: {
    marginTop: 2,
    fontSize: 13,
    color: "#2563EB",
  },

  switchUserEmail: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748B",
  },
  sessionAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  sessionInitial: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: "#0284C7",
  },
  sessionDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  sessionDetailText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  sessionLoading: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  noSessionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  noSessionsText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  specialityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 5,
    marginBottom: 3,
  },
  specialityBadgeText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
});
