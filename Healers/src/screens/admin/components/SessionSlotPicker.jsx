import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getSessionSlotOptions } from "../../../api/admin/api";
import { colors, fonts } from "../../../styles/theme";
import { formatTo12Hour } from "../../../utils/hoursformat";

const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const CHIP_WIDTH = 58;
const CHIP_GAP = 8;
const ITEM_SIZE = CHIP_WIDTH + CHIP_GAP;

const DateChip = memo(function DateChip({ k, on, onPress }) {
  const d = fromKey(k);
  return (
    <TouchableOpacity
      style={[styles.dateChip, on && styles.dateChipOn]}
      onPress={() => onPress(k)}
      activeOpacity={0.8}
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
});

const SlotButton = memo(function SlotButton({ slot, on, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.slot, on && styles.slotOn]}
      onPress={() => onPress(slot)}
      activeOpacity={0.8}
    >
      <Text style={[styles.slotText, on && styles.slotTextOn]}>
        {formatTo12Hour(`${slot.startTime}-${slot.endTime}`)}
      </Text>
    </TouchableOpacity>
  );
});

export default function SessionSlotPicker({
  batchId,
  assignmentId,
  loadSlots,
  minutes,
  endDate,
  value,
  onChange,
  startDate, // optional: "YYYY-MM-DD" string or Date. No `new Date()` default.
  maxDays = 365,
}) {
  const [date, setDate] = useState(value?.date || null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // keep onChange stable so memoized children don't re-render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // normalise to a string so the memo dependency is stable
  const startKey = useMemo(() => {
    if (!startDate) return null;
    return typeof startDate === "string" ? startDate : toKey(startDate);
  }, [startDate]);

  const days = useMemo(() => {
    const out = [];
    const now = new Date();
    const first = startKey && startKey > toKey(now) ? fromKey(startKey) : now;
    for (let i = 0; i < maxDays; i++) {
      const k = toKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
      if (endDate && k > endDate) break;
      out.push(k);
    }
    return out;
  }, [startKey, endDate, maxDays]);

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

  const pickDate = useCallback((k) => {
    setDate(k);
    onChangeRef.current(null);
  }, []);

  const pickSlot = useCallback(
    (s) => onChangeRef.current({ date, startTime: s.startTime, endTime: s.endTime }),
    [date],
  );

  const renderDate = useCallback(
    ({ item }) => <DateChip k={item} on={item === date} onPress={pickDate} />,
    [date, pickDate],
  );

  const getItemLayout = useCallback(
    (_, index) => ({ length: ITEM_SIZE, offset: ITEM_SIZE * index, index }),
    [],
  );

  return (
    <View>
      <Text style={styles.label}>Date</Text>
      <FlatList
        horizontal
        data={days}
        extraData={date}
        keyExtractor={(k) => k}
        renderItem={renderDate}
        getItemLayout={getItemLayout}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.dateRow}
      />

      <Text style={styles.label}>Start time</Text>
      {!date ? (
        <Text style={styles.muted}>Choose a date first.</Text>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Checking availability...</Text>
        </View>
      ) : slots.length === 0 ? (
        <Text style={styles.muted}>{message || "No free time on this date."}</Text>
      ) : (
        <View style={styles.slotWrap}>
          {slots.map((s) => (
            <SlotButton
              key={s.startTime}
              slot={s}
              on={value?.date === date && value?.startTime === s.startTime}
              onPress={pickSlot}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: 8 },
  muted: { fontSize: 12, fontFamily: fonts.regular, color: "#94A3B8" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  loadingText: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  dateRow: { flexGrow: 0 },
  dateChip: {
    width: CHIP_WIDTH,
    paddingVertical: 8,
    marginRight: CHIP_GAP,
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