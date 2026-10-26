import React, {
  useEffect,
  useState,
} from 'react';

import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { createFeedback } from '../../api/therapist/api';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

const MOOD_OPTIONS = [
  { id: "Frustrated", label: "Frustrated", emoji: "😔" },
  { id: "Neutral", label: "Neutral", emoji: "😐" },
  { id: "Happy", label: "Happy", emoji: "😊" },
  { id: "Excited", label: "Excited", emoji: "🤩" },
];

export default function AddFeedbackScreen({ navigation, route }) {
  const { session, childId = "48291", childName = "Ali Raza", isViewOnly = false } = route?.params || {};

  const resolvedChildName = session?.childId?.name || session?.childName || session?.name || childName;
  const resolvedChildId = String(childId || session?.childId?._id || session?.childId || session?.id || "");
  const resolvedTherapyType = session?.category || session?.therapyType || "Behavior";

  const resolvedDate = session?.createdAt
    ? new Date(session.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : session?.date || "July 03, 2024";

  const formattedChildId = resolvedChildId.length > 5
    ? `${resolvedChildId.substring(0, 5)}...`
    : resolvedChildId;

  const feedbackData = session?.feedbackDetails || session || {};

  const [selectedMood, setSelectedMood] = useState(
    feedbackData?.mood || "Frustrated",
  );
  const [behaviorNote, setBehaviorNote] = useState(
    feedbackData?.notes || feedbackData?.behaviorNote || "",
  );

  const [isVisibleToParents, setIsVisibleToParents] = useState(
    feedbackData?.isVisibleToParent !== undefined ? feedbackData.isVisibleToParent : true,
  );

  useEffect(() => {
    const details = session?.feedbackDetails || session;
    if (details) {
      if (details.mood) setSelectedMood(details.mood);
      if (details.notes || details.behaviorNote) setBehaviorNote(details.notes || details.behaviorNote);
      if (details.isVisibleToParent !== undefined) setIsVisibleToParents(details.isVisibleToParent);
    }
  }, [session]);

  const handleSaveFeedback = async () => {
    try {
      const feedbackPayload = {
        childId: resolvedChildId,
        appointmentId: session?.id || session?._id,
        category: resolvedTherapyType,
        notes: behaviorNote,
        mood: selectedMood,
        isVisibleToParent: isVisibleToParents,
        rating: 5,
      };

      const res = await createFeedback(feedbackPayload);

      if (res?.success) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error creating feedback:", error?.response?.data || error.message);
    }
  };

  return (
    <View style={[styles.mainContainer, commonStyles.container]}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>
            {isViewOnly ? "Feedback Details" : "Add Feedback"}
          </Text>

          <Text style={styles.inputLabel}>Child Name</Text>
          <View style={styles.childInfoBox}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150" }}
              style={styles.avatarImage}
            />
            <Text style={styles.childNameText}>{resolvedChildName}</Text>

            <Text style={styles.childIdText} numberOfLines={1} ellipsizeMode="tail">
              ID: #{formattedChildId}
            </Text>
          </View>

          <View style={styles.rowTwoColumns}>
            <View style={styles.columnField}>
              <Text style={styles.inputLabel}>Date</Text>
              <View style={styles.readOnlyInputBox}>
                <Text style={styles.readOnlyInputText}>{resolvedDate}</Text>
              </View>
            </View>

            <View style={styles.columnField}>
              <Text style={styles.inputLabel}>Therapy Type</Text>
              <View style={styles.readOnlyInputBox}>
                <Text style={styles.readOnlyInputText}>{resolvedTherapyType}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Session Quality</Text>
          <Text style={styles.inputLabel}>Mood</Text>

          <View style={styles.moodSelectorContainer}>
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMood.toLowerCase() === mood.id.toLowerCase();
              return (
                <TouchableOpacity
                  key={mood.id}
                  disabled={isViewOnly}
                  style={[styles.moodItem, isSelected && styles.moodItemSelected]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedMood(mood.id)}
                >
                  <Text style={styles.emojiText}>{mood.emoji}</Text>
                  <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Behavior</Text>
          <TextInput
            style={styles.textAreaInput}
            multiline
            numberOfLines={4}
            editable={!isViewOnly}
            placeholder="Describe behavior, engagement, and skill execution..."
            placeholderTextColor="#A0AEC0"
            textAlignVertical="top"
            value={behaviorNote}
            onChangeText={setBehaviorNote}
          />
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.toggleLeftRow}>
            <View style={styles.toggleIconCircle}>
              <Ionicons name="people-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleTitle}>Visible to Parents</Text>
              <Text style={styles.toggleSubTitle}>Share this report with {resolvedChildName} Family</Text>
            </View>
          </View>

          <Switch
            disabled={isViewOnly}
            trackColor={{ false: "#CBD5E1", true: colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#CBD5E1"
            onValueChange={setIsVisibleToParents}
            value={isVisibleToParents}
          />
        </View>

        {!isViewOnly && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.saveBtn}
              activeOpacity={0.8}
              onPress={handleSaveFeedback}
            >
              <Text style={styles.saveBtnText}>Save Feedback</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
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
    paddingHorizontal: wp(20),
    paddingTop: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(12),
    padding: wp(18),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: hp(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.medium,
    color: colors.primary,
    marginBottom: hp(10),
    lineHeight: 24,
  },
  inputLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#717781",
    marginBottom: hp(3),
    lineHeight: 18,
  },
  childInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4F7",
    borderRadius: wp(8),
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    marginBottom: hp(14),
    borderWidth: 1,
    borderColor: "#C1C7D2",
  },
  avatarImage: {
    width: wp(32),
    height: hp(32),
    borderRadius: wp(999),
    marginRight: 12,
  },
  childNameText: {
    fontSize: fontSize(15),
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 22,
  },
  childIdText: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#717781",
    marginLeft: "auto",
    lineHeight: 18,
    maxWidth: wp(160),
  },
  rowTwoColumns: {
    flexDirection: "row",
    gap: 12,
  },
  columnField: {
    flex: 1,
  },
  readOnlyInputBox: {
    backgroundColor: "#F1F4F7",
    borderRadius: wp(8),
    height: hp(44),
    justifyContent: "center",
    paddingHorizontal: wp(12),
    borderWidth: 1,
    borderColor: "#C1C7D2",
  },
  readOnlyInputText: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
  },
  moodSelectorContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F4F7",
    borderRadius: wp(8),
    padding: wp(4),
    gap: 6,
  },
  moodItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: hp(10),
    borderRadius: wp(8),
  },
  moodItemSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emojiText: {
    fontSize: fontSize(20),
    marginBottom: hp(2),
  },
  moodLabel: {
    fontSize: fontSize(9),
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
  },
  moodLabelSelected: {
    color: "#181C1E",
  },
  textAreaInput: {
    backgroundColor: "#F1F4F7",
    borderRadius: wp(8),
    borderWidth: 1,
    borderColor: "#C1C7D2",
    padding: wp(12),
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#1E293B",
    minHeight: hp(80),
  },
  toggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(8),
    padding: wp(20),
    borderWidth: 1,
    borderColor: "#C1C7D2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(20),
  },
  toggleLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  toggleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: wp(999),
    backgroundColor: "rgba(0,80,134,.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 20,
  },
  toggleSubTitle: {
    fontSize: fontSize(8),
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: hp(12),
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#8BF6D9",
    paddingVertical: hp(9),
    borderRadius: wp(8),
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: fontSize(10),
    fontFamily: fonts.semiBold,
    color: "#00725E",
    lineHeight: 15,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: hp(9),
    borderRadius: wp(8),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: fontSize(10),
    fontFamily: fonts.semiBold,
    color: "#000000",
    lineHeight: 15,
  },
});
