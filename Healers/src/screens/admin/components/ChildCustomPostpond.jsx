import React, { useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  getChildCustomSlotOptions,
  postponeChildCustomAppointment,
} from '../../../api/admin/api';
import { colors, fonts } from '../../../styles/theme';
import { formatTo12Hour } from '../../../utils/hoursformat';
import { fontSize, hp, wp } from '../../../utils/responsive';

const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shiftKey = (k, n) => {
  const d = fromKey(k);
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const label = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
const prettyFull = (k) =>
  fromKey(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/**
 * appointment: one item from getChildSchedule -> { id, date, startTime, endTime, therapistId, therapistName }
 */
export default function PostponeCustomModal({ visible, childId, appointment, onClose, onDone }) {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => toKey(new Date()), []);
  const minutes = appointment ? toMin(appointment.endTime) - toMin(appointment.startTime) : 0;

  const [date, setDate] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [slot, setSlot] = useState(null);
  const [state, setState] = useState({ slots: [], loading: false, message: "" });
  const [busy, setBusy] = useState(false);

  // reset every time the modal opens for an appointment
  useEffect(() => {
    if (visible) {
      setDate(null);
      setSlot(null);
      setShowPicker(false);
      setState({ slots: [], loading: false, message: "" });
    }
  }, [visible, appointment?.id]);

  useEffect(() => {
    if (!visible || !date || !appointment) return undefined;
    let alive = true;
    setSlot(null);
    setState({ slots: [], loading: true, message: "" });
    getChildCustomSlotOptions(childId, {
      therapistId: appointment.therapistId,
      date,
      sessionMinutes: minutes,
    })
      .then((res) => {
        if (alive) setState({ slots: res?.data?.slots || [], loading: false, message: res?.data?.reason || "" });
      })
      .catch((e) => {
        if (alive) {
          setState({
            slots: [],
            loading: false,
            message: e?.response?.data?.message || "Could not load available times.",
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [visible, date, childId, appointment, minutes]);

  const handleDate = (event, selected) => {
    setShowPicker(false);
    if (event?.type === "dismissed" || !selected) return;
    setDate(toKey(selected));
  };

  const submit = async () => {
    if (!slot || !date || busy) return;
    setBusy(true);
    try {
      const res = await postponeChildCustomAppointment(childId, appointment.id, {
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      if (!res?.success) return Alert.alert("Could not postpone", res?.message || "Please try again.");
      Alert.alert("Appointment postponed", `${prettyFull(date)}, ${label(slot)}`, [
        { text: "OK", onPress: () => onDone?.() },
      ]);
    } catch (e) {
      Alert.alert("Could not postpone", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!appointment) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Postpone appointment</Text>
              <Text style={styles.hint}>
                Current: {prettyFull(appointment.date)} · {label(appointment)}
                {appointment.therapistName ? `\nWith ${appointment.therapistName}` : ""}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>New date</Text>
            <TouchableOpacity
              style={[styles.dateField, showPicker && styles.dateFieldOn]}
              onPress={() => setShowPicker((v) => !v)}
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.dateFieldText, !date && styles.dateFieldPlaceholder]}>
                {date ? prettyFull(date) : "Select date"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>New start time</Text>
            {!date ? (
              <Text style={styles.muted}>Choose a date first.</Text>
            ) : state.loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Checking availability...</Text>
              </View>
            ) : state.slots.length === 0 ? (
              <Text style={styles.muted}>{state.message || "No availability on this date."}</Text>
            ) : (
              <View style={styles.card}>
                <Text style={styles.hint}>{minutes} minute sessions. Crossed-out times are already booked.</Text>
                <View style={styles.slotWrap}>
                  {state.slots.map((s) => {
                    const on = slot?.startTime === s.startTime;
                    return (
                      <TouchableOpacity
                        key={s.startTime}
                        disabled={!!s.booked}
                        style={[styles.slot, on && styles.slotOn, s.booked && styles.slotBooked]}
                        onPress={() => setSlot({ startTime: s.startTime, endTime: s.endTime })}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.slotText, on && styles.slotTextOn, s.booked && styles.slotTextBooked]}>
                          {label(s)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.sheetFooter, { paddingBottom: 14 + insets.bottom }]}>
            <TouchableOpacity
              style={[styles.primaryBtn, (!slot || busy) && { opacity: 0.5 }]}
              disabled={!slot || busy}
              onPress={submit}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Confirm postpone</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showPicker && (
        <View style={Platform.OS === "ios" ? styles.iosPickerWrap : undefined}>
          {Platform.OS === "ios" && (
            <View style={styles.iosPickerHeader}>
              <Text style={styles.modeTitle}>New date</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.changeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          <DateTimePicker
            value={fromKey(date || today)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            minimumDate={fromKey(today)}
            maximumDate={fromKey(shiftKey(today, 365))}
            onValueChange={handleDate}
            accentColor={colors.primary}
            themeVariant="light"
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: 8 },
  hint: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", lineHeight: 18, marginBottom: 6 },
  muted: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8", marginBottom: 20 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  loadingText: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B" },
  modeTitle: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },

  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    height: "85%",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  sheetTitle: { fontSize: fontSize(19), fontFamily: fonts.semiBold, color: "#0F172A", marginBottom: 4 },
  sheetFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    height: hp(50),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#FFFFFF" },

  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateFieldOn: { borderColor: "#0B4A6F" },
  dateFieldText: { flex: 1, fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0F172A" },
  dateFieldPlaceholder: { color: "#94A3B8", fontFamily: fonts.regular },

  iosPickerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  iosPickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  changeBtnText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14 },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  slot: {
    paddingHorizontal: wp(8),
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  slotOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  slotBooked: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  slotText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: "#334155" },
  slotTextOn: { color: "#FFFFFF" },
  slotTextBooked: { color: "#CBD5E1", textDecorationLine: "line-through" },
});