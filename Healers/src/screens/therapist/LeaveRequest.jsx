import React, { useState } from 'react';

import {
  Modal,
  Platform,
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
import DateTimePicker from '@react-native-community/datetimepicker';

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Annual Leave",
  "Maternity / Paternity Leave",
  "Unpaid Leave",
  "Emergency Leave",
];

export default function LeaveRequestScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startDateSelected, setStartDateSelected] = useState(false);
  const [endDateSelected, setEndDateSelected] = useState(false);
  const [reason, setReason] = useState("");

  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("start");

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleOpenDatePicker = (mode) => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      if (pickerMode === "start") {
        setStartDate(selectedDate);
        setStartDateSelected(true);
      } else {
        setEndDate(selectedDate);
        setEndDateSelected(true);
      }
    }
  };

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
      <TopBar navigation={navigation} headerTitle="Leave Request" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>Leave Request</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Submit The Request</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Enter Type</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              activeOpacity={0.8}
              onPress={() => setTypeModalVisible(true)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !leaveType && styles.placeholderText,
                ]}
              >
                {leaveType || "Select Category"}
              </Text>
              <Feather name="chevron-down" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              activeOpacity={0.8}
              onPress={() => handleOpenDatePicker("start")}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !startDateSelected && styles.placeholderText,
                ]}
              >
                {startDateSelected ? formatDate(startDate) : "Enter Date"}
              </Text>
              <Feather name="calendar" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>End Date</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              activeOpacity={0.8}
              onPress={() => handleOpenDatePicker("end")}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !endDateSelected && styles.placeholderText,
                ]}
              >
                {endDateSelected ? formatDate(endDate) : "Enter Date"}
              </Text>
              <Feather name="calendar" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reason*</Text>
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textAreaInput}
                placeholder="Describe your reason..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={reason}
                onChangeText={setReason}
              />
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
              style={styles.submitBtn}
              activeOpacity={0.85}
              onPress={handleSubmit}
            >
              <Text style={styles.submitBtnText}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={pickerMode === "start" ? startDate : endDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}

      {showPicker && Platform.OS === "ios" && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.iosPickerOverlay}>
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.iosDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerMode === "start" ? startDate : endDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
              />
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={typeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTypeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Leave Type</Text>
                  <TouchableOpacity onPress={() => setTypeModalVisible(false)}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 280 }}>
                  {LEAVE_TYPES.map((type, index) => {
                    const isSelected = leaveType === type;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.modalOption,
                          isSelected && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setLeaveType(type);
                          setTypeModalVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            isSelected && styles.modalOptionTextSelected,
                          ]}
                        >
                          {type}
                        </Text>
                        {isSelected && <Feather name="check" size={18} color="#005B41" />}
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
    paddingVertical: 16,
    marginBottom: 24,
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 28,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    marginBottom: 24,
    lineHeight: 32,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    marginBottom: 8,
    lineHeight: 20,
  },
  dropdownInput: {
    height: 52,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
  },
  placeholderText: {
    color: "#94A3B8",
    lineHeight: 20,
  },
  textAreaWrapper: {
    minHeight: 120,
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textAreaInput: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    padding: 0,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 20,
  },
  submitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B598F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.white,
    lineHeight: 20,
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 22,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    color: "#005B41",
    lineHeight: 20,
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  iosPickerContainer: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 20,
  },
  iosPickerHeader: {
    padding: 16,
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iosDoneText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0B598F",
    lineHeight: 20,
  },
});
