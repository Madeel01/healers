import React, {
  useCallback,
  useContext,
  useState,
} from 'react';

import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';

import { getDashboardStatsApi } from '../../api/therapist/api';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import { AuthContext } from '../../context/AuthContext';
import {
  commonStyles,
  fonts,
} from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';

export default function TherapistDashboardScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);

  const userName = user?.fullName || user?.name || "";

  const [stats, setStats] = useState({
    assignedChildren: 0,
    todaySessions: 0,
    monthlyFeedback: "0/0",
    overallAttendance: "0%",
    nextSession: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      fetchDashboardStats();
    }, []),
  );

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
  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <View style={styles.headerRow}>
        <View style={styles.profileContainer}>
          <Image
            source={{
              uri: user?.avatarUrl
                || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
            }}
            style={styles.avatar}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {userName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconButton, { marginLeft: 12 }]}>
            <View style={styles.notificationWrapper}>
              <Feather name="bell" size={20} color="#64748B" />
              <View style={styles.redDot} />
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
          <Text style={styles.greetingText}>Good Morning, {userName} 👋</Text>
          <Text style={styles.greetingSubtext}>
            You have {stats.todaySessions} sessions scheduled for today. Ready to make a difference?
          </Text>
        </View>

        {/* Dashboard Grid Cards */}
        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#D6E7FE" }]}
            onPress={() => navigation.navigate("AssignedChildren")}
          >
            <View style={styles.cardIconBox}>
              <Feather name="users" size={16} color="#1E3A8A" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.assignedChildren}</Text>
              <Feather name="chevron-right" size={16} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Assigned Children</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#8CF0D8" }]}
            onPress={() => navigation.navigate("AttendanceTracking")}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconBox}>
              <Feather name="calendar" size={16} color="#065F46" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.todaySessions}</Text>
              <Feather name="chevron-right" size={16} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Today's Sessions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#F8DDBC" }]}
            onPress={() => navigation.navigate("FeedbackManagement")}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconBox}>
              <Feather name="star" size={16} color="#D97706" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.monthlyFeedback}</Text>
              <Feather name="chevron-right" size={16} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Monthly Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: "#A6FFD5" }]}
            onPress={() => navigation.navigate("AttendanceTracking")}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconBox}>
              <Feather name="bar-chart-2" size={16} color="#047857" />
            </View>
            <View style={styles.cardValueRow}>
              <Text style={styles.cardValue}>{stats.overallAttendance}</Text>
              <Feather name="chevron-right" size={16} color="#9CA3AF" />
            </View>
            <Text style={styles.cardLabel}>Overall Attendance</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("ProgramBuilder")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="plus" size={24} color="#1669A9" />
            </View>
            <Text style={styles.actionLabel}>Add Child Program</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("WeeklyVideo")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#F3E8FF" }]}>
              <Feather name="video" size={22} color="#9333EA" />
            </View>
            <Text style={styles.actionLabel}>Upload Therapy Video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("QuarterlyReports")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E0E7FF" }]}>
              <MaterialIcons name="note-add" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.actionLabel}>Create/ Upload Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("LeaveRequest")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DCFCE7" }]}>
              <Feather name="home" size={22} color="#16A34A" />
            </View>
            <Text style={styles.actionLabel}>Request Leave</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate("ProgressTracking")}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="map-pin" size={22} color="#1669A9" />
            </View>
            <Text style={styles.actionLabel}>Tracking</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Next Scheduled Session Banner */}
        <View style={styles.sessionBanner}>
          <Text style={styles.bannerTag}>NEXT SCHEDULED SESSION</Text>
          {stats.nextSession
            ? (
              <>
                <Text style={styles.bannerTitle}>
                  {stats.nextSession.childName} • {formatTo12Hour(stats.nextSession.startTime)}
                </Text>
                <Text style={styles.bannerDescription}>
                  Session Time: {formatTo12Hour(stats.nextSession.startTime)} -{" "}
                  {formatTo12Hour(stats.nextSession.endTime)}
                </Text>
              </>
            )
            : <Text style={styles.bannerTitle}>No upcoming sessions scheduled</Text>}

          <TouchableOpacity
            style={styles.scheduleNextBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("AttendanceTracking")}
          >
            <Feather name="calendar" size={16} color="#004E9F" style={{ marginRight: 6 }} />
            <Text style={styles.scheduleNextBtnText}>View Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TherapistBottomBar activeTab={"TherapistDashboard"} />
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },

  welcomeSection: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: "#181C1E",
    marginBottom: 6,
    lineHeight: 36,
  },
  greetingSubtext: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 22,
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    marginBottom: 28,
  },
  gridCard: {
    width: "48%",
    borderRadius: 24,
    padding: 20,
    justifyContent: "space-between",
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardValue: {
    fontSize: 30,
    fontFamily: fonts.bold,
    color: "#1F2937",
    lineHeight: 36,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#6B7280",
    lineHeight: 16,
  },

  sectionHeaderTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#1F2937",
    lineHeight: 28,
    marginBottom: 15,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 15,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  actionItem: {
    alignItems: "center",
    width: "21%",
  },
  actionIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 15,
  },

  sessionBanner: {
    backgroundColor: "#004E9F",
    borderRadius: 32,
    padding: 24,
    paddingTop: 40,
  },
  bannerTag: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "rgba(256,256,256,.8)",
    letterSpacing: 1.4,
    lineHeight: 20,
  },
  bannerTitle: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 32,
    marginVertical: 8,
  },
  bannerDescription: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#fff",
    lineHeight: 24,
    marginBottom: 20,
  },
  scheduleNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 12,
  },
  scheduleNextBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#004E9F",
    lineHeight: 20,
  },
});
