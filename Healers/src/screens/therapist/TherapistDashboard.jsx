import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';

import { getUnreadNotificationCountApi } from '../../api/authApi';
import { UnreadSummary } from '../../api/child/api';
import {
  getDashboardStatsApi,
  getTherapistAttendanceApi,
  markTherapistAttendanceApi,
} from '../../api/therapist/api';
import NotificationModal from '../../components/NotificationModal';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  }

  if (hour >= 17 && hour < 21) {
    return "Good Evening";
  }

  return "Good Night";
};

export default function TherapistDashboardScreen({ navigation }) {
  const { user, logout, isImpersonating } = useContext(AuthContext);

  const userName = user?.fullName || user?.name || "";
  const userId = user?.id || user?._id;
  const role = user?.role;
  const profileImage = user?.profileImage || "";
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [greeting, setGreeting] = useState(getGreeting());
  const [stats, setStats] = useState({
    assignedChildren: 0,
    todaySessions: 0,
    monthlyFeedback: "0/0",
    overallAttendance: "0%",
    nextSession: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadData, setUnreadData] = useState({
    hasUnread: false,
    totalUnreadCount: 0,
    latestUnreadMessage: null,
  });
  const noAssignedChildren = loading || Number(stats.assignedChildren ?? 0) <= 0;

  const disableMessages = isImpersonating;

  const [therapistAttendance, setTherapistAttendance] = useState({
    latestAttendance: null,
    dueAppointment: null,
  });

  const [showTherapistAttendanceModal, setShowTherapistAttendanceModal] = useState(false);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [dismissedAppointmentId, setDismissedAppointmentId] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());

  useFocusEffect(
    useCallback(() => {
      fetchDashboardStats();
    }, []),
  );
  const isFocused = useIsFocused();

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const ID = user?.id;

      const res = await getDashboardStatsApi({ filter: ID });
      if (res?.success && res?.data) {
        setStats(res.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
  };

  const formatSessionDate = (dateVal) => {
    if (!dateVal) return "";
    const rawDate = dateVal?.$date || dateVal;
    const d = new Date(rawDate);

    if (isNaN(d.getTime())) return "";

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }); // Output: "Sep 19, 2026"
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

  useEffect(() => {
    if (!isFocused || !userId) {
      return;
    }
    fetchUnreadSummary();
    fetchNotificationUnreadCount();

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

  useFocusEffect(
    useCallback(() => {
      setGreeting(getGreeting());

      const interval = setInterval(() => {
        setGreeting(getGreeting());
      }, 60000);

      return () => clearInterval(interval);
    }, []),
  );

  const fetchTherapistAttendance = async () => {
    try {
      const response = await getTherapistAttendanceApi();
      const result = response?.data?.success
        ? response.data
        : response;

      if (result?.success) {
        const data = result.data || {};

        setTherapistAttendance({
          latestAttendance: data.latestAttendance || null,
          dueAppointment: data.dueAppointment || null,
        });

        const due = data.dueAppointment;

        if (
          due?.appointmentId
          && due.therapistAttendance === "pending"
          && due.appointmentId !== dismissedAppointmentId
        ) {
          setShowTherapistAttendanceModal(true);
        }
      }
    } catch (error) {
      console.error(
        "Fetch therapist attendance error:",
        error?.response?.data || error.message,
      );
    }
  };

  const submitTherapistAttendance = async (status) => {
    const appointment = therapistAttendance.dueAppointment;

    if (!appointment?.appointmentId || attendanceSubmitting) {
      return;
    }

    try {
      setAttendanceSubmitting(true);

      const response = await markTherapistAttendanceApi(
        appointment.appointmentId,
        status,
      );

      const result = response?.data?.success
        ? response.data
        : response;

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to mark attendance.",
        );
      }

      const saved = result.data;

      setTherapistAttendance((previous) => ({
        ...previous,
        latestAttendance: saved,
        dueAppointment: {
          ...appointment,
          therapistAttendance: saved.therapistAttendance,
          markedAt: saved.markedAt,
        },
      }));

      setShowTherapistAttendanceModal(false);
      setDismissedAppointmentId(appointment.appointmentId);

      await fetchTherapistAttendance();
    } catch (error) {
      Alert.alert(
        "Attendance",
        error?.response?.data?.message
          || error.message
          || "Unable to mark therapist attendance.",
      );
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  const dismissTherapistAttendanceModal = () => {
    const appointment = therapistAttendance.dueAppointment;

    if (appointment?.appointmentId) {
      setDismissedAppointmentId(appointment.appointmentId);
    }

    setShowTherapistAttendanceModal(false);
  };

  const formatMarkedAt = (value) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const attendanceLabel = (status) => {
    switch (status) {
      case "present":
        return "Present";
      case "absent":
        return "Absent";
      case "cancel":
        return "Cancelled";
      case "postponed":
        return "Postponed";
      default:
        return "Pending";
    }
  };

  const attendanceColor = (status) => {
    switch (status) {
      case "present":
        return {
          backgroundColor: "#E8FBF2",
          color: "#009D73",
        };
      case "absent":
        return {
          backgroundColor: "#FFF0F0",
          color: "#DC2626",
        };
      case "cancel":
        return {
          backgroundColor: "#FFF0F0",
          color: "#DC2626",
        };
      case "postponed":
        return {
          backgroundColor: "#EEF5FF",
          color: "#2563EB",
        };
      default:
        return {
          backgroundColor: "#FFF5DF",
          color: "#A16207",
        };
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTherapistAttendance();

      const refreshInterval = setInterval(() => {
        setClockNow(Date.now());
        fetchTherapistAttendance();
      }, 30000);

      return () => clearInterval(refreshInterval);
    }, [userId]),
  );

  return (
    <View style={[styles.mainContainer, commonStyles.container]}>
      <View style={styles.headerRow}>
        <View style={styles.profileContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            // disabled={noAssignedChildren}
            // style={noAssignedChildren && styles.disabledAction}
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {userName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              { marginLeft: 12 },
              noAssignedChildren && styles.disabledAction,
            ]}
            // disabled={noAssignedChildren}
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
                  size={fontSize(20)}
                  color="#64748B"
                />
              </Animated.View>

              {notificationUnreadCount > 0 && <View style={styles.redDot} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconButton, { marginLeft: 8 }]} onPress={logout}>
            <MaterialIcons name="logout" size={fontSize(20)} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#004E9F"]}
            tintColor="#004E9F"
          />
        }
      >
        <View style={styles.welcomeSection}>
          <Text style={styles.greetingText}>
            {greeting}, {userName} 👋
          </Text>
          <Text style={styles.greetingSubtext}>
            You have {stats.todaySessions} sessions scheduled for today. Ready to make a difference?
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={noAssignedChildren}
          style={[
            styles.checkAttendanceCard,
            noAssignedChildren && styles.disabledAction,
          ]}
          onPress={() => {
            const appointment = therapistAttendance.dueAppointment;

            if (
              appointment?.appointmentId
              && appointment.therapistAttendance === "pending"
            ) {
              setShowTherapistAttendanceModal(true);
            } else {
              navigation.navigate("AttendanceTracking", {
                filterType: "today",
                attendanceType: "therapist",
              });
            }
          }}
        >
          <View style={styles.checkAttendanceIcon}>
            <Feather
              name="calendar"
              size={fontSize(21)}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.checkAttendanceInfo}>
            <Text style={styles.checkAttendanceTitle}>
              Check Attendance
            </Text>

            <Text style={styles.checkAttendanceSubtext}>
              {therapistAttendance.latestAttendance?.markedAt
                ? `Marked at ${
                  formatMarkedAt(
                    therapistAttendance.latestAttendance.markedAt,
                  )
                }`
                : "Not marked yet"}
            </Text>
          </View>

          {(() => {
            const status = therapistAttendance.latestAttendance?.therapistAttendance
              || "pending";

            const badge = attendanceColor(status);

            return (
              <View
                style={[
                  styles.attendanceStatusBadge,
                  { backgroundColor: badge.backgroundColor },
                ]}
              >
                <Text
                  style={[
                    styles.attendanceStatusText,
                    { color: badge.color },
                  ]}
                >
                  {attendanceLabel(status)}
                </Text>
              </View>
            );
          })()}
        </TouchableOpacity>

        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#D6E7FE" }]}
            onPress={() => navigation.navigate("AssignedChildren")}
          >
            <View style={styles.cardIconBox}>
              <Feather name="users" size={fontSize(16)} color="#1E3A8A" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.assignedChildren}</Text>
              <Feather name="chevron-right" size={fontSize(16)} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Assigned Children</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#8CF0D8" }]}
            onPress={() => navigation.navigate("AttendanceTracking", { filterType: "today" })}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconBox}>
              <Feather name="calendar" size={fontSize(16)} color="#065F46" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.todaySessions}</Text>
              <Feather name="chevron-right" size={fontSize(16)} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Today's Sessions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#F8DDBC" }]}
            onPress={() => navigation.navigate("FeedbackManagement")}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconBox}>
              <Feather name="star" size={fontSize(16)} color="#D97706" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.monthlyFeedback}</Text>
              <Feather name="chevron-right" size={fontSize(16)} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Monthly Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#A6FFD5" }]}
            onPress={() => navigation.navigate("AttendanceTracking")}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconBox}>
              <Feather name="bar-chart-2" size={fontSize(16)} color="#047857" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.overallAttendance}</Text>
              <Feather name="chevron-right" size={fontSize(16)} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Overall Attendance</Text>
          </TouchableOpacity>
        </View>

        {unreadData.hasUnread && (
          <TouchableOpacity
            style={styles.messageBanner}
            activeOpacity={0.9}
            disabled={disableMessages}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={styles.messageBannerHeader}>
              <View style={styles.messageBannerTitleRow}>
                <View style={styles.bannerIconBox}>
                  <Feather name="message-square" size={fontSize(16)} color="#7CB342" />
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

        <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>

        <View style={styles.actionsRow}>
          {
            /* <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("ProgramBuilder")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="plus" size={fontSize(24)} color="#1669A9" />
            </View>
            <Text style={styles.actionLabel}>Add Child Program</Text>
          </TouchableOpacity> */
          }

          <TouchableOpacity
            style={styles.actionItem}
            disabled={disableMessages}
            onPress={() => navigation.navigate("ChildMessages")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="message-square" size={fontSize(24)} color="#1669A9" />
            </View>
            <Text style={styles.actionLabel}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("WeeklyVideo")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#F3E8FF" }]}>
              <Feather name="video" size={fontSize(22)} color="#9333EA" />
            </View>
            <Text style={styles.actionLabel}>Upload Therapy Video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("QuarterlyReports")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E0E7FF" }]}>
              <MaterialIcons name="note-add" size={fontSize(22)} color="#4F46E5" />
            </View>
            <Text style={styles.actionLabel}>Create/ Upload Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            disabled={noAssignedChildren}
            onPress={() => navigation.navigate("LeaveRequest")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DCFCE7" }]}>
              <Feather name="home" size={fontSize(22)} color="#16A34A" />
            </View>
            <Text style={styles.actionLabel}>Request Leave</Text>
          </TouchableOpacity>

          {
            /* <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("ProgressTracking")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="map-pin" size={fontSize(22)} color="#1669A9" />
            </View>
            <Text style={styles.actionLabel}>Tracking</Text>
          </TouchableOpacity> */
          }
        </View>

        <TouchableOpacity
          style={styles.complaintCard}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate(
              "TherapistComplaints",
            )}
        >
          <View style={styles.complaintIconBox}>
            <Feather
              name="message-square"
              size={fontSize(22)}
              color="#EF4444"
            />
          </View>

          <View style={styles.complaintContent}>
            <Text style={styles.complaintTitle}>
              Add Complaints
            </Text>

            <Text style={styles.complaintSubtitle}>
              Submit or view your complaints
            </Text>
          </View>

          <Feather
            name="chevron-right"
            size={fontSize(21)}
            color="#CBD5E1"
          />
        </TouchableOpacity>

        <View style={styles.sessionBanner}>
          <Text style={styles.bannerTag}>NEXT SCHEDULED SESSION</Text>
          {stats.nextSession
            ? (
              <>
                <Text style={styles.bannerTitle}>
                  {stats.nextSession.childName} • {formatTo12Hour(stats.nextSession.startTime)}
                </Text>
                <Text style={styles.bannerDescription}>
                  Session Date: {formatSessionDate(stats.nextSession.date)}{" "}
                  ({formatTo12Hour(stats.nextSession.startTime)} - {formatTo12Hour(stats.nextSession.endTime)})
                </Text>
              </>
            )
            : <Text style={styles.bannerTitle}>No upcoming sessions scheduled</Text>}

          <TouchableOpacity
            style={styles.scheduleNextBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("AttendanceTracking")}
          >
            <Feather name="calendar" size={fontSize(16)} color="#004E9F" style={{ marginRight: 6 }} />
            <Text style={styles.scheduleNextBtnText}>View Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      <Modal
        visible={showTherapistAttendanceModal}
        transparent
        animationType="fade"
        onRequestClose={dismissTherapistAttendanceModal}
      >
        <View style={styles.therapistAttendanceOverlay}>
          <View style={styles.therapistAttendanceModal}>
            <TouchableOpacity
              style={styles.attendanceCloseButton}
              onPress={dismissTherapistAttendanceModal}
              disabled={attendanceSubmitting}
            >
              <Feather
                name="x"
                size={fontSize(22)}
                color="#8A9DBA"
              />
            </TouchableOpacity>

            <View style={styles.attendanceModalIcon}>
              <Feather
                name="calendar"
                size={fontSize(28)}
                color="#00A878"
              />
            </View>

            <Text style={styles.attendanceModalTitle}>
              Mark Your Attendance
            </Text>

            <Text style={styles.attendanceModalSubtitle}>
              Please mark your attendance to continue.
            </Text>

            {therapistAttendance.dueAppointment && (
              <Text style={styles.attendanceSessionTime}>
                Session: {formatTo12Hour(
                  therapistAttendance.dueAppointment.startTime,
                )}
                {" - "}
                {formatTo12Hour(
                  therapistAttendance.dueAppointment.endTime,
                )}
              </Text>
            )}

            <View style={styles.attendanceOptionsGrid}>
              {[
                {
                  label: "Present",
                  status: "present",
                  icon: "check",
                  background: "#F0FDF8",
                  border: "#C6F6DF",
                  color: "#059669",
                },
                {
                  label: "Absent",
                  status: "absent",
                  icon: "x",
                  background: "#FFF5F5",
                  border: "#FED7D7",
                  color: "#DC2626",
                },
                {
                  label: "Cancel",
                  status: "cancel",
                  icon: "slash",
                  background: "#FFF5F5",
                  border: "#FED7D7",
                  color: "#DC2626",
                },
                {
                  label: "Postpone",
                  status: "postponed",
                  icon: "clock",
                  background: "#F2F7FF",
                  border: "#D6E6FF",
                  color: "#3478F6",
                },
              ].map((option) => (
                <TouchableOpacity
                  key={option.status}
                  disabled={attendanceSubmitting}
                  style={[
                    styles.attendanceOption,
                    {
                      backgroundColor: option.background,
                      borderColor: option.border,
                    },
                  ]}
                  onPress={() => submitTherapistAttendance(option.status)}
                >
                  {attendanceSubmitting
                    ? (
                      <ActivityIndicator
                        size="small"
                        color={option.color}
                      />
                    )
                    : (
                      <>
                        <View
                          style={[
                            styles.attendanceOptionIcon,
                            { backgroundColor: option.color },
                          ]}
                        >
                          <Feather
                            name={option.icon}
                            size={fontSize(17)}
                            color="#FFFFFF"
                          />
                        </View>

                        <Text
                          style={[
                            styles.attendanceOptionText,
                            { color: option.color },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </>
                    )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingHorizontal: wp(20),
    paddingTop: hp(8),
    paddingBottom: hp(12),
    backgroundColor: "#fff",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(12),
  },
  avatar: {
    width: wp(38),
    height: hp(40),
    borderRadius: wp(19),
  },
  avatarFallback: {
    width: wp(38),
    height: hp(40),
    borderRadius: wp(999),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFallbackText: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  headerTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#0052A3",
    lineHeight: 24,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: wp(4),
  },
  notificationWrapper: {
    position: "relative",
  },
  redDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: wp(6),
    height: hp(6),
    borderRadius: wp(3),
    backgroundColor: "#DC2626",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(20),
    paddingTop: hp(10),
    paddingBottom: hp(30),
  },

  welcomeSection: {
    marginBottom: hp(20),
  },
  greetingText: {
    fontSize: fontSize(20),
    fontFamily: fonts.bold,
    color: "#181C1E",
    marginBottom: hp(6),
    lineHeight: 34,
  },
  greetingSubtext: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 22,
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    marginBottom: hp(28),
  },
  gridCard: {
    width: "48%",
    borderRadius: wp(24),
    padding: wp(20),
    justifyContent: "space-between",
  },
  cardIconBox: {
    width: wp(32),
    height: hp(32),
    borderRadius: wp(8),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(10),
  },
  cardValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardValue: {
    fontSize: fontSize(25),
    fontFamily: fonts.semiBold,
    color: "#1F2937",
    lineHeight: 36,
  },
  cardLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#6B7280",
    lineHeight: 16,
  },

  sectionHeaderTitle: {
    fontSize: fontSize(18),
    fontFamily: fonts.bold,
    color: "#1F2937",
    lineHeight: 28,
    marginBottom: hp(15),
  },
  actionsRow: {
    flexDirection: "row",
    gap: wp(15),
    flexWrap: "wrap",
    marginBottom: hp(16),
  },

  actionItem: {
    alignItems: "center",
    width: "21%",
  },
  actionIconBox: {
    width: wp(64),
    height: hp(64),
    borderRadius: wp(18),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(8),
  },
  actionLabel: {
    fontSize: fontSize(10),
    fontFamily: fonts.bold,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 15,
  },

  sessionBanner: {
    backgroundColor: "#004E9F",
    borderRadius: wp(32),
    padding: wp(24),
    paddingTop: hp(40),
  },
  bannerTag: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "rgba(256,256,256,.8)",
    letterSpacing: 1.4,
    lineHeight: 16,
  },
  bannerTitle: {
    fontSize: fontSize(20),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight: 32,
    marginVertical: 8,
  },
  bannerDescription: {
    fontSize: fontSize(16),
    fontFamily: fonts.regular,
    color: "#fff",
    lineHeight: 24,
    marginBottom: hp(20),
  },
  scheduleNextBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(999),
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop:hp(12),
  },
  scheduleNextBtnText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#004E9F",
    lineHeight: 20,
  },
  messageBanner: {
    backgroundColor: "#E1F3D8",
    borderRadius: wp(20),
    padding: wp(20),
    marginBottom: hp(20),
  },
  messageBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(12),
  },
  messageBannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(8),
  },
  bannerIconBox: {
    width: wp(32),
    height: hp(32),
    borderRadius: wp(14),
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
    paddingHorizontal: wp(8),
    paddingVertical: 4,
    borderRadius: wp(999),
  },
  badgeNewText: {
    fontSize: fontSize(12),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  messageCardContent: {
    backgroundColor: "rgba(255,255,255,.6)",
    borderRadius: wp(20),
    padding: wp(12),
    flexDirection: "row",
    alignItems: "center",
    gap: wp(12),
  },
  msgAvatarCircle: {
    width: wp(42),
    height: hp(42),
    borderRadius: wp(999),
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
    width: wp(42),
    height: hp(42),
    borderRadius: wp(21),
  },
  complaintCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(14),
    padding: wp(16),
    marginBottom: hp(28),
    shadowColor: "#000",
    shadowOffset: {
      width: wp(0),
      height: hp(4),
    },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginTop: 20,
  },

  complaintIconBox: {
    width: wp(56),
    height: hp(56),
    borderRadius: wp(12),
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },

  complaintContent: {
    flex: 1,
    marginLeft: 16,
  },

  complaintTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#191C20",
  },

  complaintSubtitle: {
    marginTop: 3,
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  checkAttendanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(18),
    padding: wp(14),
    flexDirection: "row",
    alignItems: "center",
    gap: wp(12),
    marginBottom: hp(20),
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },

  checkAttendanceIcon: {
    width: wp(44),
    height: wp(44),
    borderRadius: wp(13),
    backgroundColor: "#08B887",
    alignItems: "center",
    justifyContent: "center",
  },

  checkAttendanceInfo: {
    flex: 1,
    minWidth: 0,
  },

  checkAttendanceTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#172033",
  },

  checkAttendanceSubtext: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#8A9DBA",
    marginTop: 4,
  },

  attendanceStatusBadge: {
    paddingHorizontal: wp(12),
    paddingVertical: hp(7),
    borderRadius: wp(20),
  },

  attendanceStatusText: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
  },

  therapistAttendanceOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp(24),
  },

  therapistAttendanceModal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: wp(24),
    paddingHorizontal: wp(20),
    paddingTop: hp(24),
    paddingBottom: hp(22),
    alignItems: "center",
  },

  attendanceCloseButton: {
    position: "absolute",
    right: wp(16),
    top: hp(14),
    padding: wp(4),
    zIndex: 1,
  },

  attendanceModalIcon: {
    width: wp(64),
    height: wp(64),
    borderRadius: wp(18),
    backgroundColor: "#E9FBF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(14),
  },

  attendanceModalTitle: {
    fontSize: fontSize(18),
    fontFamily: fonts.bold,
    color: "#172033",
    textAlign: "center",
  },

  attendanceModalSubtitle: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    textAlign: "center",
    marginTop: hp(8),
  },

  attendanceSessionTime: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#475569",
    marginTop: hp(12),
    marginBottom: hp(14),
  },

  attendanceOptionsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: wp(10),
    marginTop: hp(18),
  },

  attendanceOption: {
    width: "48%",
    minHeight: hp(52),
    borderWidth: 1,
    borderRadius: wp(15),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: wp(10),
    gap: wp(9),
  },

  attendanceOptionIcon: {
    width: wp(29),
    height: wp(29),
    borderRadius: wp(20),
    alignItems: "center",
    justifyContent: "center",
  },

  attendanceOptionText: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
  },
});
