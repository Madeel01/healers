import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ionicons from '@expo/vector-icons/Ionicons';

import { createChildFeedback } from '../../api/child/api';
import ChildBottomBar from '../../components/ChildBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { getServices } from '../../api/admin/api';

const MOOD_OPTIONS = [
  {
    id: "Frustrated",
    label: "Frustrated",
    emoji: "😔",
  },
  {
    id: "Neutral",
    label: "Neutral",
    emoji: "😐",
  },
  {
    id: "Happy",
    label: "Happy",
    emoji: "😊",
  },
  {
    id: "Excited",
    label: "Excited",
    emoji: "🤩",
  },
];

export default function ChildAddFeedbackScreen({ navigation, route }) {
  const [services, setServices] = useState([])
  const { session } = route?.params || {};

  const specialtyId = session?.specialty;
  useEffect(() => {
    const servicesData = async () => {
      try {
        const res = await getServices({ search: "" });

        const activeServices = res.data.filter(
          (service) => service.isActive === true
        );

        setServices(activeServices);
      } catch (error) {
        console.log(error);
      }
    };

    servicesData();
  }, []);


  const selectedSpecialty = services.find(
    (item) => item.id === specialtyId,
  );
  const resolvedAppointmentId = session?.appointmentId || "";
  const resolvedChildId = session?.childId?._id || "";
  const resolvedTherapistId = session?.therapistId?._id || "";
  const resolvedTherapistName = session?.therapistId?.fullName || "";
  const resolvedCategory = selectedSpecialty?.label || specialtyId || "";
  const resolvedDate = session?.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : session?.date || "July 03, 2024";

  const [selectedMood, setSelectedMood] = useState("Happy");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const existingFeedback = session?.feedbackDetails
      || session?.feedback
      || {};

    if (existingFeedback.mood) {
      setSelectedMood(existingFeedback.mood);
    }

    if (
      existingFeedback.notes
      || existingFeedback.feedbackNote
    ) {
      setFeedbackNote(
        existingFeedback.notes
          || existingFeedback.feedbackNote
          || "",
      );
    }

    if (existingFeedback.rating) {
      setRating(Number(existingFeedback.rating));
    }
  }, [session]);

  const handleSaveFeedback = async () => {
    if (!resolvedAppointmentId) {
      Alert.alert(
        "Error",
        "Appointment information is missing.",
      );
      return;
    }

    if (!resolvedChildId) {
      Alert.alert(
        "Error",
        "Child information is missing.",
      );
      return;
    }

    if (!feedbackNote.trim()) {
      Alert.alert(
        "Feedback Required",
        "Please enter your feedback.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        childId: resolvedChildId,
        therapistId: resolvedTherapistId,
        appointmentId: resolvedAppointmentId,
        category: resolvedCategory,
        notes: feedbackNote.trim(),
        mood: selectedMood,
        rating,
        isVisibleToParent: true,
      };

      const response = await createChildFeedback(
        payload,
      );

      if (
        response?.success
        || response?.data?.success
      ) {
        Alert.alert(
          "Success",
          "Your feedback has been submitted.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
        return;
      }
      Alert.alert(
        "Error",
        response?.message
          || response?.data?.message
          || "Unable to submit feedback.",
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.message
          || error?.message
          || "Unable to submit feedback.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Give Feedback"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>
            Give Feedback
          </Text>

          <Text style={styles.inputLabel}>
            Therapist
          </Text>

          <View style={styles.therapistInfoBox}>
            {session?.therapistId?.profileImage
                || session?.therapist?.profileImage
              ? (
                <Image
                  source={{
                    uri: session?.therapistId?.profileImage
                      || session?.therapist?.profileImage,
                  }}
                  style={styles.avatarImage}
                />
              )
              : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(
                      session?.therapistId?.fullName
                      || session?.therapist?.fullName
                      || session?.therapistName
                      || "Therapist"
                    )
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
            <View style={styles.therapistTextContainer}>
              <Text
                style={styles.therapistNameText}
                numberOfLines={1}
              >
                {resolvedTherapistName}
              </Text>

              <Text
                style={styles.therapyTypeText}
                numberOfLines={1}
              >
                {resolvedCategory}
              </Text>
            </View>
          </View>

          <View style={styles.rowTwoColumns}>
            <View style={styles.columnField}>
              <Text style={styles.inputLabel}>
                Date
              </Text>

              <View style={styles.readOnlyInputBox}>
                <Text style={styles.readOnlyInputText}>
                  {resolvedDate || "N/A"}
                </Text>
              </View>
            </View>

            <View style={styles.columnField}>
              <Text style={styles.inputLabel}>
                Therapy Type
              </Text>

              <View style={styles.readOnlyInputBox}>
                <Text
                  style={styles.readOnlyInputText}
                  numberOfLines={1}
                >
                  {resolvedCategory}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>
            Session Quality
          </Text>

          <Text style={styles.inputLabel}>
            How was your session?
          </Text>

          <View style={styles.moodSelectorContainer}>
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMood.toLowerCase()
                === mood.id.toLowerCase();

              return (
                <TouchableOpacity
                  key={mood.id}
                  style={[
                    styles.moodItem,
                    isSelected
                    && styles.moodItemSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedMood(mood.id)}
                >
                  <Text style={styles.emojiText}>
                    {mood.emoji}
                  </Text>

                  <Text
                    style={[
                      styles.moodLabel,
                      isSelected
                      && styles.moodLabelSelected,
                    ]}
                  >
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>
            Your Feedback
          </Text>

          <Text style={styles.inputLabel}>
            Tell us about your session
          </Text>

          <TextInput
            style={styles.textAreaInput}
            multiline
            numberOfLines={5}
            placeholder="Share your experience, what you liked, or anything that could be improved..."
            placeholderTextColor="#A0AEC0"
            textAlignVertical="top"
            value={feedbackNote}
            onChangeText={setFeedbackNote}
          />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color={colors.primary}
            />
          </View>

          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>
              Your feedback matters
            </Text>

            <Text style={styles.infoSubTitle}>
              Your feedback helps your therapist understand your experience and improve future sessions.
            </Text>
          </View>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            activeOpacity={0.8}
            disabled={submitting}
            onPress={handleSaveFeedback}
          >
            {submitting
              ? (
                <ActivityIndicator
                  size="small"
                  color="#00725E"
                />
              )
              : (
                <Text style={styles.saveBtnText}>
                  Submit Feedback
                </Text>
              )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.8}
            disabled={submitting}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ChildBottomBar activeTab="ChildFeedback" />
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
    paddingTop: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginBottom: 10,
    lineHeight: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#717781",
    marginBottom: 5,
    lineHeight: 18,
  },
  therapistInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4F7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#C1C7D2",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 999,
    marginRight: 12,
  },
  therapistTextContainer: {
    flex: 1,
  },
  therapistNameText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 22,
  },
  therapyTypeText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#717781",
    marginTop: 2,
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
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#C1C7D2",
  },
  readOnlyInputText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
  },
  moodSelectorContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F4F7",
    borderRadius: 8,
    padding: 4,
    gap: 6,
  },
  moodItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  moodItemSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emojiText: {
    fontSize: 20,
    marginBottom: 2,
  },
  moodLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
  },
  moodLabelSelected: {
    color: "#181C1E",
    fontFamily: fonts.medium,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  starButton: {
    paddingHorizontal: 5,
  },
  ratingText: {
    textAlign: "center",
    marginTop: 5,
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#717781",
  },
  textAreaInput: {
    backgroundColor: "#F1F4F7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C1C7D2",
    padding: 12,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#1E293B",
    minHeight: 110,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C1C7D2",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(0,80,134,.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 20,
  },
  infoSubTitle: {
    fontSize: 9,
    fontFamily: fonts.regular,
    color: "#717781",
    lineHeight: 15,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#8BF6D9",
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  saveBtnText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: "#00725E",
    lineHeight: 15,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  cancelBtnText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: "#000000",
    lineHeight: 15,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarFallbackText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
});
