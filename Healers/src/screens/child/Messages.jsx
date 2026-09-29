import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAssignUser,
  getConversations,
} from '../../api/child/api';
import ChildBottomBar from '../../components/ChildBottomBar';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import { fonts } from '../../styles/theme';

export default function MessagingScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const userId = user?.id;

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [careTeamMembers, setCareTeamMembers] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const pageRef = useRef(page);
  const loadingMoreRef = useRef(loadingMore);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    loadInitialData();
    fetchMembers();

    const initialDataInterval = setInterval(() => {
      refreshCurrentList();
    }, 3000);

    const membersInterval = setInterval(fetchMembers, 30000);

    return () => {
      clearInterval(initialDataInterval);
      clearInterval(membersInterval);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      const limit = 5;
      const convsRes = await getConversations(1, limit);
      const data = convsRes?.data || [];

      setConversations(data);
      setPage(1);
      setHasMore(data.length === limit);
    } catch (error) {
      console.log("Error loading initial data:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const refreshCurrentList = async () => {
    if (loadingMoreRef.current) return;

    try {
      const totalLoadedLimit = pageRef.current * 5;
      const convsRes = await getConversations(1, totalLoadedLimit);
      if (convsRes?.data) {
        setConversations(convsRes.data);
      }
    } catch (error) {
      console.log("Error refreshing conversations:", error);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || initialLoading) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    const limit = 5;

    try {
      const convsRes = await getConversations(nextPage, limit);
      const newItems = convsRes?.data || [];

      if (newItems.length > 0) {
        setConversations((prev) => [...prev, ...newItems]);
        setPage(nextPage);
      }

      if (newItems.length < limit) {
        setHasMore(false);
      }
    } catch (error) {
      console.log("Error fetching next page:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const role = user?.role;
      const membersRes = await getAssignUser(userId, role);
      if (membersRes?.success) {
        setCareTeamMembers(membersRes.data || []);
      }
    } catch (error) {
      console.log("Error fetching members:", error);
    }
  };

  const unreadUsersCount = conversations.reduce(
    (acc, curr) => (curr.unreadCount > 0 ? acc + 1 : acc),
    0,
  );

  const filteredMessages = conversations.filter((item) => {
    if (selectedFilter === "Unread") return item.unreadCount > 0;
    if (selectedFilter === "CareTeam") return item.isCareTeam;
    return true;
  });

  const renderMessageCard = ({ item }) => {
    const partner = item.partner;
    const lastMsg = item.lastMessage?.text || "No messages yet";
    const initials = partner?.fullName
      ? partner.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
      : "U";

    return (
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.85}
        onPress={() =>
          navigation?.navigate("ChatDetails", {
            conversationId: item.conversationId,
            receiverId: partner?.id,
            partnerName: partner?.fullName,
            partnerImage: partner?.profileImage,
            isOnline: partner?.isOnline,
            lastSeen: partner?.lastActive,
            currentUserId: userId,
          })}
      >
        <View style={styles.avatarWrapper}>
          {partner?.profileImage
            ? <Image source={{ uri: partner.profileImage }} style={styles.avatarCircle} />
            : (
              <View style={[styles.avatarCircle, { backgroundColor: "#D1E9FF" }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

          {item.unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chatCardContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.userName}>{partner?.fullName}</Text>
            {item.lastMessage && (
              <Text style={[styles.timeText, item.unreadCount > 0 && styles.timeTextUnread]}>
                {new Date(item.lastMessage.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>

          <Text style={styles.designationText}>{partner?.role}</Text>
          <Text
            style={[styles.lastMessageText, item.unreadCount > 0 && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {lastMsg}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerWrapper}>
      <View style={styles.careTeamContainer}>
        <Text style={styles.sectionTitle}>Care Team</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.careTeamRow}>
          {careTeamMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={styles.careTeamItem}
              onPress={() =>
                navigation?.navigate("ChatDetails", {
                  receiverId: member.id,
                  partnerName: member.fullName,
                  partnerImage: member.profileImage,
                  isOnline: member.isOnline,
                  lastSeen: member.lastActive,
                  currentUserId: userId,
                })}
            >
              <View style={styles.avatarWrapper}>
                {member.profileImage
                  ? <Image source={{ uri: member.profileImage }} style={styles.avatarCircleLarge} />
                  : (
                    <View style={[styles.avatarCircleLarge, { backgroundColor: "#D1E9FF" }]}>
                      <Text style={styles.avatarInitialsLarge}>
                        {member.fullName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                {member.isOnline && <View style={styles.onlineBadge} />}
              </View>
              <Text style={styles.careTeamName} numberOfLines={1}>
                {member.fullName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterRow}>
        {["All", "Unread"].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterPill, selectedFilter === filter && styles.filterPillActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
              {filter === "All" ? "All Messages" : `Unread (${unreadUsersCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TopBar navigation={navigation} headerTitle="Messages" />

      <FlatList
        data={filteredMessages}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderMessageCard}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore
          ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#005086" />
            </View>
          )
          : null}
      />

      {user?.role === "Therapist" ? <TherapistBottomBar activeTab="" /> : <ChildBottomBar activeTab="ChildMessages" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerWrapper: {
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
  careTeamName: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.semiBold,
    color: "#1E293B",
    textAlign: "center",
    marginTop: 6,
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
  chatCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
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
  },
  avatarInitials: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#1E293B",
  },
  badgeContainer: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  chatCardContent: {
    flex: 1,
    marginLeft: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justify: "space-between",
    alignItems: "center",
  },
  userName: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  timeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginLeft: "auto",
  },
  timeTextUnread: {
    color: "#005086",
    fontFamily: fonts.bold,
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
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
