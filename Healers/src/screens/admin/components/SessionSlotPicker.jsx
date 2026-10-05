import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getSessionSlotOptions } from '../../../api/admin/api';
import {
  colors,
  fonts,
} from '../../../styles/theme';
import { formatTo12Hour } from '../../../utils/hoursformat';

const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function SessionSlotPicker({
  batchId,
  assignmentId,
  loadSlots,
  minutes,
  endDate,
  value,
  onChange,
  startDate = new Date(),
  maxDays = 365,
}) {
  const [date, setDate] = useState(value?.date || null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const days = useMemo(() => {
    const out = [];
    const now = new Date();
    const first = startDate && startDate > toKey(now) ? fromKey(startDate) : now;
    for (let i = 0; i < maxDays; i++) {
      const k = toKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
      if (endDate && k > endDate) break;
      out.push(k);
    }
    return out;
  }, [startDate, endDate, maxDays]);

  useEffect(() => {
    if (!date || !minutes || (!loadSlots && !assignmentId)) return undefined;
    let alive = true;
    setLoading(true);
    setMessage("");
    setSlots([]);

    (async () => {
      try {
        const res = loadSlots
          ? await loadSlots(date, minutes)
          : await getSessionSlotOptions(batchId, assignmentId, { date, sessionMinutes: minutes });
        if (!alive) return;
        setSlots(res?.data?.slots || []);
        setMessage(res?.data?.reason || "");
      } catch (e) {
        if (alive) setMessage(e?.response?.data?.message || "Could not load available times.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [date, minutes, assignmentId, batchId, loadSlots]);

  const pickDate = (k) => {
    setDate(k);
    onChange(null);
  };

  return (
    <View>
      <Text style={styles.label}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
        {days.map((k) => {
          const d = fromKey(k);
          const on = k === date;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.dateChip, on && styles.dateChipOn]}
              onPress={() => pickDate(k)}
            >
              <Text style={[styles.dateDay, on && styles.dateTextOn]}>
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </Text>
              <Text style={[styles.dateNum, on && styles.dateTextOn]}>{d.getDate()}</Text>
              <Text style={[styles.dateMonth, on && styles.dateTextOn]}>
                {d.toLocaleDateString("en-US", { month: "short" })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Start time</Text>
      {!date
        ? <Text style={styles.muted}>Choose a date first.</Text>
        : loading
        ? <ActivityIndicator color={colors.primary} style={{ marginTop: 10, alignSelf: "flex-start" }} />
        : slots.length === 0
        ? <Text style={styles.muted}>{message || "No free time on this date."}</Text>
        : (
          <View style={styles.slotWrap}>
            {slots.map((s) => {
              const on = value?.date === date && value?.startTime === s.startTime;
              return (
                <TouchableOpacity
                  key={s.startTime}
                  style={[styles.slot, on && styles.slotOn]}
                  onPress={() => onChange({ date, startTime: s.startTime, endTime: s.endTime })}
                >
                  <Text style={[styles.slotText, on && styles.slotTextOn]}>
                    {formatTo12Hour(`${s.startTime}-${s.endTime}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: 8 },
  muted: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8" },
  dateRow: { flexGrow: 0 },
  dateChip: {
    width: 58,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateChipOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  dateDay: { fontSize: 11, fontFamily: fonts.regular, color: "#64748B" },
  dateNum: { fontSize: 18, fontFamily: fonts.semiBold, color: "#0F172A", marginVertical: 1 },
  dateMonth: { fontSize: 11, fontFamily: fonts.regular, color: "#64748B" },
  dateTextOn: { color: "#FFFFFF" },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  slotOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  slotText: { fontSize: 12, fontFamily: fonts.semiBold, color: "#334155" },
  slotTextOn: { color: "#FFFFFF" },
});
