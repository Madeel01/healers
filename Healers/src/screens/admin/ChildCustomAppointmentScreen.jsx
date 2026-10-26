import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";

import {
  getServices,
  getUsersByRole,
  previewChildCustomSchedule,
  saveChildCustomSchedule,
} from "../../api/admin/api";
import CustomSlotPicker from "./components/CustomSlotPicker";
import { colors, fonts } from "../../styles/theme";
import { formatTo12Hour } from "../../utils/hoursformat";

// must match SESSION_TIMES on the backend (45, 60, 90, 120)
const DURATIONS = [30,45, 60, 90, 120];

const label = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
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
  const insets = useSafeAreaInsets();

  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [search, setSearch] = useState("");
  const [therapists, setTherapists] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [therapistId, setTherapistId] = useState(null);
  const [minutes, setMinutes] = useState(60);
  const [services, setServices] = useState([]);

  const [plan, setPlan] = useState(null); // { mode, sessions }
  const [review, setReview] = useState(null); // { total, conflicts }
  const [showConflicts, setShowConflicts] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getServices({ search: "" })
      .then((res) => {
        if (alive) setServices((res?.data || []).filter((s) => s.isActive === true));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

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

  // any change in the selection invalidates the last review
  const handlePlan = useCallback((p) => {
    setPlan(p);
    setReview(null);
  }, []);

  const pickTherapist = (t) => {
    const id = t._id || t.id;
    if (id === therapistId) return;
    setSelectedTherapist(t);
    setTherapistId(id);
    setPlan(null);
    setReview(null);
  };
  const pickMinutes = (m) => {
    setMinutes(m);
    setPlan(null);
    setReview(null);
  };
  const changeTherapist = () => {
    setSelectedTherapist(null);
    setTherapistId(null);
    setPlan(null);
    setReview(null);
    setSearch("");
  };

  const sessions = plan?.sessions || [];
  const conflicts = review?.conflicts || [];

  const startReview = async () => {
    if (!therapistId || !sessions.length || busy) return;
    setBusy(true);
    try {
      const res = await previewChildCustomSchedule(childId, {
        therapistId,
        sessionMinutes: minutes,
        sessions,
      });
      if (!res?.success) return Alert.alert("Error", res?.message || "Could not check the schedule.");
      setReview(res.data);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.message || "Could not check the schedule.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!therapistId || !sessions.length || busy) return;
    setBusy(true);
    try {
      const res = await saveChildCustomSchedule(childId, {
        therapistId,
        sessionMinutes: minutes,
        sessions,
      });
      if (!res?.success) return Alert.alert("Could not save", res?.message || "Please try again.");
      Alert.alert("Appointments created", `${res.data?.created ?? sessions.length} session(s) added.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const data = e?.response?.data;
      if (data?.hasConflicts) {
        // something changed since the review, show the new conflicts
        setReview({ total: sessions.length, conflicts: data.conflicts || [] });
        return Alert.alert("Conflicts found", data.message);
      }
      Alert.alert("Could not save", data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const renderSpecChips = (t) => {
    const specs = [].concat(t.speciality ?? t.specialities ?? t.services ?? []);
    if (services.length === 0 || specs.length === 0) return null;
    return (
      <View style={styles.chipWrap}>
        {specs.map((sid) => {
          const m = serviceMap.get(sid) || { label: sid, bg: "#E0F2FE", color: "#0B4A6F" };
          return (
            <View key={sid} style={[styles.chip, { backgroundColor: m.bg }]}>
              <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.main}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>{!!childName && <Text style={styles.headerSub}>{childName}</Text>}</View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Therapist</Text>

        {selectedTherapist ? (
          <View style={styles.selectedCard}>
            <View style={styles.selectedTop}>
              <View style={[styles.radio, styles.radioOn]}>
                <View style={styles.radioDot} />
              </View>
              <Text style={styles.therapistName} numberOfLines={1}>
                {selectedTherapist.fullName || selectedTherapist.name}
              </Text>
              <TouchableOpacity style={styles.changeBtn} onPress={changeTherapist} activeOpacity={0.8}>
                <Feather name="repeat" size={14} color={colors.primary} />
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
            {renderSpecChips(selectedTherapist)}
          </View>
        ) : (
          <>
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
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.therapistRow}
                    onPress={() => pickTherapist(t)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.radio} />
                    <Text style={styles.therapistName} numberOfLines={1}>
                      {t.fullName || t.name}
                    </Text>
                    {renderSpecChips(t)}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        <Text style={styles.label}>Session length</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {DURATIONS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.durBtn, minutes === m && styles.durBtnOn]}
              onPress={() => pickMinutes(m)}
            >
              <Text style={[styles.durText, minutes === m && styles.durTextOn]}>{m} min</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!!therapistId && (
          <CustomSlotPicker
            key={`${therapistId}|${minutes}`}
            childId={childId}
            therapistId={therapistId}
            minutes={minutes}
            onChange={handlePlan}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {review && (
          <Text style={[styles.reviewNote, conflicts.length > 0 && { color: "#B91C1C" }]}>
            {conflicts.length > 0
              ? `${conflicts.length} of ${review.total} session(s) have a conflict.`
              : `No conflicts. ${review.total} session(s) are ready to save.`}
          </Text>
        )}

        {!review ? (
          <TouchableOpacity
            style={[styles.primaryBtn, (!sessions.length || busy) && { opacity: 0.5 }]}
            disabled={!sessions.length || busy}
            onPress={startReview}
          >
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Review schedule</Text>}
          </TouchableOpacity>
        ) : conflicts.length > 0 ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={() => setShowConflicts(true)}>
            <Text style={styles.primaryText}>View conflicts ({conflicts.length})</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={save}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Save sessions</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* conflicts list */}
      <Modal visible={showConflicts} transparent animationType="slide" onRequestClose={() => setShowConflicts(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: 26 + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Conflicts</Text>
              <TouchableOpacity onPress={() => setShowConflicts(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              Go back and change these dates or times, then review again. Nothing has been saved.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {conflicts.map((c) => (
                <View key={`${c.date}-${c.startTime}`} style={styles.conflictCard}>
                  <Text style={styles.conflictName}>
                    {prettyFull(c.date)} · {label(c)}
                  </Text>
                  {(c.reasons || []).map((r) => (
                    <Text key={r} style={styles.conflictReason}>
                      {r}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 14 }]} onPress={() => setShowConflicts(false)}>
              <Text style={styles.secondaryText}>Back to schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  headerSub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  content: { padding: 16, paddingBottom: 160 },

  hint: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", lineHeight: 18, marginBottom: 8 },
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

  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  durBtn: {
    height: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexShrink: 0,
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
  reviewNote: { fontSize: 12, fontFamily: fonts.semiBold, color: "#15803D", marginBottom: 8 },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFFFFF" },
  secondaryBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.primary },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontFamily: fonts.semiBold },
  selectedCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0B4A6F",
  },
  selectedTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E8F2FC",
  },
  changeBtnText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: "90%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 19, fontFamily: fonts.semiBold, color: "#0F172A" },
  conflictCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  conflictName: { fontSize: 14, fontFamily: fonts.semiBold, color: "#991B1B" },
  conflictReason: { fontSize: 12, fontFamily: fonts.regular, color: "#7F1D1D", marginTop: 2 },
});