import React, {
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAssignUser,
  getConversations,
} from '../../api/child/api';
import BottomBar from '../../components/BottomBar';
import ChildBottomBar from '../../components/ChildBottomBar';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  commonStyles,
  fonts,
} from '../../styles/theme';

const CareTeamSkeleton = ({ skeletonPulse }) => (
  <View style={styles.careTeamRow}>
    {[1, 2, 3, 4, 5, 6].map((key) => (
      <View key={key} style={styles.careTeamItem}>
        <Animated.View style={[styles.skeletonCircle, { opacity: skeletonPulse }]} />
        <Animated.View style={[styles.skeletonTitle, { opacity: skeletonPulse }]} />
      </View>
    ))}
  </View>
);

const ListHeaderComponent = memo(({
  careTeamLoading,
  filteredCareTeam,
  searchQuery,
  setSearchQuery,
  selectedFilter,
  setSelectedFilter,
  unreadUsersCount,
  skeletonPulse,
  navigation,
  userId,
}) => {
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.careTeamContainer}>
        <Text style={styles.sectionTitle}>Care Team</Text>

        <View style={styles.searchBoxContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search care team members..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {careTeamLoading ? <CareTeamSkeleton skeletonPulse={skeletonPulse} /> : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.careTeamRow}
            keyboardShouldPersistTaps="handled"
          >
            {filteredCareTeam.length > 0
              ? (
                filteredCareTeam.map((member) => (
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
                        ? (
                          <Image
                            source={{ uri: member.profileImage }}
                            style={styles.avatarCircleLarge}
                          />
                        )
                        : (
                          <View style={[styles.avatarCircleLarge, { backgroundColor: "#D1E9FF" }]}>
                            <Text style={styles.avatarInitialsLarge}>
                              {member.fullName
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </Text>
                          </View>
                        )}
                      {member.isOnline && <View style={styles.onlineBadge} />}
                    </View>
                    <Text style={styles.careTeamName} numberOfLines={1}>
                      {member.fullName}
                    </Text>
                  </TouchableOpacity>
                ))
              )
              : <Text style={styles.noMembersText}>No members found</Text>}
          </ScrollView>
        )}
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
});

export default function MessagingScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const role = user?.role;

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [careTeamMembers, setCareTeamMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [careTeamLoading, setCareTeamLoading] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const skeletonPulse = useRef(new Animated.Value(0.3)).current;

  const pageRef = useRef(page);
  const loadingMoreRef = useRef(loadingMore);
  const careTeamMembersRef = useRef(careTeamMembers);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    careTeamMembersRef.current = careTeamMembers;
  }, [careTeamMembers]);

  useEffect(() => {
    if (careTeamLoading) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonPulse, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [careTeamLoading, skeletonPulse]);

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
    if (!userId || !role) {
      setCareTeamLoading(false);
      return;
    }

    try {
      const membersRes = await getAssignUser(userId, role);

      if (membersRes?.success) {
        const rawMembers = membersRes.data || [];
        let parsedMembers = [];

        if (role === "Admin") {
          const membersMap = new Map();

          rawMembers.forEach((item) => {
            if (item?.therapist?.id) {
              const therapist = item.therapist;
              membersMap.set(`therapist-${therapist.id}`, {
                id: therapist.id,
                fullName: therapist.fullName,
                profileImage: therapist.profileImage || "",
                isOnline: therapist.isOnline || false,
                lastActive: therapist.lastActive || null,
                role: therapist.role || "Therapist",
              });
            }

            if (Array.isArray(item?.assignedChildren)) {
              item.assignedChildren.forEach((child) => {
                if (!child?.id) return;
                membersMap.set(`child-${child.id}`, {
                  id: child.id,
                  fullName: child.fullName,
                  profileImage: child.profileImage || "",
                  isOnline: child.isOnline || false,
                  lastActive: child.lastActive || null,
                  role: child.role || "Child",
                });
              });
            }
          });

          parsedMembers = Array.from(membersMap.values());
        } else {
          parsedMembers = rawMembers;
        }

        const currentIds = careTeamMembersRef.current.map((m) => m.id).join(",");
        const newIds = parsedMembers.map((m) => m.id).join(",");

        if (currentIds !== newIds) {
          setCareTeamMembers(parsedMembers);
        }
      }
    } catch (error) {
      console.log("Error fetching members:", error);
    } finally {
      setCareTeamLoading(false);
    }
  };

  const filteredCareTeam = careTeamMembers.filter((member) =>
    member.fullName?.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

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

  return (
    <SafeAreaView style={[styles.container,commonStyles.container]}>
      <TopBar navigation={navigation} headerTitle="Messages" />

      <FlatList
        data={filteredMessages}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderMessageCard}
        ListHeaderComponent={
          <ListHeaderComponent
            careTeamLoading={careTeamLoading}
            filteredCareTeam={filteredCareTeam}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedFilter={selectedFilter}
            setSelectedFilter={setSelectedFilter}
            unreadUsersCount={unreadUsersCount}
            skeletonPulse={skeletonPulse}
            navigation={navigation}
            userId={userId}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListFooterComponent={loadingMore
          ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#005086" />
            </View>
          )
          : null}
      />

      {user?.role === "Therapist"
        ? <TherapistBottomBar activeTab="" />
        : user?.role === "Admin"
        ? <BottomBar activeTab="" />
        : <ChildBottomBar activeTab="ChildMessages" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrapper: {
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
    marginBottom: 10,
  },
  searchBoxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: fonts.bold,
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
  noMembersText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    paddingVertical: 12,
  },
  skeletonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e5ecf4",
  },
  skeletonTitle: {
    width: 44,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e5ecf4",
    marginTop: 8,
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
    justifyContent: "space-between",
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
