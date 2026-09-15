import React, { useContext } from 'react';

import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import ChildBottomBar from '../../components/ChildBottomBar';
import { AuthContext } from '../../context/AuthContext';
import {
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function ChildDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useContext(AuthContext);
  const userName = user?.fullName || user?.name || "";

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
        { paddingTop: insets.top },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.profileContainer}>
          <Image
            source={{
              uri: user?.avatarUrl
                || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
            }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{userName}</Text>
            <TouchableOpacity style={styles.dropdownRow} activeOpacity={0.7}>
              <Text style={styles.userSubtext}>
                {user?.id ? (user.id.length > 10 ? `${user.id.slice(0, 10)}...` : user.id) : ""}
              </Text>
              <Feather name="chevron-down" size={16} color="#0F172A" />
            </TouchableOpacity>
          </View>
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
      >
        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: "#FDE6D2" }]}>
              <Feather name="star" size={24} color="#F97316" />
            </View>
            <Text style={styles.gridCardTitle}>Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: "#D1FAE5" }]}>
              <Feather name="message-square" size={24} color="#10B981" />
              <View style={styles.cardBadgeDot} />
            </View>
            <Text style={styles.gridCardTitle}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="mega-phone" size={24} color="#EF4444" />
            </View>
            <Text style={styles.gridCardTitle}>School Announcements</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <MaterialCommunityIcons name="receipt" size={24} color="#EF4444" />
            </View>
            <Text style={styles.gridCardTitle}>Billing & Invoices</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.messageBanner}>
          <View style={styles.messageBannerHeader}>
            <View style={styles.messageBannerTitleRow}>
              <View style={styles.bannerIconBox}>
                <Feather name="message-square" size={16} color="#65A30D" />
              </View>
              <Text style={styles.messageBannerTitle}>Messages</Text>
            </View>
            <View style={styles.badgeNew}>
              <Text style={styles.badgeNewText}>2 New</Text>
            </View>
          </View>

          <View style={styles.messageCardContent}>
            <View style={styles.msgAvatarCircle}>
              <Text style={styles.msgAvatarText}>Mr. S</Text>
            </View>
            <View style={styles.msgTextContainer}>
              <Text style={styles.teacherName}>Mr. Smith (Math)</Text>
              <Text style={styles.messageSnippet}>Alex did great on today's quiz!</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="play" size={20} color="#1D4ED8" />
              </View>
              <Text style={[styles.actionLabel, styles.actionLabelActive]}>Media</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: "#FFEDD5" }]}>
                <Feather name="calendar" size={20} color="#EA580C" />
              </View>
              <Text style={styles.actionLabel}>Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7}>
              <View style={[styles.actionIconCircle, { backgroundColor: "#FFEDD5" }]}>
                <Feather name="user" size={20} color="#EA580C" />
              </View>
              <Text style={styles.actionLabel}>Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.classesSection}>
          <View style={styles.classesHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Classes</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>1</Text>
            </View>
          </View>

          <View style={styles.classCard}>
            <View style={styles.classIconCircle}>
              <Feather name="bulb" size={22} color="#0284C7" />
            </View>
            <View style={styles.classInfoContainer}>
              <Text style={styles.className}>Sara</Text>
              <Text style={styles.classSubtitle}>PYP1 Green Emeralds</Text>
            </View>
          </View>
        </View>
      </ScrollView>

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

  userDetails: {
    justifyContent: "center",
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    letterSpacing: 0.2,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  userSubtext: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B598F",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
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
    borderRadius: 20,
    paddingVertical: 20,
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
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  cardBadgeDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "center",
    lineHeight: 18,
  },
  messageBanner: {
    backgroundColor: "#ECFCCB",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#365314",
  },
  badgeNew: {
    backgroundColor: "#84CC16",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeNewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  messageCardContent: {
    backgroundColor: "#F7FEE7",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  msgAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D9F99D",
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3F6212",
  },
  msgTextContainer: {
    flex: 1,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  messageSnippet: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 14,
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 32,
    paddingLeft: 8,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
  },
  actionLabelActive: {
    fontWeight: "700",
    color: "#1D4ED8",
  },
  classesSection: {
    marginBottom: 16,
  },
  classesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  counterBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
  },
  classIconCircle: {
    width: 48,
    height: 48,
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
    fontWeight: "700",
    color: "#1E293B",
  },
  classSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
});