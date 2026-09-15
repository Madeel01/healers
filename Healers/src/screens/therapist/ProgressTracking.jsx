import React, { useState } from 'react';

import {
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Slider from '@react-native-community/slider';

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const PROGRAM_TABS = ['A4', 'A3', 'A5'];

const CHILDREN_DATA = [
  { id: '1', name: 'Ali Raza', parents: 'Nawaz' },
  { id: '2', name: 'Fatima Noor', parents: 'Tariq' },
  { id: '3', name: 'Zainab Ahmed', parents: 'Usman' },
  { id: '4', name: 'Bilal Khan', parents: 'Rashid' },
  { id: '5', name: 'Ayesha Khan', parents: 'Zubair' },
];

export default function ProgressTrackingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [selectedChild, setSelectedChild] = useState(CHILDREN_DATA[0]);
  const [searchQuery, setSearchQuery] = useState(CHILDREN_DATA[0].name);
  const [selectedProgramTab, setSelectedProgramTab] = useState('A4');
  const [proficiencyScore, setProficiencyScore] = useState(65);

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const handleSaveProgress = () => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  const handleCancel = () => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    setSearchQuery(child.name);
    setIsFilterModalVisible(false);
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
        { paddingTop: insets.top },
      ]}
    >
      <TopBar navigation={navigation} headerTitle="progress Tracking" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>progress Tracking</Text>
          <Text style={styles.bannerSubtitle}>Managing progress</Text>
        </View>

        <View style={styles.searchSectionWrapper}>
          <View style={styles.searchCard}>
            <View style={styles.searchContainer}>
              <Feather name="search" size={20} color="#64748B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search child..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            <TouchableOpacity
              style={styles.filterButton}
              activeOpacity={0.8}
              onPress={() => setIsFilterModalVisible(true)}
            >
              <Feather name="filter" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.childCardWrapper}>
          <View style={styles.childCard}>
            <Text style={styles.childCardTitle}>child</Text>
            <View style={styles.childInfoRow}>
              <View style={styles.infoFieldContainer}>
                <Text style={styles.fieldLabel}>Name</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValue}>{selectedChild.name}</Text>
                </View>
              </View>

              <View style={styles.infoFieldContainer}>
                <Text style={styles.fieldLabel}>Parents</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValue}>{selectedChild.parents}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderWrapper}>
          <Text style={styles.sectionTitle}>All Program</Text>
        </View>

        <View style={styles.programCardWrapper}>
          <View style={styles.programCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.programTitle}>A4</Text>
                <Text style={styles.programSubtitle}>
                  describe behavior, engagement,
                </Text>
              </View>
              <View style={styles.percentageBadge}>
                <Text style={styles.badgeText}>80%</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '80%' }]} />
            </View>

            <TouchableOpacity
              style={styles.progressButton}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="#8BF6D9" />
              <Text style={styles.progressButtonText}>Progress</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.addProgressContainer}>
          <Text style={styles.addProgressTitle}>Add Progress</Text>

          <View style={styles.tabsWrapper}>
            {PROGRAM_TABS.map((tab) => {
              const isSelected = selectedProgramTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabItem,
                    isSelected ? styles.tabItemActive : styles.tabItemInactive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedProgramTab(tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isSelected
                        ? styles.tabTextActive
                        : styles.tabTextInactive,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreHeaderRow}>
              <Text style={styles.scoreTitle}>Proficiency Score</Text>
              <Text style={styles.scoreValue}>
                {Math.round(proficiencyScore)}%
              </Text>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              value={proficiencyScore}
              onValueChange={setProficiencyScore}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor={colors.primary}
            />

            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderLabel}>BEGINNING</Text>
              <Text style={styles.sliderLabel}>FULL MASTERY</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={handleCancel}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              activeOpacity={0.85}
              onPress={handleSaveProgress}
            >
              <Text style={styles.saveBtnText}>Save Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.programCardWrapper}>
          <View style={styles.programCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.programTitle}>A3</Text>
                <Text style={styles.programSubtitle}>
                  describe behavior, engagement,
                </Text>
              </View>
              <View style={styles.percentageBadge}>
                <Text style={styles.badgeText}>80%</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '80%' }]} />
            </View>

            <TouchableOpacity
              style={styles.progressButton}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="#8BF6D9" />
              <Text style={styles.progressButtonText}>Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsFilterModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Child</Text>
                  <TouchableOpacity
                    onPress={() => setIsFilterModalVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={CHILDREN_DATA}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isSelected = selectedChild.id === item.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.childModalItem,
                          isSelected && styles.childModalItemActive,
                        ]}
                        onPress={() => handleSelectChild(item)}
                      >
                        <View>
                          <Text style={styles.childModalName}>{item.name}</Text>
                          <Text style={styles.childModalParent}>Parent: {item.parents}</Text>
                        </View>
                        {isSelected && (
                          <Feather name="check-circle" size={18} color="#0B598F" />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
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
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    lineHeight: 28,
  },
  bannerSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#fff',
    lineHeight: 28,
  },
  searchSectionWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#717781',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1669A9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  childCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C1C7D2',
    padding: 20,
  },
  childCardTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginBottom: 12,
    lineHeight:24
  },
  childInfoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoFieldContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#717781',
    marginBottom: 6,
    lineHeight:18

  },
  fieldBox: {
    backgroundColor: '#F1F4F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth:1,
    borderColor:'#C1C7D2'
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#181C1E',
    lineHeight:18
  },
  sectionHeaderWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: '#1D1B16',
    lineHeight: 24,
  },
  programCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  programCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#94A2B6',
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  programTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#1D1B16',
    lineHeight: 24,
  },
  programSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#6B7280',
    lineHeight: 24,
  },
  percentageBadge: {
    backgroundColor: '#8BF6D9',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#00725E',
    lineHeight: 20,
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#EBEEF1',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0B598F',
    borderRadius: 5,
  },
  progressButton: {
    backgroundColor: '#006B58',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
  },
  progressButtonText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#8BF6D9',
    lineHeight: 24,
  },
  addProgressContainer: {
    backgroundColor: '#8BF6D9',
    borderRadius: 13,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 20,
  },
  addProgressTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    marginBottom: 10,
    lineHeight: 20,
  },
  tabsWrapper: {
    backgroundColor: '#F1F4F7',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
  tabItemInactive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    lineHeight: 24,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: colors.blackFont,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#181C1E',
    lineHeight: 24,
  },
  scoreValue: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 24,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: '#717781',
    lineHeight: 24,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 24,
  },
  saveBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#1669A9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#0F172A',
  },
  childModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  childModalItemActive: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
  },
  childModalName: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#0F172A',
  },
  childModalParent: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#64748B',
    marginTop: 2,
  },
});