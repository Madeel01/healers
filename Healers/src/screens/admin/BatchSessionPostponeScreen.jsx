// src/screens/admin/BatchSessionPostponeScreen.js
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { postponeBatchSession } from "../../api/admin/api";
import SessionSlotPicker from "./components/SessionSlotPicker";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";
import { therapistSpecialities } from "../../utils/specialities";
const specMeta = (id) =>
  therapistSpecialities.find((s) => s.id === id) || { label: id, bg: "#E0F2FE", color: "#0B4A6F" };
const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const prettyFull = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function BatchSessionPostponeScreen({ navigation, route }) {
  const { batchId, assignmentId, sessionId, date, startTime, endTime, therapistName, speciality, batchEnd, batchStart } =
    route.params;

  const minutes = mins(endTime) - mins(startTime);
  const meta = specMeta(speciality);

  const [createAlternate, setCreateAlternate] = useState(true);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (createAlternate && !choice) {
      return Alert.alert("Alternate session", "Pick a date and time, or switch to “Postpone only”.");
    }
    setBusy(true);
    try {
      const res = await postponeBatchSession(batchId, assignmentId, sessionId, {
        createAlternate,
        ...(createAlternate ? choice : {}),
      });
      if (!res?.success) return Alert.alert("Could not postpone", res?.message || "Please try again.");
      Alert.alert("Done", res.message || "Session postponed.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Could not postpone", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (createAlternate) return submit();
    Alert.alert(
      "Postpone without a new session?",
      "This session will be marked postponed and no replacement will be created.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Postpone", style: "destructive", onPress: submit },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.main}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Postpone session</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Current session</Text>
          <Text style={styles.big}>{prettyFull(date)}</Text>
          <Text style={styles.sub}>
            {formatTo12Hour(`${startTime}-${endTime}`)} · {minutes} min
          </Text>
          <View style={styles.rowBetween}>
            <Text style={styles.sub}>{therapistName}</Text>
            <View style={[styles.chip, { backgroundColor: meta.bg }]}>
              <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.segment}>
          {[
            { v: true, text: "Postpone + alternate" },
            { v: false, text: "Postpone only" },
          ].map((o) => (
            <TouchableOpacity
              key={String(o.v)}
              style={[styles.segBtn, createAlternate === o.v && styles.segBtnOn]}
              onPress={() => setCreateAlternate(o.v)}
            >
              <Text style={[styles.segText, createAlternate === o.v && styles.segTextOn]}>{o.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {createAlternate ? (
          <>
            <Text style={styles.hint}>
              The alternate session keeps the same {minutes} minutes and the same children. Only times when
              the therapist and every child are free are shown.
            </Text>
            <SessionSlotPicker
              batchId={batchId}
              assignmentId={assignmentId}
              minutes={minutes}
              endDate={batchEnd}
              value={choice}
              onChange={setChoice}
            />
          </>
        ) : (
          <Text style={styles.hint}>
            The session will be marked as postponed and no new session will be created. You can add an
            additional session later.
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={confirm}>
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryText}>{createAlternate ? "Postpone and create alternate" : "Postpone session"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: "#0F172A" },
  content: { padding: 16, paddingBottom: 120 },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14 },
  cardLabel: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  big: { fontSize: 18, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 4 },
  sub: { fontSize: 13, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontFamily: fonts.semiBold },

  segment: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segBtnOn: { backgroundColor: "#FFFFFF" },
  segText: { fontSize: 13, fontFamily: fonts.semiBold, color: "#64748B" },
  segTextOn: { color: "#0B4A6F" },
  hint: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", lineHeight: 18, marginTop: 12 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFFFFF" },
});