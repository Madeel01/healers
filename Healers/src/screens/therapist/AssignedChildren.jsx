import React, { useState } from 'react';

import {
  Image,
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

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const CHILDREN_LIST = [
  { id: "1", name: "Ali Raza" },
  { id: "2", name: "Fatima Noor" },
  { id: "3", name: "Hassan Khan" },
  { id: "4", name: "Zainab Ali" },
];

export default function AssignedChildrenScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedChildId, setSelectedChildId] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        headerTitle={"Assigned Children"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by child name..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.casesHeader}>
          <Text style={styles.casesTitle}>Active Cases ({CHILDREN_LIST.length})</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipsGrid}>
          {CHILDREN_LIST.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childChip,
                  isSelected ? styles.chipSelected : styles.chipUnselected,
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedChildId(child.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                  ]}
                >
                  {child.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.childAvatarWrapper}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1543332164-6e82f355badc?w=400&auto=format&fit=crop&q=80",
              }}
              style={styles.childAvatar}
            />
          </View>
          <Text style={styles.childName}>Ali Raza Nawaz</Text>

          <View style={styles.badgesRow}>
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeText}>Age 8</Text>
            </View>
            <View style={styles.therapistBadge}>
              <Text style={styles.therapistBadgeText}>Therapist : Dr Sarah</Text>
            </View>
          </View>

          <View style={styles.sessionBox}>
            <View>
              <Text style={styles.sessionLabel}>Next Session</Text>
              <Text style={styles.sessionValue}>Today, 09:00 AM</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.sessionLabel}>Attendance</Text>
              <Text style={styles.attendanceValue}>90%</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Ionicons name="trophy-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionCardTitle}>Goals & Milestones</Text>
          </View>

          <View style={styles.goalItemCard}>
            <View style={styles.goalTitleRow}>
              <Text style={styles.goalTitle}>Speech Improvement</Text>
              <View style={[styles.progressBadge]}>
                <Text style={styles.progressBadgeText}>80%</Text>
              </View>
            </View>
            <Text style={styles.goalSubtext}>Expanding vocabulary to 50+ words</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: "80%", backgroundColor: "#8BF6D9" }]} />
            </View>
            <TouchableOpacity style={styles.addProgressBtn}>
              <Text style={styles.addProgressBtnText}>ADD PROGRESS</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.goalItemCard}>
            <View style={styles.goalTitleRow}>
              <Text style={styles.goalTitle}>Social Interaction</Text>
              <View style={[styles.progressBadge]}>
                <Text style={styles.progressBadgeText}>45%</Text>
              </View>
            </View>
            <Text style={styles.goalSubtext}>Participating in 3min turn-taking</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: "45%", backgroundColor: "#0284C7" }]} />
            </View>
            <TouchableOpacity style={styles.addProgressBtn}>
              <Text style={styles.addProgressBtnText}>ADD PROGRESS</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.goalItemCard}>
            <View style={styles.goalTitleRow}>
              <Text style={styles.goalTitle}>Social Interaction</Text>
              <View style={[styles.progressBadge]}>
                <Text style={styles.progressBadgeText}>45%</Text>
              </View>
            </View>
            <Text style={styles.goalSubtext}>Participating in 3min turn-taking</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: "45%", backgroundColor: "#0284C7" }]} />
            </View>
            <TouchableOpacity style={styles.addProgressBtn}>
              <Text style={styles.addProgressBtnText}>ADD PROGRESS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <TherapistBottomBar activeTab="AssignedChildren" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4FA",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#0F172A",
    height: 45,
  },

  casesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  casesTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#414753",
    lineHeight: 24,
  },
  viewAllText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#004E9F",
    lineHeight: 24,
  },

  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 20,
  },
  childChip: {
    width: "48%",
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: "#8BF6D9",
  },
  chipUnselected: {
    backgroundColor: "#F1F4FA",
    borderWidth: 1,
    borderColor: "#D7E3FF",
  },
  chipText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#004E9F",
  },

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 37,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  childAvatarWrapper: {
    backgroundColor: "#FFFFFF",
    width: 128,
    height: 128,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  childAvatar: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  childName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  ageBadge: {
    backgroundColor: "rgba(22,105,169,.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ageBadgeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#005086",
    lineHeight: 24,
  },
  therapistBadge: {
    backgroundColor: "rgba(255,183,129,.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  therapistBadgeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#7A3E00",
    lineHeight: 24,
  },
  sessionBox: {
    width: "100%",
    backgroundColor: "#F1F4FA",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 24,
    marginBottom: 2,
  },
  sessionValue: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C21",
    lineHeight: 24,
  },
  attendanceValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#004E9F",
    lineHeight: 24,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 24,
  },

  goalItemCard: {
    borderWidth: 1,
    borderColor: "#EBEEF1",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  goalTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#8BF6D9",
  },
  progressBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#00725E",
    lineHeight: 24,
  },
  goalSubtext: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#C1C7D2",
    lineHeight: 16,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#EBEEF1",
    borderRadius: 999,
    marginBottom: 12,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 999,
  },
  addProgressBtn: {
    backgroundColor: "#E5E8EB",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addProgressBtnText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#717781",
    lineHeight: 24,
  },

});
