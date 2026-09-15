import React, { useState } from 'react';

import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';

const ALL_COMPLAINTS = [
  {
    id: "1",
    name: "David Thompson",
    role: "PARENT",
    child: "Child: Leo T.",
    badge: "! High Priority",
    badgeType: "highPriority",
    time: "12 mins ago",
    avatar: "https://i.pravatar.cc/150?img=11",
    roleIcon: "person",
    title: "Delayed feedback on speech therapy session",
    description: "Feedback for the session on Tuesday has not been uploaded yet. We need these reports for...",
  },
  {
    id: "2",
    name: "Maya Patel",
    role: "THERAPIST",
    child: null,
    badge: "Pending",
    badgeType: "pending",
    time: "1 hour ago",
    avatar: "https://i.pravatar.cc/150?img=32",
    roleIcon: "work",
    title: "Room availability for sensory group",
    description: "Room 304 was booked by two different...",
  },
  {
    id: "3",
    name: "Sarah Mitchell",
    role: "PARENT",
    child: "Child: Sam M.",
    badge: "Pending",
    badgeType: "pending",
    time: "3 hours ago",
    avatar: "https://i.pravatar.cc/150?img=44",
    roleIcon: "person",
    title: "Billing issue for monthly subscription",
    description: "Double charge appeared on the credit card statement...",
  },
];

export default function ComplainManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("");

  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRole, setSelectedRole] = useState("All");

  const filteredComplaints = ALL_COMPLAINTS.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
      || item.title.toLowerCase().includes(searchQuery.toLowerCase())
      || item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === "All"
      || (selectedStatus === "High Priority" && item.badgeType === "highPriority")
      || (selectedStatus === "Pending" && item.badgeType === "pending");

    const matchesRole = selectedRole === "All" || item.role === selectedRole;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const resetFilters = () => {
    setSelectedStatus("All");
    setSelectedRole("All");
  };

  return (
    <SafeAreaView style={[styles.mainContainer, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Back to dashboard"}
      />
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Complain Management</Text>

        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Total</Text>
          <Text style={styles.statsNumber}>{filteredComplaints.length}</Text>
          <View style={styles.statsPill}>
            <Text style={styles.statsPillText}>+12 this week</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search complaints..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.filterBtn,
              (selectedStatus !== "All" || selectedRole !== "All") && styles.filterBtnActive,
            ]}
            onPress={() => setIsFilterModalOpen(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={selectedStatus !== "All" || selectedRole !== "All" ? "#FFFFFF" : "#334155"}
            />
          </TouchableOpacity>
        </View>

        {filteredComplaints.length > 0
          ? (
            filteredComplaints.map((item) => (
              <View key={item.id} style={styles.complaintCard}>
                <View style={styles.userHeader}>
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
                    <View style={styles.roleIconBadge}>
                      <MaterialIcons name={item.roleIcon} size={11} color="#FFFFFF" />
                    </View>
                  </View>

                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <View style={styles.roleSubRow}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{item.role}</Text>
                      </View>
                      {item.child && <Text style={styles.childText}>• {item.child}</Text>}
                    </View>
                  </View>

                  <View style={styles.badgeTimeCol}>
                    <View
                      style={[
                        styles.statusBadge,
                        item.badgeType === "highPriority"
                          ? styles.highPriorityBg
                          : styles.pendingBg,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.badgeType === "highPriority"
                            ? styles.highPriorityText
                            : styles.pendingText,
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                </View>

                <Text style={styles.complaintTitle}>{item.title}</Text>
                <Text style={styles.complaintDescription}>{item.description}</Text>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.viewDetailsBtn}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Feather name="chevron-down" size={16} color="#475569" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.iconActionBtn}>
                    <Ionicons name="chatbox-outline" size={18} color="#0B4A6F" />
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.iconActionBtn, styles.greenIconBtn]}>
                    <Feather name="check-circle" size={18} color="#059669" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
          : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No complaints found matching your filters.</Text>
            </View>
          )}
      </ScrollView>

      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Complaints</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionLabel}>BY PRIORITY / STATUS</Text>
            <View style={styles.chipRow}>
              {["All", "High Priority", "Pending"].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.chipBtn,
                    selectedStatus === status && styles.chipBtnActive,
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedStatus === status && styles.chipTextActive,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>BY ROLE</Text>
            <View style={styles.chipRow}>
              {[
                { label: "All", value: "All" },
                { label: "Parent", value: "PARENT" },
                { label: "Therapist", value: "THERAPIST" },
              ].map((role) => (
                <TouchableOpacity
                  key={role.value}
                  style={[
                    styles.chipBtn,
                    selectedRole === role.value && styles.chipBtnActive,
                  ]}
                  onPress={() => setSelectedRole(role.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedRole === role.value && styles.chipTextActive,
                    ]}
                  >
                    {role.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => setIsFilterModalOpen(false)}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
    backgroundColor: "#F8FAFC",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },

  pageTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#181C1E",
    lineHeight: 40,
    marginBottom: 20,
  },

  statsCard: {
    width: 145,
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  statsLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#fff",
  },
  statsNumber: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  statsPill: {
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statsPillText: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#FFFFFF",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  filterBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "#004B82",
    borderColor: "#004B82",
  },

  complaintCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  roleIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#004B82",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    marginBottom: 2,
  },
  roleSubRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#475569",
  },
  childText: {
    fontSize: 12,
    color: "#64748B",
  },
  badgeTimeCol: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  highPriorityBg: {
    backgroundColor: "#FEE2E2",
  },
  highPriorityText: {
    color: "#93000A",
  },
  pendingBg: {
    backgroundColor: "#E2E8F0",
  },
  pendingText: {
    color: "#475569",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timeText: {
    fontSize: 11,
    color: "#94A3B8",
  },

  complaintTitle: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: colors.primary,
    marginBottom: 6,
    lineHeight: 22,
  },
  complaintDescription: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 18,
    marginBottom: 16,
  },

  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  viewDetailsBtn: {
    flex: 1,
    height: 40,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.blackFont,
    lineHeight: 20,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  greenIconBtn: {
    backgroundColor: "#D1FAE5",
  },

  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },

  /* Modal Styling */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalContentCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  chipBtnActive: {
    backgroundColor: "#004B82",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  resetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  applyBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#004B82",
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
