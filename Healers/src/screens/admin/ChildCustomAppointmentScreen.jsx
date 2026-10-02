import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import { createChildCustomAppointment, getChildCustomSlotOptions, getUsersByRole } from "../../api/admin/api";
import SessionSlotPicker from "./components/SessionSlotPicker";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";

const DURATIONS = [45, 60, 90, 120];

const prettyFull = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function ChildCustomAppointmentScreen({ navigation, route }) {
  const { childId, childName } = route.params;

  const [search, setSearch] = useState("");
  const [therapists, setTherapists] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [therapistId, setTherapistId] = useState(null);
  const [minutes, setMinutes] = useState(60);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);

  // therapists (debounced search)
  useEffect(() => {
    let alive = true;
    setLoadingList(true);
    const t = setTimeout(async () => {
      try {
        const res = await getUsersByRole({ role: "Therapist", search });
        if (alive) setTherapists(res?.data || []);
      } catch (e) {
        if (alive) setTherapists([]);
      } finally {
        if (alive) setLoadingList(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  // changing therapist -> the picker reloads because this function changes
  const loadSlots = useCallback(
    (date, m) => getChildCustomSlotOptions(childId, { therapistId, date, sessionMinutes: m }),
    [childId, therapistId],
  );

  const pickTherapist = (id) => {
    setTherapistId(id);
    setChoice(null);
  };
  const pickMinutes = (m) => {
    setMinutes(m);
    setChoice(null);
  };

  const submit = async () => {
    if (!therapistId || !choice || busy) return;
    setBusy(true);
    try {
      const res = await createChildCustomAppointment(childId, { therapistId, ...choice });
      if (!res?.success) return Alert.alert("Could not create", res?.message || "Please try again.");
      Alert.alert(
        "Appointment created",
        `${prettyFull(choice.date)}, ${formatTo12Hour(`${choice.startTime}-${choice.endTime}`)}`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert("Could not create", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const ready = !!therapistId && !!choice && !busy;

  return (
    <SafeAreaView style={styles.main}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Custom appointment</Text>
          {!!childName && <Text style={styles.headerSub}>{childName}</Text>}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          A one-to-one session. Only times inside the therapist's availability, when both the therapist
          and the child are free, can be picked.
        </Text>

        <Text style={styles.label}>Therapist</Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search therapist..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loadingList ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
        ) : therapists.length === 0 ? (
          <Text style={styles.muted}>No therapists found.</Text>
        ) : (
          therapists.map((t) => {
            const id = t._id || t.id;
            const on = therapistId === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.therapistRow, on && styles.therapistRowOn]}
                onPress={() => pickTherapist(id)}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                <Text style={styles.therapistName}>{t.fullName || t.name}</Text>
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.label}>Session length</Text>
        <View style={styles.row}>
          {DURATIONS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.durBtn, minutes === m && styles.durBtnOn]}
              onPress={() => pickMinutes(m)}
            >
              <Text style={[styles.durText, minutes === m && styles.durTextOn]}>{m} min</Text>
            </TouchableOpacity>
          ))}
        </View>

        {therapistId && (
          <SessionSlotPicker loadSlots={loadSlots} minutes={minutes} value={choice} onChange={setChoice} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, !ready && { opacity: 0.5 }]} disabled={!ready} onPress={submit}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create appointment</Text>}
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
  headerSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  content: { padding: 16, paddingBottom: 120 },

  hint: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", lineHeight: 18 },
  muted: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8", marginVertical: 8 },
  label: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: 8 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },

  therapistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  therapistRowOn: { borderColor: "#0B4A6F" },
  therapistName: { flex: 1, fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: "#0B4A6F" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B4A6F" },

  row: { flexDirection: "row", gap: 10 },
  durBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  durBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  durText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#334155" },
  durTextOn: { color: "#FFFFFF" },

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