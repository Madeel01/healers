import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  getSettings,
  saveSettings,
} from '../../api/admin/api';
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_FORM = {
  clinicName: "",
  address: "",
  phone: "",
  email: "",
  timezone: "Asia/Karachi",
  clinicStartTime: "09:00",
  clinicEndTime: "17:00",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

const toMinutes = (time) => {
  if (!time) return 0;

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};
const formatDisplay = (time) => {
  if (!time) return "--:--";

  const [hours, minutes] = time.split(":").map(Number);

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

function TimeField({ label, value, onChange }) {
  const [show, setShow] = useState(false);

  const pickerDate = useMemo(() => {
    const date = new Date();

    const [hours, minutes] = (value || "09:00")
      .split(":")
      .map(Number);

    date.setHours(hours, minutes, 0, 0);

    return date;
  }, [value]);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShow(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    const hours = String(
      selectedDate.getHours(),
    ).padStart(2, "0");

    const minutes = String(
      selectedDate.getMinutes(),
    ).padStart(2, "0");

    const selectedTime = `${hours}:${minutes}`;

    onChange(selectedTime);
  };

  return (
    <View style={styles.timeField}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.timeButton}
        activeOpacity={0.8}
        onPress={() => setShow(true)}
      >
        <Feather
          name="clock"
          size={16}
          color={colors.primary}
        />

        <Text style={styles.timeButtonText}>
          {formatDisplay(value)}
        </Text>
      </TouchableOpacity>

      {show && (
        <>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour={false}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onValueChange={handleChange}
          />

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShow(false)}
            >
              <Text style={styles.doneButtonText}>
                Done
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await getSettings();

        if (!mounted) return;

        if (res?.success) {
          const data = res.data || {};

          setForm({
            clinicName: data.clinicName || "",
            address: data.address || "",
            phone: data.phone || "",
            email: data.email || "",
            timezone: data.timezone || "Asia/Karachi",
            clinicStartTime: data.clinicStartTime || "09:00",
            clinicEndTime: data.clinicEndTime || "17:00",
            workingDays: data.workingDays?.length
              ? data.workingDays
              : DEFAULT_FORM.workingDays,
          });
        }
      } catch (error) {
        if (!mounted) return;

        console.log("Failed to load settings:", error);

        Alert.alert(
          "Error",
          error.response?.data?.message
            || "Failed to load settings.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  const handleStartTimeChange = (time) => {
    setField("clinicStartTime", time);
  };

  const handleEndTimeChange = (time) => {
    setField("clinicEndTime", time);
  };

  const handleSave = async () => {
    if (saving) return;

    if (!form.clinicName.trim()) {
      Alert.alert(
        "Validation Error",
        "Clinic name is required.",
      );
      return;
    }

    if (
      form.email.trim()
      && !/^\S+@\S+\.\S+$/.test(form.email.trim())
    ) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid email address.",
      );
      return;
    }

    if (form.workingDays.length === 0) {
      Alert.alert(
        "Validation Error",
        "Select at least one working day.",
      );
      return;
    }

    if (
      toMinutes(form.clinicEndTime)
        <= toMinutes(form.clinicStartTime)
    ) {
      Alert.alert(
        "Validation Error",
        "Clinic end time must be after start time.",
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        clinicName: form.clinicName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        timezone: form.timezone.trim() || "Asia/Karachi",
        clinicStartTime: form.clinicStartTime,
        clinicEndTime: form.clinicEndTime,
        workingDays: form.workingDays,
      };

      const res = await saveSettings(payload);

      if (res?.success) {
        Alert.alert(
          "Success",
          "Settings saved successfully.",
        );
      }
    } catch (error) {
      console.log("Failed to save settings:", error);

      Alert.alert(
        "Error",
        error.response?.data?.message
          || "Failed to save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        commonStyles.container,
      ]}
    >
      {loading
        ? (
          <View style={styles.loader}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
          </View>
        )
        : (
          <View style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.pageTitle}>
                Settings
              </Text>

              <Text style={styles.pageDescription}>
                Clinic details and working hours used across the app.
              </Text>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Clinic Details
                </Text>

                <Text style={styles.fieldLabel}>
                  Clinic Name{" "}
                  <Text style={styles.required}>
                    *
                  </Text>
                </Text>

                <TextInput
                  style={styles.input}
                  value={form.clinicName}
                  onChangeText={(text) => setField("clinicName", text)}
                  placeholder="e.g. Hope Therapy Center"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.fieldLabel}>
                  Address
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.inputMultiline,
                  ]}
                  value={form.address}
                  onChangeText={(text) => setField("address", text)}
                  placeholder="Clinic address"
                  placeholderTextColor="#94A3B8"
                  multiline
                />

                <Text style={styles.fieldLabel}>
                  Phone
                </Text>

                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(text) => setField("phone", text)}
                  placeholder="03001234567"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>
                  Email
                </Text>

                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(text) => setField("email", text)}
                  placeholder="clinic@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Working Hours
                </Text>

                <View style={styles.timeRow}>
                  <TimeField
                    label="Start Time"
                    value={form.clinicStartTime}
                    onChange={handleStartTimeChange}
                  />

                  <TimeField
                    label="End Time"
                    value={form.clinicEndTime}
                    onChange={handleEndTimeChange}
                  />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Working Days
                </Text>

                <View style={styles.daysRow}>
                  {DAYS.map((day) => {
                    const isSelected = form.workingDays.includes(day);

                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayChip,
                          isSelected && styles.dayChipOn,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => toggleDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            isSelected
                            && styles.dayChipTextOn,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && { opacity: 0.6 },
              ]}
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                )
                : (
                  <Text style={styles.saveButtonText}>
                    Save Settings
                  </Text>
                )}
            </TouchableOpacity>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: hp(154),
  },

  pageTitle: {
    marginTop: 14,
    fontSize: fontSize(26),
    lineHeight: 34,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  pageDescription: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: fontSize(15),
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  sectionTitle: {
    fontSize: fontSize(17),
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    marginBottom: 4,
  },

  fieldLabel: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#475569",
    marginTop: 14,
    marginBottom: 6,
  },

  required: {
    color: "red",
  },

  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(48),
    fontSize: fontSize(14),
    color: "#0F172A",
  },

  inputMultiline: {
    height: hp(80),
    paddingTop: 12,
    textAlignVertical: "top",
  },

  timeRow: {
    flexDirection: "row",
    gap: 12,
  },

  timeField: {
    flex: 1,
  },

  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: hp(48),
    paddingHorizontal: 14,
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },

  timeButtonText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  doneButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  doneButtonText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },

  switchLabel: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#475569",
  },

  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  dayChip: {
    paddingHorizontal: wp(14),
    paddingVertical: hp(9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },

  dayChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  dayChipText: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#475569",
  },

  dayChipTextOn: {
    color: "#FFFFFF",
  },

  saveButton: {
    height: hp(50),
    borderRadius: wp(14),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    margin: 10,
  },

  saveButtonText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight:20
  },
});
