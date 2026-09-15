import React, { useState } from 'react';

import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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

const ALL_CHILDREN = [
  { id: "1", name: "Ali Raza" },
  { id: "2", name: "Fatima Noor" },
  { id: "3", name: "Hassan Khan" },
  { id: "4", name: "Zainab Ali" },
  { id: "5", name: "Bilal Ahmed" },
  { id: "6", name: "Ayesha Omer" },
];

const currentYear = new Date().getFullYear();
const YEARS_LIST = Array.from({ length: 4 }, (_, index) => {
  const yr = currentYear - index;
  return { id: String(yr), label: String(yr) };
});

export default function QuarterlyReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [selectedChild, setSelectedChild] = useState("1");
  const [selectedQuarter, setSelectedQuarter] = useState(String(currentYear));

  const [childModalVisible, setChildModalVisible] = useState(false);
  const [childSearch, setChildSearch] = useState("");

  const [behavior1, setBehavior1] = useState("");
  const [behavior2, setBehavior2] = useState("");
  const [behavior3, setBehavior3] = useState("");

  const [sentToParents, setSentToParents] = useState(true);

  const filteredChildren = ALL_CHILDREN.filter((child) => child.name.toLowerCase().includes(childSearch.toLowerCase()));

  const handleSubmit = () => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  const handleCancel = () => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
        { paddingTop: insets.top },
      ]}
    >
      <TopBar navigation={navigation} headerTitle="Quarterly Reports" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>Quarterly Reports Updates</Text>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.filterSectionTitle}>Enter Child</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setChildModalVisible(true)}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {ALL_CHILDREN.map((child) => {
              const isSelected = selectedChild === child.id;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipActive : styles.chipInactive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedChild(child.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected
                        ? styles.chipTextActive
                        : styles.chipTextInactive,
                    ]}
                  >
                    {child.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
            <Text style={styles.filterSectionTitle}>quarterly Date</Text>
          </View>

          <View style={styles.quarterGrid}>
            {YEARS_LIST.map((item) => {
              const isSelected = selectedQuarter === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.quarterChip,
                    isSelected
                      ? styles.quarterChipActive
                      : styles.quarterChipInactive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedQuarter(item.id)}
                >
                  <Text
                    style={[
                      styles.quarterChipText,
                      isSelected
                        ? styles.quarterChipTextActive
                        : styles.quarterChipTextInactive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.blueContainer}>
          <View style={styles.reportCard}>
            <Text style={styles.cardTitle}>Behavior</Text>
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Describe behavior, engagement, and skill execution..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={behavior1}
                onChangeText={setBehavior1}
              />
            </View>
          </View>

          <View style={styles.reportCard}>
            <Text style={styles.cardTitle}>Behavior</Text>
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Describe behavior, engagement, and skill execution..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={behavior2}
                onChangeText={setBehavior2}
              />
            </View>
          </View>

          <View style={styles.reportCard}>
            <Text style={styles.cardTitle}>Behavior</Text>
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Describe behavior, engagement, and skill execution..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={behavior3}
                onChangeText={setBehavior3}
              />
            </View>
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleLeft}>
              <View style={styles.toggleIconBg}>
                <Ionicons name="people" size={20} color="#0B598F" />
              </View>
              <View>
                <Text style={styles.toggleTitle}>Sent To Parents</Text>
                <Text style={styles.toggleSubTitle}>
                  Share this report with Ali Raza Family
                </Text>
              </View>
            </View>
            <Switch
              value={sentToParents}
              onValueChange={setSentToParents}
              trackColor={{ false: "#CBD5E1", true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#CBD5E1"
            />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.85}
              onPress={handleSubmit}
            >
              <Text style={styles.submitBtnText}>Submit reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={handleCancel}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={childModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChildModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setChildModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Child</Text>
                  <TouchableOpacity onPress={() => setChildModalVisible(false)}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

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
                    value={childSearch}
                    onChangeText={setChildSearch}
                  />
                </View>

                <ScrollView style={{ maxHeight: 260 }}>
                  {filteredChildren.map((child) => {
                    const isSelected = child.id === selectedChild;
                    return (
                      <TouchableOpacity
                        key={child.id}
                        style={[
                          styles.modalOption,
                          isSelected && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedChild(child.id);
                          setChildModalVisible(false);
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

      <TherapistBottomBar activeTab="Children" />
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
    backgroundColor: "#006B58",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 28,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterSectionTitle: {
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
  chipsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  chip: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: "#8BF6D9",
    borderColor: "#8BF6D9",
  },
  chipInactive: {
    backgroundColor: "#F1F4FA",
    borderColor: "#D7E3FF",
  },
  chipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 24,
    color: "#004E9F",
  },

  quarterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quarterChip: {
    width: "22%",
    paddingVertical: 8,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  quarterChipActive: {
    backgroundColor: "#035388",
    borderColor: "#035388",
  },
  quarterChipInactive: {
    backgroundColor: "#F1F4FA",
    borderColor: "#D7E3FF",
  },
  quarterChipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 24,
  },
  quarterChipTextActive: {
    color: "#FFFFFF",
  },
  quarterChipTextInactive: {
    color: "#004E9F",
  },
  blueContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    borderRadius: 7,
    gap: 16,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color:colors.primary,
    marginBottom: 6,
    lineHeight: 24,
  },
  textAreaWrapper: {
    minHeight: 88,
    backgroundColor: "#F1F4F7",
    borderWidth: 1,
    borderColor: "#C1C7D2",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textAreaInput: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#6B7280",
    padding: 0,
    lineHeight: 24,
  },
  toggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  toggleIconBg: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 20,
  },
  toggleSubTitle: {
    fontSize: 8,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  submitBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#8BF6D9",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#00725E",
    lineHeight: 15,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
  fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#000",
    lineHeight: 15,
  },
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
    padding: 18,
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
    paddingVertical: 12,
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
