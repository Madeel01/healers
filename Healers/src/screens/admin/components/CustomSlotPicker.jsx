import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
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
  getChildCustomWeekOptions,
} from '../../../api/admin/api';
import { colors, fonts } from '../../../styles/theme';
import { formatTo12Hour } from '../../../utils/hoursformat';
import { fontSize, wp } from '../../../utils/responsive';

/* ---------------- helpers ---------------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_RANGE_DAYS = 180; // must match backend CUSTOM_MAX_RANGE_DAYS
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
const dayOf = (k) => DAYS[(fromKey(k).getDay() + 6) % 7];
const prettyDay = (k) =>
  fromKey(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const prettyShort = (k) =>
  fromKey(k).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const label = (s) => formatTo12Hour(`${s.startTime}-${s.endTime}`);
const shortTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
};

const MODES = [
  { id: "weekly", title: "Weekly Routine", desc: "Same day and time every week", icon: "repeat" },
  { id: "flexible", title: "Week by Week", desc: "Weekly routine, but any week can use a different time", icon: "sliders" },
  { id: "single", title: "Single Day", desc: "One session on one chosen date", icon: "calendar" },
];

/* ---------------- small components ---------------- */
const DateField = ({ title, value, placeholder, onPress, active, disabled }) => (
  <View style={{ flex: 1 }}>
    <Text style={styles.fieldLabel}>{title}</Text>
    <TouchableOpacity
      style={[styles.dateField, active && styles.dateFieldOn, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Feather name="calendar" size={16} color={colors.primary} />
      <Text style={[styles.dateFieldText, !value && styles.dateFieldPlaceholder]} numberOfLines={1}>
        {value ? prettyShort(value) : placeholder}
      </Text>
    </TouchableOpacity>
  </View>
);

// booked slots are shown crossed out and cannot be tapped
const SlotGrid = ({ slots, isOn, onPick }) => (
  <View style={styles.slotWrap}>
    {slots.map((s) => {
      const on = isOn(s);
      const warn = !s.booked && s.conflicts > 0;
      return (
        <TouchableOpacity
          key={s.startTime}
          disabled={!!s.booked}
          style={[styles.slot, on && styles.slotOn, warn && styles.slotWarn, s.booked && styles.slotBooked]}
          onPress={() => onPick(s)}
          activeOpacity={0.8}
        >
          <Text style={[styles.slotText, on && styles.slotTextOn, s.booked && styles.slotTextBooked]}>
            {label(s)}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const LoadingRow = ({ text }) => (
  <View style={styles.loadingRow}>
    <ActivityIndicator size="small" color={colors.primary} />
    <Text style={styles.loadingText}>{text}</Text>
  </View>
);

const SectionCard = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

// loads the slots of one date (already-booked ones come back flagged booked)
function useDateSlots(childId, therapistId, minutes, date) {
  const [state, setState] = useState({ slots: [], loading: false, message: "" });

  useEffect(() => {
    if (!date) {
      setState({ slots: [], loading: false, message: "" });
      return undefined;
    }
    let alive = true;
    setState({ slots: [], loading: true, message: "" });
    getChildCustomSlotOptions(childId, { therapistId, date, sessionMinutes: minutes })
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
  }, [childId, therapistId, minutes, date]);

  return state;
}

/* ---------------- main picker ---------------- */
export default function CustomSlotPicker({ childId, therapistId, minutes, onChange }) {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => toKey(new Date()), []);
  const [mode, setMode] = useState("weekly");
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(null); // "start" | "end" | "single"

  // weekly + flexible
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [week, setWeek] = useState(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekMsg, setWeekMsg] = useState("");
  const [daySlot, setDaySlot] = useState({});
  const [overrides, setOverrides] = useState({});
  const [editDate, setEditDate] = useState(null);
  const [activeDay, setActiveDay] = useState(null);

  // single
  const [date, setDate] = useState(null);
  const [single, setSingle] = useState(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const needsWeek = mode !== "single";

  useEffect(() => {
    if (!needsWeek || !startDate || !endDate) return undefined;
    let alive = true;
    setWeekLoading(true);
    setWeekMsg("");
    getChildCustomWeekOptions(childId, { therapistId, sessionMinutes: minutes, startDate, endDate })
      .then((res) => {
        if (!alive) return;
        setWeek(res?.data || null);
        setDaySlot({});
        setOverrides({});
        setEditDate(null);
        setActiveDay(null);
      })
      .catch((e) => {
        if (!alive) return;
        setWeek(null);
        setWeekMsg(e?.response?.data?.message || "Could not load available times.");
      })
      .finally(() => {
        if (alive) setWeekLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [needsWeek, childId, therapistId, minutes, startDate, endDate]);

  const dateState = useDateSlots(childId, therapistId, minutes, mode === "single" ? date : null);
  const editState = useDateSlots(childId, therapistId, minutes, mode === "flexible" ? editDate : null);

  const pickStart = useCallback((k) => {
    setStartDate(k);
    setEndDate((prev) => (!prev || prev < k || prev > shiftKey(k, MAX_RANGE_DAYS) ? shiftKey(k, 27) : prev));
  }, []);
  const pickDate = useCallback((k) => {
    setDate(k);
    setSingle(null);
  }, []);

  const pickDaySlot = (day, s) =>
    setDaySlot((p) => {
      const next = { ...p };
      if (p[day]?.startTime === s.startTime) delete next[day];
      else next[day] = { startTime: s.startTime, endTime: s.endTime };
      return next;
    });

  const pickOverride = (d, s) => {
    const base = daySlot[dayOf(d)];
    setOverrides((o) => {
      const next = { ...o };
      if (base && base.startTime === s.startTime) delete next[d];
      else next[d] = { startTime: s.startTime, endTime: s.endTime };
      return next;
    });
    setEditDate(null);
  };

  // every dated session produced by the weekly routine (+ week changes in flexible mode)
  const weekSessions = useMemo(() => {
    if (!week) return [];
    const out = [];
    for (const d of DAYS) {
      const base = daySlot[d];
      if (!base) continue;
      for (const dt of week.dates?.[d] || []) {
        const custom = mode === "flexible" ? overrides[dt] : null;
        const slot = custom || base;
        out.push({ date: dt, startTime: slot.startTime, endTime: slot.endTime, changed: !!custom });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [week, daySlot, overrides, mode]);

  const sessions = useMemo(() => {
    if (mode === "single") return single ? [single] : [];
    return weekSessions;
  }, [mode, single, weekSessions]);

  useEffect(() => {
    onChangeRef.current({
      mode,
      sessions: sessions.map(({ date: d, startTime, endTime }) => ({ date: d, startTime, endTime })),
    });
  }, [mode, sessions]);

  /* ---- derived ---- */
  const availableDays = useMemo(
    () => (week ? DAYS.filter((d) => (week.dates?.[d] || []).length > 0) : []),
    [week],
  );
  const currentDay = availableDays.includes(activeDay) ? activeDay : availableDays[0];
  const rangeDays =
    startDate && endDate ? Math.round((fromKey(endDate) - fromKey(startDate)) / 86400000) + 1 : 0;
  const changedCount = weekSessions.filter((s) => s.changed).length;
  const dayChips = DAYS.filter((d) => daySlot[d]);
  const modeInfo = MODES.find((m) => m.id === mode);

  /* ---- date picker (one picker shared by all date fields) ---- */
  const pickerConfig = useMemo(() => {
    if (picking === "start") {
      return { value: startDate || today, min: today, max: shiftKey(today, 365) };
    }
    if (picking === "end") {
      return { value: endDate || startDate, min: startDate, max: shiftKey(startDate || today, MAX_RANGE_DAYS) };
    }
    if (picking === "single") {
      return { value: date || today, min: today, max: shiftKey(today, 365) };
    }
    return null;
  }, [picking, startDate, endDate, date, today]);

  const handleDate = (event, selected) => {
    if (event?.type === "dismissed") {
      setPicking(null);
      return;
    }
    if (!selected) return;
    const k = toKey(selected);
    if (picking === "start") pickStart(k);
    else if (picking === "end") setEndDate(k);
    else if (picking === "single") pickDate(k);
    setPicking(null);
  };

  const closeModal = () => {
    setPicking(null);
    setEditDate(null);
    setOpen(false);
  };

  /* ---------------- UI ---------------- */
  return (
    <View>
      {/* schedule type */}
      <Text style={styles.label}>Schedule type</Text>
      {MODES.map((m) => {
        const on = mode === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.modeCard, on && styles.modeCardOn]}
            onPress={() => setMode(m.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeTitle}>{m.title}</Text>
              <Text style={styles.hint}>{m.desc}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* summary card, opens the modal */}
      <Text style={styles.label}>Dates & times</Text>
      <TouchableOpacity
        style={[styles.summaryCard, !sessions.length && styles.summaryEmpty]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <View style={styles.summaryTop}>
          <View style={styles.summaryIcon}>
            <Feather name={modeInfo.icon} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>
              {sessions.length ? `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} selected` : "Choose dates & times"}
            </Text>
            <Text style={styles.hint} numberOfLines={2}>
              {mode === "single"
                ? single
                  ? `${prettyDay(single.date)} · ${label(single)}`
                  : "Pick a date and a start time"
                : startDate && endDate
                  ? `${prettyShort(startDate)} → ${prettyShort(endDate)} · ${rangeDays} days`
                  : "Pick a date range and your weekly times"}
            </Text>
          </View>
          <View style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>{sessions.length ? "Edit" : "Select"}</Text>
          </View>
        </View>

        {mode !== "single" && dayChips.length > 0 && (
          <View style={styles.chipWrap}>
            {dayChips.map((d) => (
              <View key={d} style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>
                  {d} · {shortTime(daySlot[d].startTime)}
                </Text>
              </View>
            ))}
            {mode === "flexible" && changedCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "#FEF3C7" }]}>
                <Text style={[styles.summaryChipText, { color: "#92400E" }]}>{changedCount} week(s) changed</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* ================= modal ================= */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{modeInfo.title}</Text>
                <Text style={styles.hint}>{modeInfo.desc}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={closeModal}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {mode === "single" ? (
                <>
                  <View style={styles.fieldRow}>
                    <DateField
                      title="Date"
                      value={date}
                      placeholder="Select date"
                      active={picking === "single"}
                      onPress={() => setPicking(picking === "single" ? null : "single")}
                    />
                  </View>

                  <Text style={styles.label}>Start time</Text>
                  {!date ? (
                    <Text style={styles.muted}>Choose a date first.</Text>
                  ) : dateState.loading ? (
                    <LoadingRow text="Checking availability..." />
                  ) : dateState.slots.length === 0 ? (
                    <Text style={styles.muted}>{dateState.message || "No availability on this date."}</Text>
                  ) : (
                    <SectionCard>
                      <Text style={styles.hint}>Crossed-out times are already booked.</Text>
                      <SlotGrid
                        slots={dateState.slots}
                        isOn={(s) => single?.date === date && single?.startTime === s.startTime}
                        onPick={(s) => setSingle({ date, startTime: s.startTime, endTime: s.endTime })}
                      />
                    </SectionCard>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.fieldRow}>
                    <DateField
                      title="Start date"
                      value={startDate}
                      placeholder="Select"
                      active={picking === "start"}
                      onPress={() => setPicking(picking === "start" ? null : "start")}
                    />
                    <DateField
                      title="End date"
                      value={endDate}
                      placeholder="Select"
                      disabled={!startDate}
                      active={picking === "end"}
                      onPress={() => setPicking(picking === "end" ? null : "end")}
                    />
                  </View>
                  {rangeDays > 0 && (
                    <Text style={[styles.hint, { marginTop: 8 }]}>
                      {rangeDays} days selected (max {MAX_RANGE_DAYS}).
                    </Text>
                  )}

                  {weekLoading ? (
                    <LoadingRow text="Checking availability..." />
                  ) : weekMsg ? (
                    <Text style={[styles.muted, { marginTop: 14 }]}>{weekMsg}</Text>
                  ) : !startDate || !endDate ? (
                    <Text style={[styles.muted, { marginTop: 14 }]}>Select the start and end date first.</Text>
                  ) : week ? (
                    <>
                      {/* day tabs */}
                      <Text style={styles.label}>Weekly time</Text>
                      <Text style={styles.hint}>
                        Tap a day, then pick one time. It repeats on that day in every week.
                      </Text>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.dayTabs}
                      >
                        {availableDays.map((d) => {
                          const picked = daySlot[d];
                          const on = d === currentDay;
                          return (
                            <TouchableOpacity
                              key={d}
                              style={[styles.dayTab, on && styles.dayTabOn, !on && picked && styles.dayTabPicked]}
                              onPress={() => setActiveDay(d)}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.dayTabName, on && styles.dayTabTextOn]}>{d}</Text>
                              <Text
                                style={[
                                  styles.dayTabTime,
                                  on && styles.dayTabTextOn,
                                  !on && picked && { color: "#15803D" },
                                ]}
                                numberOfLines={1}
                              >
                                {picked ? shortTime(picked.startTime) : "Not set"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {currentDay && (
                        <SectionCard>
                          <View style={styles.cardHead}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.modeTitle}>Every {currentDay}</Text>
                              <Text style={styles.hint}>
                                {(week.dates?.[currentDay] || []).length} {currentDay}(s) in this range
                              </Text>
                            </View>
                            {!!daySlot[currentDay] && (
                              <TouchableOpacity style={styles.changeBtn} onPress={() => pickDaySlot(currentDay, daySlot[currentDay])}>
                                <Text style={styles.changeBtnText}>Clear</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {(week.days?.[currentDay] || []).length === 0 ? (
                            <Text style={styles.mutedText}>No slot available on {currentDay}</Text>
                          ) : (
                            <>
                              <Text style={[styles.hint, { marginTop: 6 }]}>
                                Crossed-out: booked every week. Orange border: clashes in some weeks.
                              </Text>
                              <SlotGrid
                                slots={week.days[currentDay]}
                                isOn={(s) => daySlot[currentDay]?.startTime === s.startTime}
                                onPick={(s) => pickDaySlot(currentDay, s)}
                              />
                            </>
                          )}
                        </SectionCard>
                      )}

                      {/* week by week changes */}
                      {mode === "flexible" && (
                        <>
                          <View style={[styles.cardHead, { marginTop: 18 }]}>
                            <Text style={[styles.label, { marginTop: 0, marginBottom: 0, flex: 1 }]}>Your weeks</Text>
                            {changedCount > 0 && (
                              <TouchableOpacity style={styles.changeBtn} onPress={() => setOverrides({})}>
                                <Text style={styles.changeBtnText}>Reset all</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {weekSessions.length === 0 ? (
                            <Text style={styles.muted}>Pick a weekly time above to see every week here.</Text>
                          ) : (
                            <>
                              <Text style={[styles.hint, { marginTop: 6 }]}>
                                Tap Change to use a different time for one week only.
                              </Text>
                              {weekSessions.map((s) => {
                                const isOpen = editDate === s.date;
                                return (
                                  <View key={s.date} style={styles.weekRow}>
                                    <View style={styles.weekTop}>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.weekDate}>{prettyDay(s.date)}</Text>
                                        <Text style={[styles.hint, { marginBottom: 0 }, s.changed && { color: colors.primary }]}>
                                          {label(s)}
                                          {s.changed ? "  (changed)" : ""}
                                        </Text>
                                      </View>
                                      {s.changed && (
                                        <TouchableOpacity
                                          style={[styles.changeBtn, { marginRight: 6 }]}
                                          onPress={() =>
                                            setOverrides((o) => {
                                              const next = { ...o };
                                              delete next[s.date];
                                              return next;
                                            })
                                          }
                                        >
                                          <Text style={styles.changeBtnText}>Reset</Text>
                                        </TouchableOpacity>
                                      )}
                                      <TouchableOpacity
                                        style={styles.changeBtn}
                                        onPress={() => setEditDate(isOpen ? null : s.date)}
                                      >
                                        <Text style={styles.changeBtnText}>{isOpen ? "Close" : "Change"}</Text>
                                      </TouchableOpacity>
                                    </View>

                                    {isOpen &&
                                      (editState.loading ? (
                                        <LoadingRow text="Checking availability..." />
                                      ) : editState.slots.length === 0 ? (
                                        <Text style={styles.muted}>{editState.message || "No availability on this date."}</Text>
                                      ) : (
                                        <View style={{ marginTop: 8 }}>
                                          <SlotGrid
                                            slots={editState.slots}
                                            isOn={(x) => x.startTime === s.startTime}
                                            onPick={(x) => pickOverride(s.date, x)}
                                          />
                                        </View>
                                      ))}
                                  </View>
                                );
                              })}
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </ScrollView>

            <View style={[styles.sheetFooter, { paddingBottom: 14 + insets.bottom }]}>
              <TouchableOpacity style={styles.primaryBtn} onPress={closeModal} activeOpacity={0.85}>
                <Text style={styles.primaryText}>
                  {sessions.length ? `Done · ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}` : "Done"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!!picking && !!pickerConfig?.value && (
          <View style={Platform.OS === "ios" ? styles.iosPickerWrap : undefined}>
            {Platform.OS === "ios" && (
              <View style={styles.iosPickerHeader}>
                <Text style={styles.modeTitle}>
                  {picking === "start" ? "Start date" : picking === "end" ? "End date" : "Date"}
                </Text>
                <TouchableOpacity onPress={() => setPicking(null)}>
                  <Text style={styles.changeBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
            <DateTimePicker
              value={fromKey(pickerConfig.value)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              minimumDate={pickerConfig.min ? fromKey(pickerConfig.min) : undefined}
              maximumDate={pickerConfig.max ? fromKey(pickerConfig.max) : undefined}
              onValue  Change={handleDate}
              accentColor={colors.primary}
              themeVariant="light"
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: 8 },
  fieldLabel: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: "#64748B", marginBottom: 6 },
  hint: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", lineHeight: 18, marginBottom: 6 },
  muted: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8", marginBottom: 20 },
  mutedText: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  loadingText: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B" },

  modeCard: {
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
  modeCardOn: { borderColor: "#0B4A6F" },
  modeTitle: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
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

  /* summary card */
  summaryCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0B4A6F",
    marginBottom: 20,
  },
  summaryEmpty: { borderStyle: "dashed", borderColor: "#94A3B8" },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E8F2FC",
    alignItems: "center",
    justifyContent: "center",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  summaryChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#DCFCE7" },
  summaryChipText: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#15803D" },

  /* modal */
  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: {
    height: "92%",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  sheetTitle: { fontSize: fontSize(19), fontFamily: fonts.semiBold, color: "#0F172A" },
  sheetFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#FFFFFF" },

  /* date fields */
  fieldRow: { flexDirection: "row", gap: 10, marginTop: 6 },
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

  /* day tabs */
  dayTabs: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  dayTab: {
    minWidth: wp(68),
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayTabOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  dayTabPicked: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  dayTabName: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0F172A" },
  dayTabTime: { fontSize: fontSize(10), fontFamily: fonts.regular, color: "#94A3B8", marginTop: 2 },
  dayTabTextOn: { color: "#FFFFFF" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, marginTop: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },

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
  slotWarn: { borderColor: "#F59E0B" },
  slotBooked: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  slotText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: "#334155" },
  slotTextOn: { color: "#FFFFFF" },
  slotTextBooked: { color: "#CBD5E1", textDecorationLine: "line-through" },

  weekRow: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  weekTop: { flexDirection: "row", alignItems: "center" },
  weekDate: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#0F172A" },
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
});