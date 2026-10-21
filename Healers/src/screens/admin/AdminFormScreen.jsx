import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { createAdmin, updateAdmin } from "../../api/admin/api";
import { colors, fonts } from "../../styles/theme";

const PASSWORD_RX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
const PHONE_RX = /^(03\d{9}|\+923\d{9})$/;

const ACTIVE_OPTIONS = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
];

export default function AdminFormScreen({ navigation, route }) {
  const editing = route?.params?.user || null;
  const isEdit = !!editing;

  const [form, setForm] = useState({
    fullName: editing?.fullName || "",
    email: editing?.email || "",
    phone: editing?.phone || "",
    address: editing?.address || "",
    isActive: editing ? editing.isActive !== false : true,
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const fail = (m) => {
    Alert.alert("Validation Error", m);
    return false;
  };

  const validate = () => {
    if (!form.fullName.trim()) return fail("Please enter the full name.");
    const email = form.email.trim();
    if (!email) return fail("Email is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Please enter a valid email address.");
    if (!PHONE_RX.test(form.phone.trim())) {
      return fail("Contact number must be in 03011234567 or +923011234567 format.");
    }
    if (!isEdit && (!password || !confirmPassword)) {
      return fail("Please enter password and confirm password.");
    }
    if (isEdit && (password || confirmPassword) && (!password || !confirmPassword)) {
      return fail("Please fill both password fields, or leave both blank.");
    }
    if (password && !PASSWORD_RX.test(password)) {
      return fail("Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.");
    }
    if (password && password !== confirmPassword) {
      return fail("Password and Confirm Password do not match.");
    }
    return true;
  };

  const handleSave = async () => {
    if (saving || !validate()) return;

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      isActive: form.isActive,
      ...(password && { password }),
    };

    try {
      setSaving(true);
      const res = isEdit
        ? await updateAdmin(editing._id, payload)
        : await createAdmin(payload);

      if (!res?.success) {
        Alert.alert("Error", res?.message || "Something went wrong.");
        return;
      }
      Alert.alert("Success", res.message || "Saved.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          `Could not ${isEdit ? "update" : "create"} this admin. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.main} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Edit Admin" : "Add New Admin"}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.labelFirst}>Full Name <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sara Ahmed"
              placeholderTextColor="#94A3B8"
              value={form.fullName}
              onChangeText={(t) => setField("fullName", t)}
            />

            <Text style={styles.label}>Email <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="admin@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(t) => setField("email", t)}
            />

            <Text style={styles.label}>Contact Number <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="0300 1234567"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(t) => setField("phone", t)}
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Address"
              placeholderTextColor="#94A3B8"
              value={form.address}
              onChangeText={(t) => setField("address", t)}
            />

            <Text style={styles.label}>
              {isEdit ? "New Password" : "Password"} {!isEdit && <Text style={styles.req}>*</Text>}
            </Text>
            {isEdit && <Text style={styles.helper}>Leave blank to keep the current password.</Text>}
            <View style={styles.passwordBox}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                placeholder={isEdit ? "Enter new password" : "Enter password"}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              {isEdit ? "Confirm New Password" : "Confirm Password"} {!isEdit && <Text style={styles.req}>*</Text>}
            </Text>
            <View style={styles.passwordBox}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
                <Feather name={showConfirm ? "eye" : "eye-off"} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Status</Text>
            <View style={styles.segmentWrap}>
              {ACTIVE_OPTIONS.map((opt) => {
                const on = form.isActive === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.segmentItem, on && styles.segmentItemOn]}
                    onPress={() => setField("isActive", opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>{isEdit ? "Save Changes" : "Create Admin"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary },
  content: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, elevation: 2 },
  req: { color: "red" },
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6, marginTop: 14 },
  labelFirst: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6 },
  helper: { fontSize: 12, color: "#64748B", marginBottom: 6 },
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
  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  passwordInput: { flex: 1, fontSize: 14, color: "#0F172A" },
  segmentWrap: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segmentItemOn: { backgroundColor: "#0B4A6F" },
  segmentText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#475569" },
  segmentTextOn: { color: "#FFFFFF" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0B4A6F",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontSize: 15, fontFamily: fonts.semiBold },
});