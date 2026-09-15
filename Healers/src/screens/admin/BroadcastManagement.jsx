import React, { useState } from 'react';

import {
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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';

// Mock Lists for Selection
const MOCK_USERS = [
  { id: "1", name: "Sarah Mitchell (Parent)" },
  { id: "2", name: "David Chen (Parent)" },
  { id: "3", name: "Emily Watson (Parent)" },
  { id: "4", name: "John Doe (Parent)" },
];

const MOCK_THERAPISTS = [
  { id: "t1", name: "Dr. Sarah Chen (Speech)" },
  { id: "t2", name: "Marcus Thorne (Occupational)" },
  { id: "t3", name: "Elena Rodriguez (Behavior)" },
  { id: "t4", name: "James Wilson (Physical)" },
];

const RECIPIENT_GROUPS = [
  "All Users",
  "Specific Users",
  "All Therapists",
  "Specific Therapists",
];

export default function BroadcastManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("");

  const [recipientGroup, setRecipientGroup] = useState("All Users");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [deliverySchedule, setDeliverySchedule] = useState("Send Now");

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMultiSelectModalOpen, setIsMultiSelectModalOpen] = useState(false);

  const toggleRecipientSelection = (item) => {
    if (selectedRecipients.some((r) => r.id === item.id)) {
      setSelectedRecipients(selectedRecipients.filter((r) => r.id !== item.id));
    } else {
      setSelectedRecipients([...selectedRecipients, item]);
    }
  };

  const isSpecificMode = recipientGroup === "Specific Users" || recipientGroup === "Specific Therapists";
  const currentList = recipientGroup === "Specific Users" ? MOCK_USERS : MOCK_THERAPISTS;

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
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>Broadcast Management</Text>
            <Text style={styles.pageSubTitle}>Send notifications to users.</Text>
          </View>
          <TouchableOpacity style={styles.historyBtn}>
            <MaterialCommunityIcons name="history" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Card 1: Recipient Group Selector */}
        <View style={styles.cardContainer}>
          <Text style={styles.fieldLabel}>RECIPIENT GROUP</Text>

          {/* Group Dropdown Trigger */}
          <TouchableOpacity
            style={styles.dropdownSelector}
            onPress={() => setIsGroupModalOpen(true)}
          >
            <Text style={styles.dropdownValueText}>{recipientGroup}</Text>
            <Feather name="chevron-down" size={20} color="#475569" />
          </TouchableOpacity>

          {/* Dynamic Multi-Select Field (Appears only when Specific is chosen) */}
          {isSpecificMode && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>
                SELECT {recipientGroup === "Specific Users" ? "USERS" : "THERAPISTS"}
              </Text>

              <TouchableOpacity
                style={styles.multiSelectTrigger}
                onPress={() => setIsMultiSelectModalOpen(true)}
              >
                <Text
                  style={[
                    styles.multiSelectPlaceholder,
                    selectedRecipients.length > 0 && { color: "#0F172A" },
                  ]}
                >
                  {selectedRecipients.length > 0
                    ? `${selectedRecipients.length} Selected`
                    : `Tap to choose ${
                      recipientGroup === "Specific Users"
                        ? "users..."
                        : "therapists..."
                    }`}
                </Text>
                <Feather name="plus-circle" size={18} color="#0B4A6F" />
              </TouchableOpacity>

              {/* Selected Tags Display */}
              {selectedRecipients.length > 0 && (
                <View style={styles.selectedTagsContainer}>
                  {selectedRecipients.map((item) => (
                    <View key={item.id} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>{item.name}</Text>
                      <TouchableOpacity
                        onPress={() => toggleRecipientSelection(item)}
                      >
                        <Feather name="x" size={14} color="#0B4A6F" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>BROADCAST TITLE</Text>
            <Text style={styles.requiredAsterisk}>*</Text>
          </View>
          <TextInput
            style={styles.formInput}
            placeholder="e.g., Facility Update:"
            placeholderTextColor="#94A3B8"
            value={broadcastTitle}
            onChangeText={setBroadcastTitle}
          />

          {/* Message Content */}
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>MESSAGE CONTENT</Text>
            <Text style={styles.requiredAsterisk}>*</Text>
          </View>
          <TextInput
            style={styles.textAreaInput}
            placeholder="Type your notification message here..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={messageContent}
            onChangeText={setMessageContent}
          />

          {/* Attachment Box */}
          <Text style={styles.fieldLabel}>ATTACHMENT (OPTIONAL)</Text>
          <TouchableOpacity style={styles.uploadBox}>
            <View style={styles.uploadIconContainer}>
              <MaterialCommunityIcons
                name="file-upload-outline"
                size={30}
                color="#0B4A6F"
              />
            </View>
            <Text style={styles.uploadPrimaryText}>
              Click to upload or drag & drop
            </Text>
            <Text style={styles.uploadSecondaryText}>
              PDF, Image, or Doc (Max 10MB)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card 3: Delivery Schedule */}
        <View style={styles.cardContainer}>
          <Text style={styles.fieldLabel}>DELIVERY SCHEDULE</Text>
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                deliverySchedule === "Send Now" && styles.activeSegmentBtn,
              ]}
              onPress={() => setDeliverySchedule("Send Now")}
            >
              <Text
                style={[
                  styles.segmentText,
                  deliverySchedule === "Send Now" && styles.activeSegmentText,
                ]}
              >
                Send Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                deliverySchedule === "Schedule Later" && styles.activeSegmentBtn,
              ]}
              onPress={() => setDeliverySchedule("Schedule Later")}
            >
              <Text
                style={[
                  styles.segmentText,
                  deliverySchedule === "Schedule Later" && styles.activeSegmentText,
                ]}
              >
                Schedule Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Actions Row */}
        <View style={styles.bottomActionsRow}>
          <TouchableOpacity style={styles.saveDraftBtn}>
            <Text style={styles.saveDraftText}>Save Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sendBroadcastBtn}>
            <Feather
              name="send"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.sendBroadcastText}>Send Broadcast</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Recipient Group Selection Modal */}
      <Modal
        visible={isGroupModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGroupModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsGroupModalOpen(false)}
        >
          <View style={styles.modalContentCard}>
            <Text style={styles.modalTitle}>Select Recipient Group</Text>
            {RECIPIENT_GROUPS.map((group) => (
              <TouchableOpacity
                key={group}
                style={[
                  styles.modalOptionRow,
                  recipientGroup === group && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setRecipientGroup(group);
                  setSelectedRecipients([]); // Clear selection when group changes
                  setIsGroupModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    recipientGroup === group && styles.modalOptionTextSelected,
                  ]}
                >
                  {group}
                </Text>
                {recipientGroup === group && <Feather name="check" size={18} color="#0B4A6F" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Multi-Select Modal for Users/Therapists */}
      <Modal
        visible={isMultiSelectModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMultiSelectModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsMultiSelectModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {recipientGroup === "Specific Users" ? "Users" : "Therapists"}
              </Text>
              <TouchableOpacity onPress={() => setIsMultiSelectModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }}>
              {currentList.map((item) => {
                const isSelected = selectedRecipients.some((r) => r.id === item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.checkboxRow}
                    onPress={() => toggleRecipientSelection(item)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxActive,
                      ]}
                    >
                      {isSelected && <Feather name="check" size={12} color="#FFF" />}
                    </View>
                    <Text style={styles.checkboxLabel}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => setIsMultiSelectModalOpen(false)}
            >
              <Text style={styles.confirmBtnText}>Done</Text>
            </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 32,
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 26,
  },
  pageSubTitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
  },

  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    letterSpacing: 0.5,
    marginBottom: 5,
    lineHeight: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  requiredAsterisk: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
    marginBottom: 8,
  },

  dropdownSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  dropdownValueText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0B4A6F",
  },
  multiSelectTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  multiSelectPlaceholder: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  selectedTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B4A6F",
  },

  formInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: colors.blackFont,
    marginBottom: 16,
    fontFamily: fonts.regular,
  },
  textAreaInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    height: 120,
    fontSize: 16,
    color: colors.blackFont,

    marginBottom: 16,
    fontFamily: fonts.regular,
  },

  uploadBox: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: "#F1F4F7",
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIconContainer: {
    marginBottom: 6,
  },
  uploadPrimaryText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
    marginBottom: 2,
  },
  uploadSecondaryText: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSegmentBtn: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#475569",
  },
  activeSegmentText: {
    color: "#F58B2A",
  },

  bottomActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  saveDraftBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveDraftText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight:24,
  },
  sendBroadcastBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBroadcastText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight:24,

  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContentCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  modalOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: "#F0F9FF",
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  modalOptionTextSelected: {
    color: "#0B4A6F",
    fontWeight: "700",
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    backgroundColor: "#0B4A6F",
    borderColor: "#0B4A6F",
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  confirmBtn: {
    backgroundColor: "#0B4A6F",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
