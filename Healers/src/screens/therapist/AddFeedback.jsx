import React, { useState } from 'react';

import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@expo/vector-icons/Ionicons';

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const MOOD_OPTIONS = [
  { id: "frustrated", label: "Frustrated", emoji: "😔" },
  { id: "neutral", label: "Neutral", emoji: "😐" },
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "excited", label: "Excited", emoji: "🤩" },
];

export default function AddFeedbackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const { childName = "Ali Raza", childId = "48291", date = "July 03, 2024", therapyType = "Behavior" } = route?.params
    || {};

  const [selectedMood, setSelectedMood] = useState("frustrated");
  const [behaviorNote, setBehaviorNote] = useState("");
  const [speechNote, setSpeechNote] = useState("");
  const [occupationalNote, setOccupationalNote] = useState("");
  const [isVisibleToParents, setIsVisibleToParents] = useState(true);

  const handleSaveFeedback = () => {
    const feedbackPayload = {
      childId,
      childName,
      date,
      therapyType,
      selectedMood,
      behaviorNote,
      speechNote,
      occupationalNote,
      isVisibleToParents,
    };
    console.log("Saving feedback payload:", feedbackPayload);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar navigation={navigation} headerTitle="Add Feedback " />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Add Feedback</Text>

          <Text style={styles.inputLabel}>Child Name</Text>
          <View style={styles.childInfoBox}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1543332164-6e82f355badc?w=150" }}
              style={styles.avatarImage}
            />
            <Text style={styles.childNameText}>{childName}</Text>
            <Text style={styles.childIdText}>ID: #{childId}</Text>
          </View>

          <View style={styles.rowTwoColumns}>
            <View style={styles.columnField}>
              <Text style={styles.inputLabel}>Date</Text>
              <View style={styles.readOnlyInputBox}>
                <Text style={styles.readOnlyInputText}>{date}</Text>
              </View>
            </View>

            <View style={styles.columnField}>
              <Text style={styles.inputLabel}>Therapy Type</Text>
              <View style={styles.readOnlyInputBox}>
                <Text style={styles.readOnlyInputText}>{therapyType}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Session Quality</Text>
          <Text style={styles.inputLabel}>Mood</Text>

          <View style={styles.moodSelectorContainer}>
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMood === mood.id;
              return (
                <TouchableOpacity
                  key={mood.id}
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
            placeholder="Describe behavior, engagement, and skill execution..."
            placeholderTextColor="#A0AEC0"
            textAlignVertical="top"
            value={behaviorNote}
            onChangeText={setBehaviorNote}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Speech & Language</Text>
          <TextInput
            style={styles.textAreaInput}
            multiline
            numberOfLines={4}
            placeholder="Describe behavior, engagement, and skill execution..."
            placeholderTextColor="#A0AEC0"
            textAlignVertical="top"
            value={speechNote}
            onChangeText={setSpeechNote}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Occupational Therapy</Text>
          <TextInput
            style={styles.textAreaInput}
            multiline
            numberOfLines={4}
            placeholder="Describe behavior, engagement, and skill execution..."
            placeholderTextColor="#A0AEC0"
            textAlignVertical="top"
            value={occupationalNote}
            onChangeText={setOccupationalNote}
          />
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.toggleLeftRow}>
            <View style={styles.toggleIconCircle}>
              <Ionicons name="people-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleTitle}>Visible to Parents</Text>
              <Text style={styles.toggleSubTitle}>Share this report with {childName} Family</Text>
            </View>
          </View>

          <Switch
            trackColor={{ false: "#CBD5E1", true: colors.primary}}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#CBD5E1"
            onValueChange={setIsVisibleToParents}
            value={isVisibleToParents}
          />
        </View>

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
      </ScrollView>

      <TherapistBottomBar activeTab="Feedback" />
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
    paddingBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
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
    marginBottom: 3,
    lineHeight: 18,
  },

  childInfoBox: {
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
    width: 32,
    height: 32,
    borderRadius: 999,
    marginRight: 12,
  },
  childNameText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: 24,
  },
  childIdText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#717781",
    marginLeft: "auto",
    lineHeight: 18,
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
    fontSize: 14,
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
    shadowOffset: { width: 0, height: 1 },
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
    minHeight: 80,
  },

  toggleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: "#C1C7D2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
    borderRadius: 999,
    backgroundColor: "rgba(0,80,134,.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  toggleTextContainer: {
    flex: 1,
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

  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#8BF6D9",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: "#000000",
    lineHeight: 15,
  },
});
