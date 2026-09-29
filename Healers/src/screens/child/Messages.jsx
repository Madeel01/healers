import React, { useState } from 'react';

import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import ChildBottomBar from '../../components/ChildBottomBar';
import TopBar from '../../components/TopBar';
import { fonts } from '../../styles/theme';

const CARE_TEAM_MEMBERS = [
  {
    id: "1",
    fullName: "Dr. Sarah Jenkins",
    initials: "SJ",
    isOnline: true,
    avatarBg: "#D1E9FF",
  },
  {
    id: "2",
    fullName: "David Chen",
    initials: "DC",
    isOnline: false,
    avatarBg: "#FFECD6",
  },
];

const MESSAGES_LIST = [
  {
    id: "conv_1",
    fullName: "Dr. Sarah Jenkins",
    designation: "Occupational Therapist",
    initials: "SJ",
    avatarBg: "#D1E9FF",
    lastMessage: "Leo had a great session to",
    time: "10:30 AM",
    isUnread: true,
    isCareTeam: true,
  },
  {
    id: "conv_2",
    fullName: "David Chen",
    designation: "Speech Pathologist",
    initials: "DC",
    avatarBg: "#FFECD6",
    lastMessage: "Can we reschedule next ",
    time: "Yesterday",
    isUnread: false,
    isCareTeam: true,
  },
];

export default function MessagingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState("All");
  const unreadCount = MESSAGES_LIST.filter((m) => m.isUnread).length;

  const filteredMessages = MESSAGES_LIST.filter((item) => {
    if (selectedFilter === "Unread") return item.isUnread;
    if (selectedFilter === "CareTeam") return item.isCareTeam;
    return true;
  });

  const renderMessageCard = ({ item }) => (
    <TouchableOpacity
      style={styles.chatCard}
      activeOpacity={0.85}
      onPress={() => navigation?.navigate("ChatDetails", { conversationId: item.id })}
    >
      <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg }]}>
        <Text style={styles.avatarInitials}>{item.initials}</Text>
      </View>

      <View style={styles.chatCardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.userName}>{item.fullName}</Text>
          <View style={styles.timeContainer}>
            <Text style={[styles.timeText, item.isUnread && styles.timeTextUnread]}>
              {item.time}
            </Text>
            {item.isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>

        <Text style={styles.designationText}>{item.designation}</Text>
        <Text
          style={[styles.lastMessageText, item.isUnread && styles.lastMessageUnread]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        headerTitle="Messages"
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.careTeamContainer}>
          <Text style={styles.sectionTitle}>Care Team</Text>
          <View style={styles.careTeamRow}>
            {CARE_TEAM_MEMBERS.map((member) => (
              <TouchableOpacity key={member.id} style={styles.careTeamItem} activeOpacity={0.8}>
                <View style={styles.avatarWrapper}>
                  <View style={[styles.avatarCircleLarge, { backgroundColor: member.avatarBg }]}>
                    <Text style={styles.avatarInitialsLarge}>{member.initials}</Text>
                  </View>
                  {member.isOnline && <View style={styles.onlineBadge} />}
                </View>
                <Text style={styles.careTeamName} numberOfLines={1}>
                  {member.fullName}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.careTeamItem} activeOpacity={0.8}>
              <View style={styles.inviteCircle}>
                <Feather name="plus" size={24} color="#475569" />
              </View>
              <Text style={styles.careTeamName}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === "All" && styles.filterPillActive]}
            onPress={() => setSelectedFilter("All")}
          >
            <Text style={[styles.filterText, selectedFilter === "All" && styles.filterTextActive]}>
              All Messages
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === "Unread" && styles.filterPillActive]}
            onPress={() => setSelectedFilter("Unread")}
          >
            <Text style={[styles.filterText, selectedFilter === "Unread" && styles.filterTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === "CareTeam" && styles.filterPillActive]}
            onPress={() => setSelectedFilter("CareTeam")}
          >
            <Text style={[styles.filterText, selectedFilter === "CareTeam" && styles.filterTextActive]}>
              Care Team
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chat List */}
        <View style={styles.chatListContainer}>
          <FlatList
            data={filteredMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageCard}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      <ChildBottomBar activeTab="ChildMessages" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  careTeamContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: "#475569",
    marginBottom: 14,
  },
  careTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  careTeamItem: {
    alignItems: "center",
    width: 64,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 6,
  },
  avatarCircleLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsLarge: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#1E293B",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#059669",
    borderWidth: 2,
    borderColor: "#F8FAFC",
  },
  inviteCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  careTeamName: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: "#1E293B",
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  filterPillActive: {
    backgroundColor: "#005086",
  },
  filterText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: "#475569",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  chatListContainer: {
    paddingHorizontal: 20,
  },
  chatCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarInitials: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#1E293B",
  },
  chatCardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  timeTextUnread: {
    color: "#005086",
    fontFamily: fonts.bold,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#005086",
  },
  designationText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 4,
  },
  lastMessageText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  lastMessageUnread: {
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
});
