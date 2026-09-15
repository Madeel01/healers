import React, { useState } from 'react';

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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';

const feedbackItems = [
  {
    id: "1",
    name: "Sarah Mitchell",
    role: "Parent",
    status: "New",
    rating: 5,
    comment: "\"The progress my son has made with Dr. Aris in just three...",
    avatar: "https://i.pravatar.cc/150?img=32",
    primaryAction: "Reply",
    primaryIcon: "corner-up-left",
    actionType: "primary",
  },
  {
    id: "2",
    name: "James Wilson",
    role: "Therapist",
    status: "Responded",
    rating: 4,
    comment: "\"The new facility scheduling tool has reduced my...",
    avatar: "https://i.pravatar.cc/150?img=12",
    primaryAction: "View Reply",
    actionType: "outline",
  },
  {
    id: "3",
    name: "David Chen",
    role: "Parent",
    status: "New",
    rating: 2,
    comment: "\"We've had some trouble with the billing department. Multiple...",
    avatar: "https://i.pravatar.cc/150?img=68",
    primaryAction: "Escalate",
    primaryIcon: "alert-triangle",
    actionType: "primary",
    secondaryAction: "Reply",
    secondaryIcon: "corner-up-left",
  },
];

export default function FeedbackScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("All Feedback");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("");

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FontAwesome
          key={i}
          name={i <= rating ? "star" : "star-o"}
          size={14}
          color="#7A3E00"
          style={styles.starIcon}
        />,
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  return (
    <SafeAreaView style={[styles.mainContainer, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Manage Feedback"}
      />
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricLabel}>Pending Feedback</Text>
            <Text style={styles.metricValue}>12 Items</Text>
            <View style={styles.trendRow}>
              <Feather name="trending-down" size={14} color="#006B58" />
              <Text style={styles.trendText}>4 since yesterday</Text>
            </View>
          </View>
          <View style={[styles.metricIconBg, { backgroundColor: "rgba(22,105,169,.1)" }]}>
            <MaterialCommunityIcons name="clipboard-clock-outline" size={28} color={colors.primary} />
          </View>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTextContainer}>
            <Text style={styles.metricLabel}>Average Satisfaction</Text>
            <Text style={[styles.metricValue, styles.metricValue2]}>4.8 / 5.0</Text>
            {renderStars(4.5)}
          </View>
          <View style={[styles.metricIconBg, { backgroundColor: "rgba(255,220,196,.3)" }]}>
            <Feather name="smile" size={28} color="#7A3E00" />
          </View>
        </View>

        <View style={styles.tabsContainer}>
          {["All Feedback", "Pending", "New"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isActive && styles.activeTabButton]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {feedbackItems.map((item) => (
          <View key={item.id} style={styles.feedbackCard}>
            <View style={styles.cardHeader}>
              <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
              <View style={styles.cardHeaderDetails}>
                <View style={styles.nameBadgeRow}>
                  <Text style={styles.userName}>{item.name}</Text>

                  <View
                    style={[
                      styles.tagBadge,
                      item.role === "Parent"
                        ? styles.parentBadgeBg
                        : styles.therapistBadgeBg,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagBadgeText,
                        item.role === "Parent"
                          ? styles.parentBadgeText
                          : styles.therapistBadgeText,
                      ]}
                    >
                      {item.role}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.tagBadge,
                      item.status === "New"
                        ? styles.newBadgeBg
                        : styles.respondedBadgeBg,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagBadgeText,
                        item.status === "New"
                          ? styles.newBadgeText
                          : styles.respondedBadgeText,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                {renderStars(item.rating)}
              </View>
            </View>

            <Text style={styles.commentText}>{item.comment}</Text>

            <View style={styles.cardActionsRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  item.actionType === "primary"
                    ? styles.primaryBtn
                    : styles.outlineBtn,
                ]}
              >
                {item.primaryIcon && (
                  <Feather
                    name={item.primaryIcon}
                    size={16}
                    color={item.actionType === "primary" ? "#FFFFFF" : "#0B4A6F"}
                    style={styles.btnIcon}
                  />
                )}
                {/* <AntDesign name="exclamation"  /> */}

                <Text
                  style={[
                    styles.actionBtnText,
                    item.actionType === "primary"
                      ? styles.primaryBtnText
                      : styles.outlineBtnText,
                  ]}
                >
                  {item.primaryAction}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.secondaryGrayBtn]}>
                <Feather
                  name={item.secondaryIcon || "archive"}
                  size={16}
                  color="#475569"
                  style={styles.btnIcon}
                />
                <Text style={styles.secondaryGrayBtnText}>
                  {item.secondaryAction || "Archive"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <BottomBar
        activeTab={""}
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  metricCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
  },
  metricTextContainer: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },
  metricValue: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 36,
  },
  metricValue2: {
    color: "#7A3E00",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#006B58",
  },
  metricIconBg: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  starRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
  },
  starIcon: {
    marginRight: 2,
  },

  tabsContainer: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  activeTabButton: {
    backgroundColor: "#0B4A6F",
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 24,
  },
  activeTabText: {
    color: "#FFFFFF",
  },

  feedbackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  cardHeaderDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  parentBadgeBg: { backgroundColor: "#D1FAE5" },
  parentBadgeText: { color: "#059669" },
  therapistBadgeBg: { backgroundColor: "#FFEDD5" },
  therapistBadgeText: { color: "#C2410C" },
  newBadgeBg: { backgroundColor: "#E0F2FE" },
  newBadgeText: { color: "#0284C7" },
  respondedBadgeBg: { backgroundColor: "#E2E8F0" },
  respondedBadgeText: { color: "#64748B" },

  commentText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 22,
    marginBottom: 14,
  },

  cardActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnIcon: {
    marginRight: 6,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    color: "#FFFFFF",
  },
  outlineBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0B4A6F",
  },
  outlineBtnText: {
    color: colors.primary,
  },
  secondaryGrayBtn: {
    backgroundColor: "#F1F5F9",
  },
  secondaryGrayBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: colors.blackFont,
  },
});
