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

import { Feather } from '@expo/vector-icons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const DURATION_OPTIONS = ["30 min", "45 min", "60 min"];

const CATEGORY_OPTIONS = [
  "Behavioral Therapy",
  "Speech Therapy",
  "Occupational Therapy",
  "Physical Therapy",
  "Psychological Evaluation",
];

export default function AddNewPackageScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [packageName, setPackageName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [pricingModel, setPricingModel] = useState("perSession"); // 'perSession' | 'monthly'
  const [rate, setRate] = useState("");
  const [sessionDuration, setSessionDuration] = useState("45 min");
  const [isPublic, setIsPublic] = useState(false);

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setIsCategoryModalVisible(false);
  };

  return (
    <SafeAreaView style={[styles.container,commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        headerTitle={"Add New Package"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introDescription}>
          Configure a specialized therapy package for children. Define rates, session parameters, and inclusions to
          maintain clinical transparency.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Feather name="settings" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Core Configuration</Text>
          </View>

          <Text style={styles.inputLabel}>Package Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Behavioral Therapy Basic"
            placeholderTextColor="#94A3B8"
            value={packageName}
            onChangeText={setPackageName}
          />

          <Text style={styles.inputLabel}>Service Category</Text>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setIsCategoryModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.dropdownPlaceholder,
                selectedCategory ? styles.selectedDropdownText : null,
              ]}
            >
              {selectedCategory || "Select Category"}
            </Text>
            <Feather name="chevron-down" size={20} color="#64748B" />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Pricing Model</Text>
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                pricingModel === "perSession" && styles.segmentBtnActive,
              ]}
              onPress={() => setPricingModel("perSession")}
            >
              <Text
                style={[
                  styles.segmentText,
                  pricingModel === "perSession" && styles.segmentTextActive,
                ]}
              >
                Per Session
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                pricingModel === "monthly" && styles.segmentBtnActive,
              ]}
              onPress={() => setPricingModel("monthly")}
            >
              <Text
                style={[
                  styles.segmentText,
                  pricingModel === "monthly" && styles.segmentTextActive,
                ]}
              >
                Monthly Subscription
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Rate (PKR)</Text>
          <View style={styles.rateInputContainer}>
            <Text style={styles.currencyPrefix}>Rs.</Text>
            <TextInput
              style={styles.rateTextInput}
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={rate}
              onChangeText={setRate}
            />
          </View>

          <Text style={styles.inputLabel}>Session Duration</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((item) => {
              const isActive = sessionDuration === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.durationBtn,
                    isActive && styles.durationBtnActive,
                  ]}
                  onPress={() => setSessionDuration(item)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      isActive && styles.durationTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Feather name="eye" size={20} color="#334155" style={{ marginRight: 10 }} />
              <Text style={styles.switchTitle}>Make{"\n"}Public</Text>
            </View>

            <Switch
              trackColor={{ false: "#E2E8F0", true: "#0B4A6F" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E2E8F0"
              onValueChange={setIsPublic}
              value={isPublic}
            />

            <Text style={styles.switchHelpText}>
              Package will be visible to parents on their appportal.
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn}>
              <Feather name="save" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save Package</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isCategoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsCategoryModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Service Category</Text>
                {CATEGORY_OPTIONS.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.modalOption}
                    onPress={() => handleSelectCategory(category)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        selectedCategory === category && styles.modalOptionTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                    {selectedCategory === category && <Feather name="check" size={18} color="#0B4A6F" />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BottomBar
        activeTab={""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },

  introDescription: {
    fontSize: 16,
    color: colors.blackFont,
    lineHeight: 22,
    fontFamily: fonts.regular,
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  inputLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 8,
    fontFamily: fonts.regular,
    height: 50,
  },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    height: 50,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },
  selectedDropdownText: {
    color: "#0F172A",
  },

  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  segmentBtnActive: {
    backgroundColor: "#1669A9",
  },
  segmentText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: colors.blackFont,
    textAlign: "center",
  },
  segmentTextActive: {
    color: "#D3E6FF",
  },

  rateInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  currencyPrefix: {
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    marginRight: 8,
  },
  rateTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
    fontFamily: fonts.regular,
  },

  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  durationBtn: {
    flex: 1,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  durationBtnActive: {
    backgroundColor: "#1669A9",
    borderColor: "#1669A9",
  },
  durationText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#181C1E",
  },
  durationTextActive: {
    color: "#FFFFFF",
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  switchLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 22,
  },
  switchHelpText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 16,
    marginLeft: 12,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.blackFont,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 16,
   fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight:24,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#FFFFFF",
    lineHeight:24,

  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#334155",
  },
  modalOptionTextSelected: {
    fontFamily: fonts.semiBold,
    color: "#0B4A6F",
  },
});
