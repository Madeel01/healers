import {
  useContext,
  useEffect,
  useState,
} from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import { Overview } from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import Administration from './components/Administration';
import Fee from './components/Fee';

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const [stats, setStats] = useState({
    totalChild: 0,
    therapistCount: 0,
    totalUsers: 0,
    sessionCount: 0,
  });

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      const response = await Overview();
      const rawData = response?.data || response;
      setStats({
        totalChild: rawData?.totalChild || rawData?.childrenCount || 0,
        therapistCount: rawData?.therapistCount || rawData?.therapists || 0,
        totalUsers: rawData?.totalUsers || rawData?.usersCount || 0,
        sessionCount: rawData?.sessionCount || rawData?.sessions || 0,
      });
    } catch (error) {
      console.log("Failed to fetch dashboard overview:", error);
    }
  };

  const getCurrentFormattedDate = () => {
    const options = { weekday: "long", month: "short", day: "numeric" };
    return new Date().toLocaleDateString("en-US", options);
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.profileContainer}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: user?.avatarUrl || "https://i.pravatar.cc/150?img=32" }}
                style={styles.avatar}
              />
            </View>

            <View>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                {user?.fullName || user?.name || "Admin"}
              </Text>
              <Text style={styles.headerDate}>{getCurrentFormattedDate()}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialIcons name="settings" size={22} color="#475569" />
              <View style={styles.badgeDot} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, { marginLeft: 8 }]} onPress={logout}>
              <MaterialIcons name="logout" size={20} color="#DC2626" />
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
          <View style={[styles.statCard, { backgroundColor: "#0061A5" }]}>
            <View style={[styles.cardIconContainer, { backgroundColor: "#D1E4FF" }]}>
              <FontAwesome5 name="child" size={22} color={colors.primary} />
            </View>
            <Text style={styles.statLabelLight}>Total Child</Text>
            <Text style={styles.statValueLight}>
              {stats.totalChild.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#2892D9" }]}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="man" size={22} color="#49A7E6" />
            </View>
            <Text style={styles.statLabelLight}>Therapist</Text>
            <Text style={styles.statValueLight}>
              {stats.therapistCount.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#f39c12" }]}>
            <View style={[styles.cardIconContainer, { backgroundColor: colors.white }]}>
              <FontAwesome name="users" size={22} color="#F58B2A" />
            </View>
            <Text style={styles.statLabelLight}>Total Users</Text>
            <Text style={styles.statValueLight}>
              {stats.totalUsers.toLocaleString()}
            </Text>
          </View>

          <LinearGradient
            colors={["#F8B88B", "#FCEADE", "rgba(255, 255, 255, 0.4)"]}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statLabelDark}>
              Sessions : {String(stats.sessionCount)}
            </Text>
          </LinearGradient>
        </LinearGradient>

        <Fee customstyles={styles} />
        <Administration customstyles={styles} />

        <Text style={styles.sectionHeadTitle}>Quick Actions</Text>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate("ComplainManagement")}>
          <View style={[styles.quickIconBox, { backgroundColor: "#FEE2E2" }]}>
            <Feather name="message-square" size={22} color="#DC2626" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Manage Complaints</Text>
            <Text style={styles.quickActionSub}>View and respond to complaints</Text>
          </View>
          <AntDesign name="file-text" size={24} color="#717781" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate("FeeManagement")}>
          <View style={[styles.quickIconBox, { backgroundColor: "#DCFCE7" }]}>
            <MaterialIcons name="payments" size={22} color="#16A34A" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Fee Management</Text>
            <Text style={styles.quickActionSub}>Manage fees and payments</Text>
          </View>
          <AntDesign name="file-text" size={24} color="#717781" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} 
        onPress={() => navigation.navigate("InvoiceManagement")}>
          <View style={[styles.quickIconBox, { backgroundColor: "#DBEAFE" }]}>
            <MaterialIcons name="description" size={22} color="#2563EB" />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>Invoice Management</Text>
            <Text style={styles.quickActionSub}>Generate and manage invoices</Text>
          </View>
          <AntDesign name="file-text" size={24} color="#717781" />
        </TouchableOpacity>
      </ScrollView>

      <BottomBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#1669A9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    width: 180,
  },
  headerDate: {
    fontSize: 14,
    color: "#414750",
    fontFamily: fonts.regular,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTextContainer: {
    alignItems: "flex-start",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 24,
    marginTop: 10,
  },
  sectionHeadTitle: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 32,
    marginVertical: 10,
  },
  sectionSubtitle: {
    fontSize: 12,
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
    fontSize: 14,
    marginTop: 5,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  statValueLight: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.bold,
    lineHeight: 20,
    marginTop: 3,
  },
  statLabelDark: {
    color: "#181C1E",
    fontSize: 14,
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
  },
  quickActionTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 20,
  },
  quickActionSub: {
    fontSize: 14,
    color: "#414750",
    fontFamily: fonts.regular,
  },
});
