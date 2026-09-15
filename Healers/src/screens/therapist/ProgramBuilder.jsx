import React, { useState } from 'react';

import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const ALL_CHILDREN = [
  { id: "1", name: "Ali Raza" },
  { id: "2", name: "Fatima Noor" },
  { id: "3", name: "Hassan Khan" },
  { id: "4", name: "Zainab Ali" },
  { id: "5", name: "Bilal Ahmed" },
  { id: "6", name: "Ayesha Omer" },
];

const INITIAL_PROGRAMS = [
  {
    id: "p1",
    title: "A4",
    description: "describe behavior, engagement,",
    therapistTitle: "Therapist",
    therapistDescription: "describe behavior, engagement,",
    goals: [{ id: "g1", title: "Therapy" }],
  },
  {
    id: "p2",
    title: "A4",
    description: "describe behavior, engagement,",
    therapistTitle: "Therapist",
    therapistDescription: "describe behavior, engagement,",
    goals: [{ id: "g2", title: "Therapy" }],
  },
  {
    id: "p3",
    title: "A4",
    description: "describe behavior, engagement,",
    therapistTitle: "Therapist",
    therapistDescription: "describe behavior, engagement,",
    goals: [{ id: "g3", title: "Therapy" }],
  },
];

export default function ProgramBuilderScreen({ navigation }) {

  const [selectedChildId, setSelectedChildId] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  const visibleChildrenChips = ALL_CHILDREN.slice(0, 4);

  const filteredModalChildren = ALL_CHILDREN.filter((child) =>
    child.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const handleDeleteGoal = (programId, goalId) => {
    setPrograms((prev) =>
      prev.map((prog) => {
        if (prog.id !== programId) return prog;
        return {
          ...prog,
          goals: prog.goals.filter((g) => g.id !== goalId),
        };
      })
    );
  };

  const handleAddGoal = (programId) => {
    setPrograms((prev) =>
      prev.map((prog) => {
        if (prog.id !== programId) return prog;
        const newGoalId = `g_${Date.now()}`;
        return {
          ...prog,
          goals: [...prog.goals, { id: newGoalId, title: "Therapy" }],
        };
      })
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
        
      ]}
    >
      <TopBar navigation={navigation} headerTitle="Program Builder" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>Program Builder</Text>
          <Text style={styles.bannerSubtitle}>
            Managing Therapist Program add child program
          </Text>
        </View>

        <View style={styles.childHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Enter Child</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childChipsRow}
        >
          {visibleChildrenChips.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childChip,
                  isSelected
                    ? styles.childChipSelected
                    : styles.childChipUnselected,
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedChildId(child.id)}
              >
                <Text
                  style={[
                    styles.childChipText,
                    isSelected
                      ? styles.childChipTextSelected
                      : styles.childChipTextUnselected,
                  ]}
                >
                  {child.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchCard}>
          <View style={styles.searchInputContainer}>
            <Feather
              name="search"
              size={18}
              color="#94A3B8"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.allLabelsBtn} activeOpacity={0.8}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.allLabelsText}>All Labels</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addProgramBtn} activeOpacity={0.8}>
              <Text style={styles.addProgramText}>Add program</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.allProgramTitle}>All Program</Text>

        <View style={styles.programList}>
          {programs.map((program) => (
            <View key={program.id} style={styles.programCard}>
              <Text style={styles.cardTitle}>{program.title}</Text>
              <Text style={styles.cardDescription}>{program.description}</Text>

              <Text style={styles.cardTitle}>
                {program.therapistTitle}
              </Text>
              <Text style={styles.cardDescription}>
                {program.therapistDescription}
              </Text>

              {program.goals.map((goal) => (
                <View key={goal.id} style={styles.goalBox}>
                  <View style={styles.goalLeftRow}>
                    <View style={styles.radioCircle} />
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleDeleteGoal(program.id, goal.id)}
                  >
                    <Feather name="trash-2" size={18} color="#BA1A1A" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addGoalBtn}
                activeOpacity={0.8}
                onPress={() => handleAddGoal(program.id)}
              >
                <Feather name="plus-circle" size={18} color="#8BF6D9" />
                <Text style={styles.addGoalBtnText}>Add Another Goal</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Child</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Modal Search Bar */}
                <View style={styles.modalSearchContainer}>
                  <Feather
                    name="search"
                    size={16}
                    color="#94A3B8"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search child..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                {/* Children Selection List */}
                <ScrollView
                  style={{ maxHeight: 260 }}
                  showsVerticalScrollIndicator={true}
                >
                  {filteredModalChildren.map((child) => {
                    const isSelected = child.id === selectedChildId;
                    return (
                      <TouchableOpacity
                        key={child.id}
                        style={[
                          styles.modalOption,
                          isSelected && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedChildId(child.id);
                          setModalVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            isSelected && styles.modalOptionTextSelected,
                          ]}
                        >
                          {child.name}
                        </Text>
                        {isSelected && <Feather name="check" size={18} color="#0B598F" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
    paddingBottom: 20,
  },

  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.white,
    lineHeight: 24,
  },
  bannerSubtitle: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.white,
    lineHeight: 22,
  },

  childHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.blackFont,
    lineHeight: 24,
  },
  viewAllText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#004E9F",
    lineHeight: 24,
  },

  childChipsRow: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  childChip: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  childChipSelected: {
    backgroundColor: "#8BF6D9",
  },
  childChipUnselected: {
    backgroundColor: "#F1F4FA",
    borderWidth: 1,
    borderColor: "#D7E3FF",
  },
  childChipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 24,
    color:'#004E9F',
  },
  
  searchCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInputContainer: {
    backgroundColor: "#F7FAFD",
    borderRadius: 10,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  allLabelsBtn: {
    flex: 1,
    backgroundColor: "#F58B2A",
    height: 44,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  allLabelsText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  addProgramBtn: {
    flex: 1,
    backgroundColor: "#00725E",
    height: 44,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addProgramText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#8BF6D9",
    lineHeight: 20,
  },

  allProgramTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    lineHeight: 26,
    paddingHorizontal: 20,
    marginBottom: 18,
  },

  programList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  programCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#94A2B6",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    lineHeight: 24,
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 5,
  },


  goalBox: {
    backgroundColor: "rgba(139,246,217,.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  goalLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#717781",
  },
  goalTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#006B58",
    lineHeight: 18,
  },

  addGoalBtn: {
    backgroundColor: "#006B58",
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addGoalBtnText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: "#8BF6D9",
    lineHeight: 24,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 22,
  },
  modalSearchContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  modalOptionTextSelected: {
    fontFamily: fonts.bold,
    color: "#0B598F",
    lineHeight: 20,
  },
});
