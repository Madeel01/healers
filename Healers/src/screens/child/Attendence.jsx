import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import { getChildAttendance } from '../../api/child/api';
import { fonts } from '../../styles/theme';

const BLUE = "#075BB8";
const DARK = "#10243D";
const MUTED = "#8A9DBA";

const pad = (n) => String(n).padStart(2, "0");

const dateKey = (date) => {
  const d = new Date(date);
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join("-");
};

const addDays = (date, count) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);

const startWeek = (date) => addDays(date, -((date.getDay() + 6) % 7));

const sameDate = (a, b) => dateKey(a) === dateKey(b);

const time12 = (time) => {
  if (!time) return "--";
  const [h, m] = String(time).split(":").map(Number);
  if (!Number.isFinite(h)) return time;
  return `${h % 12 || 12}:${pad(m || 0)} ${h >= 12 ? "PM" : "AM"}`;
};

const getMonthWeeks = (month) => {
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const result = [];
  for (let day = 1; day <= lastDay; day += 7) {
    result.push({
      start: day,
      end: Math.min(day + 6, lastDay),
      label: `Week ${result.length + 1}`,
    });
  }
  return result;
};

const getAppointmentDateTime = (item) => {
  const [year, month, day] = String(item.date).slice(0, 10).split("-").map(Number);
  const [hours, minutes] = String(item.startTime || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
};

const formatAttendanceDate = (dateString) => {
  if (!dateString) return "--";
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Session type tags (alternate / additional)
const SESSION_TAGS = {
  alternate: { label: "Alternate", icon: "repeat", color: "#1D70EE", bg: "#E8F0FE" },
  additional: { label: "Additional", icon: "plus-circle", color: "#0E8F8A", bg: "#E0F7F6" },
};

// Pill (right side badge) resolver
const getPill = (item, future) => {
  const type = String(item.sessionType || "regular").toLowerCase();

  if (type === "cancel") {
    return { text: "Cancelled", color: "#E23838", bg: "#FDEDED" };
  }
  if (type === "postponed") {
    return { text: "Postponed", color: "#C2570C", bg: "#FFEBD9" };
  }

  const status = String(item.attendance_status || "Pending").toLowerCase();

  if (status === "complete" || status === "present" || status === "completed") {
    return { text: "Present", color: "#009D73", bg: "#E3F8F1" };
  }
  if (status === "absent") {
    return { text: "Absent", color: "#E23838", bg: "#FDEDED" };
  }
  return { text: future ? "Not Yet" : "Pending", color: "#BD7400", bg: "#FFF2D8" };
};

export default function AttendanceScreen({ route }) {
  const [mode, setMode] = useState(route?.params?.filterType === "today" ? "Today" : "Week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [weekIndex, setWeekIndex] = useState(Math.floor((new Date().getDate() - 1) / 7));

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);
  const [monthPicker, setMonthPicker] = useState(false);

  const [therapistFilterVisible, setTherapistFilterVisible] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState(null);

  const weeks = useMemo(() => getMonthWeeks(month), [month]);

  // ========================================
  // FETCH
  // ========================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const response = await getChildAttendance({
        mode: mode.toLowerCase(),
        date: dateKey(selectedDate),
      });

      if (!response?.success) {
        throw new Error(response?.message || "Failed to fetch attendance");
      }

      setRecords(response.data || []);
    } catch (error) {
      console.error("Attendance error:", error);
      setRecords([]);
      Alert.alert(
        "Attendance",
        error?.response?.data?.message || error.message || "Unable to fetch attendance."
      );
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    if (route?.params?.filterType === "today") {
      const today = new Date();
      setMode("Today");
      setSelectedDate(today);
      setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }, [route?.params?.filterType]);

  // ========================================
  // MODE / DATE
  // ========================================

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setFull(false);

    if (nextMode === "Today" || nextMode === "Tomorrow") {
      const date = addDays(new Date(), nextMode === "Tomorrow" ? 1 : 0);
      setSelectedDate(date);
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    } else if (nextMode === "Month") {
      setWeekIndex(Math.floor((selectedDate.getDate() - 1) / 7));
    }
  };

  const chooseDate = (date) => {
    setSelectedDate(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setFull(false);
  };

  const moveMonth = (direction) => {
    const date = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(date);
    setSelectedDate(date);
    setWeekIndex(0);
  };

  const days = useMemo(() => {
    if (mode === "Today" || mode === "Tomorrow") return [];

    if (mode === "Week") {
      return Array.from({ length: 7 }, (_, i) => addDays(startWeek(selectedDate), i));
    }

    const week = weeks[Math.min(weekIndex, weeks.length - 1)];
    if (!week) return [];

    return Array.from({ length: week.end - week.start + 1 }, (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), week.start + i)
    );
  }, [mode, selectedDate, month, weekIndex, weeks]);

  // ========================================
  // THERAPIST FILTER
  // ========================================

  const therapistOptions = useMemo(() => {
    const map = new Map();
    records.forEach((item) => {
      if (item.therapistId && !map.has(item.therapistId)) {
        map.set(item.therapistId, {
          therapistId: item.therapistId,
          therapistName: item.therapistName || "Therapist",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.therapistName.localeCompare(b.therapistName)
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (!selectedTherapistId) return records;
    return records.filter((item) => item.therapistId === selectedTherapistId);
  }, [records, selectedTherapistId]);

  const shown = full ? filteredRecords : filteredRecords.slice(0, 5);

  const dayHeader = selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });

  // ========================================
  // RENDER
  // ========================================

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* MONTH HEADER */}
        <View style={styles.banner}>
          <TouchableOpacity onPress={() => setMonthPicker(true)} style={styles.bannerLeft}>
            <Feather name="calendar" size={20} color="#FFFFFF" />
            <Text style={styles.bannerTitle}>
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <Feather name="chevron-down" size={17} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.statusHeader}>
            <Text style={styles.statusHeaderText}>Status</Text>
          </View>
        </View>

        {/* MODES */}
        <View style={styles.modeRow}>
          {[
            ["Today", "sun"],
            ["Tomorrow", "calendar"],
            ["Week", "check-square"],
            ["Month", "bar-chart-2"],
          ].map(([value, icon]) => (
            <TouchableOpacity
              key={value}
              onPress={() => changeMode(value)}
              style={[styles.modeBtn, mode === value && styles.modeActive]}
            >
              <Feather name={icon} size={20} color={mode === value ? "#FFFFFF" : "#60718A"} />
              <Text style={[styles.modeText, mode === value && { color: "#FFFFFF" }]}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* MONTH WEEKS */}
        {mode === "Month" && (
          <View style={styles.weekRow}>
            {weeks.map((week, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setWeekIndex(index);
                  chooseDate(new Date(month.getFullYear(), month.getMonth(), week.start));
                }}
                style={[styles.weekBtn, weekIndex === index && styles.weekActive]}
              >
                <Text style={[styles.weekTitle, weekIndex === index && { color: "#FFFFFF" }]}>
                  {week.label}
                </Text>
                <Text style={[styles.weekRange, weekIndex === index && { color: "#DDEAFF" }]}>
                  {pad(week.start)} - {pad(week.end)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* DAYS */}
        {days.length > 0 && (
          <View style={styles.daysRow}>
            {days.map((day) => {
              const selected = sameDate(day, selectedDate);
              return (
                <TouchableOpacity
                  key={dateKey(day)}
                  onPress={() => chooseDate(day)}
                  style={[styles.dayBtn, selected && styles.dayActive]}
                >
                  <Text style={[styles.dayName, selected && { color: "#DBEAFE" }]}>
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text style={[styles.dayNumber, selected && { color: "#FFFFFF" }]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* SECTION HEADER */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{dayHeader}</Text>
          <Text style={styles.count}>{filteredRecords.length} Appointments</Text>
          <TouchableOpacity style={styles.refresh} onPress={() => setTherapistFilterVisible(true)}>
            <Feather name="sliders" size={16} color="#60718A" />
          </TouchableOpacity>
        </View>

        {/* LIST */}
        {loading ? (
          <ActivityIndicator size="small" color={BLUE} style={{ marginTop: 35 }} />
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No scheduled appointments for this date</Text>
          </View>
        ) : (
          shown.map((item, index) => {
            const future = getAppointmentDateTime(item) > new Date();
            const pill = getPill(item, future);
            const type = String(item.sessionType || "regular").toLowerCase();
            const tag = SESSION_TAGS[type];
            const struck = type === "cancel" || type === "postponed";

            return (
              <View
                key={`${item.id}:${item.childAttendanceId || index}`}
                style={[styles.childCard, struck && { opacity: 0.85 }]}
              >
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Feather name="user" size={23} color="#7489A2" />
                </View>

                <View style={styles.childInfo}>
                  <Text style={styles.childName} numberOfLines={2}>
                    {item.therapistName || "Therapist"}
                  </Text>

                  <View style={styles.childDateRow}>
                    <Feather name="calendar" size={12} color={BLUE} />
                    <Text style={styles.childDate}>{formatAttendanceDate(item.date)}</Text>
                  </View>

                  <View style={styles.childTimeRow}>
                    <Feather name="clock" size={12} color={MUTED} />
                    <Text
                      style={[
                        styles.childTime,
                        struck && { textDecorationLine: "line-through" },
                      ]}
                    >
                      {time12(item.startTime)} - {time12(item.endTime)}
                    </Text>
                  </View>

                  {tag && (
                    <View style={[styles.tag, { backgroundColor: tag.bg }]}>
                      <Feather name={tag.icon} size={10} color={tag.color} />
                      <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
                    </View>
                  )}
                </View>

                {/* READ ONLY BADGE */}
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.pillText, { color: pill.color }]}>{pill.text}</Text>
                </View>
              </View>
            );
          })
        )}

        {!loading && filteredRecords.length > 5 && (
          <TouchableOpacity onPress={() => setFull(!full)} style={styles.history}>
            <Text style={styles.historyText}>
              {full ? "Hide Full History" : "View Full History ›"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* THERAPIST FILTER MODAL */}
      <Modal
        transparent
        visible={therapistFilterVisible}
        animationType="fade"
        onRequestClose={() => setTherapistFilterVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Therapists</Text>
              <TouchableOpacity onPress={() => setTherapistFilterVisible(false)}>
                <Feather name="x" size={22} color={DARK} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                style={styles.filterOption}
                onPress={() => {
                  setSelectedTherapistId(null);
                  setTherapistFilterVisible(false);
                }}
              >
                <Feather name="users" size={20} color={BLUE} />
                <Text style={styles.filterOptionText}>All Therapists</Text>
                {!selectedTherapistId && <Feather name="check-circle" size={20} color={BLUE} />}
              </TouchableOpacity>

              {therapistOptions.map((t) => (
                <TouchableOpacity
                  key={t.therapistId}
                  style={styles.filterOption}
                  onPress={() => {
                    setSelectedTherapistId(t.therapistId);
                    setTherapistFilterVisible(false);
                    setFull(false);
                  }}
                >
                  <Feather name="user" size={20} color={BLUE} />
                  <Text style={styles.filterOptionText}>{t.therapistName}</Text>
                  {selectedTherapistId === t.therapistId && (
                    <Feather name="check-circle" size={20} color={BLUE} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MONTH PICKER */}
      <Modal
        transparent
        visible={monthPicker}
        animationType="fade"
        onRequestClose={() => setMonthPicker(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Select Month</Text>

            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => moveMonth(-1)}>
                <Feather name="chevron-left" size={25} color={BLUE} />
              </TouchableOpacity>

              <Text style={styles.monthNavText}>
                {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>

              <TouchableOpacity onPress={() => moveMonth(1)}>
                <Feather name="chevron-right" size={25} color={BLUE} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.done} onPress={() => setMonthPicker(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F9FC" },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 35 },
  banner: {
    backgroundColor: BLUE,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  bannerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  bannerTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 17 },
  statusHeader: {
    backgroundColor: "#91F1EC",
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  statusHeaderText: { color: "#07508D", fontSize: 12, fontFamily: fonts.semiBold },
  modeRow: { flexDirection: "row", gap: 9, marginBottom: 18 },
  modeBtn: {
    flex: 1,
    minWidth: 0,
    height: 62,
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    elevation: 1,
  },
  modeActive: { backgroundColor: BLUE },
  modeText: { fontSize: 11, color: "#60718A", fontFamily: fonts.medium },
  weekRow: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 15,
    flexDirection: "row",
    gap: 5,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  weekBtn: {
    flexGrow: 1,
    minWidth: "17%",
    backgroundColor: "#EDF2FC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 5,
    alignItems: "center",
  },
  weekActive: { backgroundColor: "#1F70F2" },
  weekTitle: { fontSize: 11, fontFamily: fonts.semiBold, color: DARK },
  weekRange: { fontSize: 9, color: "#718096", marginTop: 4 },
  daysRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
    marginBottom: 20,
  },
  dayBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 13,
  },
  dayActive: { backgroundColor: "#1D70EE" },
  dayName: { fontSize: 11, color: MUTED },
  dayNumber: { fontSize: 15, fontFamily: fonts.bold, color: DARK, marginTop: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: DARK, flex: 1 },
  count: { fontSize: 11, color: MUTED, fontFamily: fonts.medium },
  refresh: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  childCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    elevation: 1,
    minHeight: 70,
  },
  avatar: { height: 44, width: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: "#EAF0F7",
    alignItems: "center",
    justifyContent: "center",
  },
  childInfo: { flex: 1, minWidth: 0 },
  childName: { fontSize: 12, fontFamily: fonts.bold, color: DARK },
  childDateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  childDate: { fontSize: 10, fontFamily: fonts.medium, color: BLUE },
  childTimeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  childTime: { fontSize: 10, fontFamily: fonts.regular, color: MUTED },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  tagText: { fontSize: 9, fontFamily: fonts.semiBold },
  pill: {
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  pillText: { fontSize: 10, fontFamily: fonts.semiBold },
  history: {
    backgroundColor: "#ECF2FF",
    borderRadius: 15,
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
  },
  historyText: { fontSize: 13, color: "#166DF3", fontFamily: fonts.bold },
  empty: { padding: 28, alignItems: "center" },
  emptyText: { color: MUTED, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "#0006", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: "#FFFFFF", padding: 20, borderRadius: 18 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontFamily: fonts.bold, color: DARK },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterOptionText: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: DARK },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 28,
  },
  monthNavText: { fontSize: 16, fontFamily: fonts.semiBold, color: DARK },
  done: { backgroundColor: BLUE, borderRadius: 10, padding: 13, alignItems: "center" },
  doneText: { color: "#FFFFFF", fontFamily: fonts.semiBold },
});