import React, { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DateTimePicker from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";

import { getSettings, saveSettings } from "../../api/admin/api";
import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, commonStyles, fonts } from "../../styles/theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_FORM = {
  clinicName: "",
  address: "",
  phone: "",
  email: "",
  timezone: "Asia/Karachi",
  clinicStartTime: "09:00",
  clinicEndTime: "17:00",
  breakStartTime: "13:00",
  breakEndTime: "14:00",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const formatDisplay = (t) => {
  if (!t) return "--:--";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

function TimeField({ label, value, onChange }) {
  const [show, setShow] = useState(false);

  const pickerDate = useMemo(() => {
    const d = new Date();
    const [h, m] = (value || "09:00").split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }, [value]);

  const handleChange = (event, selected) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed" || !selected) return;

    const hh = String(selected.getHours()).padStart(2, "0");
    const mm = String(selected.getMinutes()).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  };

  return (
    <View style={styles.timeField}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.timeButton}
        activeOpacity={0.8}
        onPress={() => setShow(true)}
      >
        <Feather name="clock" size={16} color={colors.primary} />
        <Text style={styles.timeButtonText}>{formatDisplay(value)}</Text>
      </TouchableOpacity>

      {show && (
        <>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour={false}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChangeValue={handleChange}
          />
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.doneButton} onPress={() => setShow(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [hasBreak, setHasBreak] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSettings();
        if (res?.success) {
          const d = res.data || {};
          setForm({
            clinicName: d.clinicName || "",
            address: d.address || "",
            phone: d.phone || "",
            email: d.email || "",
            timezone: d.timezone || "Asia/Karachi",
            clinicStartTime: d.clinicStartTime || "09:00",
            clinicEndTime: d.clinicEndTime || "17:00",
            breakStartTime: d.breakStartTime || "",
            breakEndTime: d.breakEndTime || "",
            workingDays: d.workingDays?.length ? d.workingDays : DEFAULT_FORM.workingDays,
          });
          setHasBreak(Boolean(d.breakStartTime && d.breakEndTime));
        }
      } catch (error) {
        console.log("Failed to load settings:", error);
        Alert.alert("Error", error.response?.data?.message || "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const toggleBreak = (on) => {
    setHasBreak(on);
    if (on) {
      setForm((prev) => ({
        ...prev,
        breakStartTime: prev.breakStartTime || "13:00",
        breakEndTime: prev.breakEndTime || "14:00",
      }));
    }
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  const handleSave = async () => {
    if (saving) return;

    if (!form.clinicName.trim()) {
      Alert.alert("Validation Error", "Clinic name is required.");
      return;
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      Alert.alert("Validation Error", "Please enter a valid email address.");
      return;
    }
    if (form.workingDays.length === 0) {
      Alert.alert("Validation Error", "Select at least one working day.");
      return;
    }
    if (toMinutes(form.clinicEndTime) <= toMinutes(form.clinicStartTime)) {
      Alert.alert("Validation Error", "Clinic end time must be after start time.");
      return;
    }
    if (hasBreak) {
      const bs = toMinutes(form.breakStartTime);
      const be = toMinutes(form.breakEndTime);
      if (be <= bs) {
        Alert.alert("Validation Error", "Break end time must be after break start time.");
        return;
      }
      if (bs < toMinutes(form.clinicStartTime) || be > toMinutes(form.clinicEndTime)) {
        Alert.alert("Validation Error", "Break must fall within clinic working hours.");
        return;
      }
    }

    setSaving(true);

    try {
      const res = await saveSettings({
        clinicName: form.clinicName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        timezone: form.timezone.trim() || "Asia/Karachi",
        clinicStartTime: form.clinicStartTime,
        clinicEndTime: form.clinicEndTime,
        breakStartTime: hasBreak ? form.breakStartTime : "",
        breakEndTime: hasBreak ? form.breakEndTime : "",
        workingDays: form.workingDays,
      });

      if (res?.success) {
        Alert.alert("Success", "Settings saved successfully.");
      }
    } catch (error) {
      console.log("Failed to save settings:", error);
      Alert.alert("Error", error.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, commonStyles.container]}>
      <TopBar navigation={navigation} headerTitle="Back to Dashboard" />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageDescription}>
              Clinic details and working hours used across the app.
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Clinic Details</Text>

              <Text style={styles.fieldLabel}>
                Clinic Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={form.clinicName}
                onChangeText={(t) => setField("clinicName", t)}
                placeholder="e.g. Hope Therapy Center"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.address}
                onChangeText={(t) => setField("address", t)}
                placeholder="Clinic address"
                placeholderTextColor="#94A3B8"
                multiline
              />

              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(t) => setField("phone", t)}
                placeholder="03001234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(t) => setField("email", t)}
                placeholder="clinic@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Timezone</Text>
              <TextInput
                style={styles.input}
                value={form.timezone}
                onChangeText={(t) => setField("timezone", t)}
                placeholder="Asia/Karachi"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Working Hours</Text>

              <View style={styles.timeRow}>
                <TimeField
                  label="Start Time"
                  value={form.clinicStartTime}
                  onChange={(v) => setField("clinicStartTime", v)}
                />
                <TimeField
                  label="End Time"
                  value={form.clinicEndTime}
                  onChange={(v) => setField("clinicEndTime", v)}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Lunch / break time</Text>
                <Switch
                  value={hasBreak}
                  onValueChange={toggleBreak}
                  trackColor={{ true: colors.primary }}
                />
              </View>

              {hasBreak && (
                <View style={styles.timeRow}>
                  <TimeField
                    label="Break Start"
                    value={form.breakStartTime}
                    onChange={(v) => setField("breakStartTime", v)}
                  />
                  <TimeField
                    label="Break End"
                    value={form.breakEndTime}
                    onChange={(v) => setField("breakEndTime", v)}
                  />
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Working Days</Text>

              <View style={styles.daysRow}>
                {DAYS.map((day) => {
                  const on = form.workingDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, on && styles.dayChipOn]}
                      activeOpacity={0.8}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Settings</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <BottomBar activeTab="" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 30 },

  pageTitle: {
    marginTop: 14,
    fontSize: 26,
    lineHeight: 34,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },
  pageDescription: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 15,
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
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    marginBottom: 4,
  },

  fieldLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#475569",
    marginTop: 14,
    marginBottom: 6,
  },
  required: { color: "red" },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: "#0F172A",
  },
  inputMultiline: { height: 80, paddingTop: 12, textAlignVertical: "top" },

  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  timeButtonText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  doneButton: { alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 10 },
  doneButtonText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.primary },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  switchLabel: { fontSize: 14, fontFamily: fonts.semiBold, color: "#475569" },

  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  dayChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { fontSize: 13, fontFamily: fonts.semiBold, color: "#475569" },
  dayChipTextOn: { color: "#FFFFFF" },

  saveButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveButtonText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFFFFF" },
});