import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  addAppointment,
  createSchedule,
  deleteAppointment,
  getSchedule,
  getTherapistSchedules,
  getUsersByRole,
  updateAppointment,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';

const MAX_APPOINTMENTS_PER_DAY = 2;

const pad = (n) => String(n).padStart(2, "0");

const toTimeString = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const toDateKey = (isoOrDate) => String(isoOrDate).slice(0, 10);

const timeToDate = (dateKey, hhmm) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = String(hhmm).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

const toUser = (u) => ({ id: u._id, name: u.fullName });
const STATUS_STYLES = {
  Complete: { bg: "#E6F4EA", text: "#1E8E3E" },
  Absent: { bg: "#FCE8E6", text: "#D93025" },
  Pending: { bg: "#fdf2cd", text: "#B06000" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusBadgeText, { color: s.text }]}>{status}</Text>
    </View>
  );
};
const mapAppointment = (raw, meta = {}) => {
  const dateKey = toDateKey(raw.date);
  return {
    id: raw._id || raw.id,
    date: dateKey,
    startTime:
      typeof raw.startTime === "string"
        ? timeToDate(dateKey, raw.startTime)
        : raw.startTime,
    endTime:
      typeof raw.endTime === "string"
        ? timeToDate(dateKey, raw.endTime)
        : raw.endTime,
    attendanceStatus: raw.attendance_status || "Pending",
    childName:
      meta.childName ||
      raw.childId?.fullName ||
      raw.childId?.name ||
      "Unknown Child",
    therapistName:
      meta.therapistName ||
      raw.therapistId?.fullName ||
      raw.therapistId?.name ||
      "Unknown Therapist",
    ...meta,
  };
};
const useUserSearch = (role, search, enabled = true,child="") => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return undefined;
    }

    let alive = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await getUsersByRole({ role, search,child });
        if (alive) {
          if (res?.data?.length > 0) {
            setItems(res.data.map(toUser));
          } else {
            setItems([]);
          }
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setItems([]);
          setLoading(false);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [role, search, enabled]);

  return { items, loading };
};

const getInitials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const parseDateKey = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const combineDateAndTime = (date, time) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
  );

export default function ScheduleScreen({ navigation }) {
  const today = new Date();
  const insets = useSafeAreaInsets();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("Scheduling");

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [daySheetDate, setDaySheetDate] = useState(null);

  const [appointments, setAppointments] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);

  const [screenMode, setScreenMode] = useState("main");

  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerStep, setPickerStep] = useState(1);
  const [pickerChildSearch, setPickerChildSearch] = useState("");
  const [pickerTherapistSearch, setPickerTherapistSearch] = useState("");
  const [bookingChild, setBookingChild] = useState(null);
  const [bookingTherapist, setBookingTherapist] = useState(null);

  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeModalDate, setTimeModalDate] = useState(null);
  const [apptStartTime, setApptStartTime] = useState(new Date());
  const [apptEndTime, setApptEndTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000),
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState("start");

  const [editingAppointment, setEditingAppointment] = useState(null);

  const [therapistSearch, setTherapistSearch] = useState("");
  const [mainAppointments, setMainAppointments] = useState([]);
  const [loadingMain, setLoadingMain] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isPastDate = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return d < todayStart;
  };

  const isPastAppointment = (appointment) =>
    appointment ? isPastDate(parseDateKey(appointment.date)) : false;

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    const days = [];

    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), currentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), currentMonth: true });
    }
    while (days.length < 42) {
      const nextDay = days.length - startDay - daysInMonth + 1;
      days.push({
        date: new Date(year, month + 1, nextDay),
        currentMonth: false,
      });
    }
    return days;
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleString("en-US", { month: "long" });

  const previousMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );

  const nextMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );

  const goToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };
  const handleDeleteAppointment = (appointment) => {
    if (isPastAppointment(appointment)) {
      Alert.alert("Action Not Allowed", "Past appointments cannot be deleted.");
      return;
    }

    Alert.alert(
      "Delete Appointment",
      `Are you sure you want to delete this appointment for ${appointment.childName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(appointment.id);
            try {
              const dateObj = parseDateKey(appointment.date);
              await deleteAppointment({
                appointmentId: appointment.id,
                therapistId: appointment.therapistId,
                childId: appointment.childId,
                year: dateObj.getFullYear(),
                month: dateObj.getMonth() + 1,
              });

              if (screenMode === "booking") {
                await loadMonthSchedule();
              }
              await loadAllAppointments();
            } catch (e) {
              Alert.alert(
                "Could not delete",
                e?.response?.data?.message || "Please try again."
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const selectDate = (date) => {
    setSelectedDate(date);
    if (
      date.getMonth() !== currentMonth.getMonth() ||
      date.getFullYear() !== currentMonth.getFullYear()
    ) {
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const isToday = (date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isSelected = (date) =>
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  const { items: filteredPickerChildren, loading: pickerChildLoading } =
    useUserSearch(
      "Child",
      pickerChildSearch,
      showPickerModal && pickerStep === 1,
    );

  const { items: filteredPickerTherapists, loading: pickerTherapistLoading } =
    useUserSearch(
      "Therapist",
      pickerTherapistSearch,
      showPickerModal && pickerStep === 2,
      bookingChild?.id
    );

  const sortedAppointments = useMemo(() => {
    return [...mainAppointments]
      .filter((a) => {
        if (!therapistSearch.trim()) return true;
        const query = therapistSearch.toLowerCase().trim();

        const tName = (a.therapistName || "").toLowerCase();
        const cName = (a.childName || "").toLowerCase();

        return tName.includes(query) || cName.includes(query);
      })
      .sort((a, b) =>
        a.date !== b.date
          ? a.date.localeCompare(b.date)
          : a.startTime - b.startTime,
      );
  }, [mainAppointments, therapistSearch]);

  const daySheetAppointments = useMemo(() => {
    if (!daySheetDate || !bookingChild) return [];

    const key = getDateKey(daySheetDate);
    return appointments
      .filter((a) => a.date === key && a.childId === bookingChild.id)
      .sort((a, b) => a.startTime - b.startTime);
  }, [appointments, daySheetDate, bookingChild]);

  const openPickerFlow = () => {
    setPickerStep(1);
    setBookingChild(null);
    setBookingTherapist(null);
    setPickerChildSearch("");
    setPickerTherapistSearch("");
    setShowPickerModal(true);
  };

  const handlePickChild = (child) => {
    setBookingChild(child);
    setPickerStep(2);
  };

  const handlePickTherapist = (therapist) => {
    setBookingTherapist(therapist);
    setShowPickerModal(false);
    setScreenMode("booking");
  };

  const goBackToMain = () => {
    setScreenMode("main");
    setBookingChild(null);
    setBookingTherapist(null);
    setEditingAppointment(null);
  };

  const openTimeModalForDate = (date) => {
    setEditingAppointment(null);
    setTimeModalDate(date);
    const start = combineDateAndTime(date, new Date());
    setApptStartTime(start);
    setApptEndTime(new Date(start.getTime() + 60 * 60 * 1000));
    setShowTimeModal(true);
  };

  const openTimeModalForEdit = (appointment) => {
    const date = parseDateKey(appointment.date);
    setEditingAppointment(appointment);
    setTimeModalDate(date);
    setApptStartTime(appointment.startTime);
    setApptEndTime(appointment.endTime);
    setShowTimeModal(true);
  };

  const closeTimeModal = () => {
    setShowTimePicker(false);
    setShowTimeModal(false);
    setEditingAppointment(null);
  };
  const loadMonthSchedule = useCallback(async () => {
    if (!bookingChild || !bookingTherapist) return;

    const params = {
      therapistId: bookingTherapist.id,
      childId: bookingChild.id,
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth() + 1,
    };

    setLoadingSchedule(true);
    try {
      const res = await getSchedule(params);
      const list = res?.data?.appointments ?? [];
      setAppointments(
        list.map((raw) =>
          mapAppointment(raw, {
            childId: bookingChild.id,
            therapistId: bookingTherapist.id,
            childName: bookingChild.name,
            therapistName: bookingTherapist.name,
          }),
        ),
      );
    } catch (e) {
      // 404 just means no schedule document for this month yet
      if (e?.response?.status === 404) setAppointments([]);
      else
        Alert.alert(
          "Could not load schedule",
          e?.response?.data?.message || "Please try again.",
        );
    } finally {
      setLoadingSchedule(false);
    }
  }, [bookingChild, bookingTherapist, currentMonth]);

  useEffect(() => {
    loadMonthSchedule();
  }, [loadMonthSchedule]);
  const saveTimeAppointment = async () => {
    if (!timeModalDate || !bookingChild || !bookingTherapist) return;

    const start = combineDateAndTime(timeModalDate, apptStartTime);
    const end = combineDateAndTime(timeModalDate, apptEndTime);

    if (end <= start) {
      Alert.alert("Check the time", "End time must be after start time.");
      return;
    }

    const dateKey = getDateKey(timeModalDate);
    const base = {
      therapistId: bookingTherapist.id,
      childId: bookingChild.id,
      year: timeModalDate.getFullYear(),
      month: timeModalDate.getMonth() + 1,
    };
    if (editingAppointment && isPastAppointment(editingAppointment)) {
      return;
    }
    setSaving(true);
    try {
      if (editingAppointment) {
        if (isPastAppointment(editingAppointment)) return;

        await updateAppointment({
          ...base,
          appointmentId: editingAppointment.id,
          date: dateKey,
          startTime: toTimeString(start),
          endTime: toTimeString(end),
        });
      } else {
        if (
          appointments.filter((a) => a.date === dateKey).length >=
          MAX_APPOINTMENTS_PER_DAY
        ) {
          Alert.alert(
            "Day is full",
            `Only ${MAX_APPOINTMENTS_PER_DAY} appointments are allowed per day.`,
          );
          return;
        }

        await createSchedule(base);

        await addAppointment({
          ...base,
          date: dateKey,
          startTime: toTimeString(start),
          endTime: toTimeString(end),
        });
      }

      await loadMonthSchedule();
      closeTimeModal();
    } catch (e) {
      Alert.alert(
        "Could not save",
        e?.response?.data?.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const loadAllAppointments = useCallback(async () => {
    setLoadingMain(true);

    try {
      const res = await getTherapistSchedules();

      const schedules = res?.data ?? [];

      const flat = schedules.flatMap((schedule) =>
        (schedule.appointments ?? []).map((raw) =>
          mapAppointment(raw, {
            childId: schedule.childId?._id ?? schedule.childId,
            therapistId: schedule.therapistId?._id ?? schedule.therapistId,
            childName: schedule.childId?.fullName ?? "Unknown Child",
            therapistName:
              schedule.therapistId?.fullName ?? "Unknown Therapist",
          }),
        ),
      );

      setMainAppointments(flat);
    } catch (e) {
      console.error("Load all appointments error:", e);
      setMainAppointments([]);
    } finally {
      setLoadingMain(false);
    }
  }, []);
  useEffect(() => {
    loadAllAppointments();
  }, [loadAllAppointments]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllAppointments();
    setRefreshing(false);
  }, [loadAllAppointments]);

  const openAppointmentInCalendar = (appointment) => {
    const date = parseDateKey(appointment.date);

    setBookingChild({ id: appointment.childId, name: appointment.childName });
    setBookingTherapist({
      id: appointment.therapistId,
      name: appointment.therapistName,
    });
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDate(date);
    setScreenMode("booking");
    openTimeModalForEdit(appointment);
  };

  const handleBookingDatePress = (
    date,
    dayPairAppointments,
    dayAllAppointments,
  ) => {
    if (dayPairAppointments.length > 0) {
      selectDate(date);
      setDaySheetDate(date);
      setShowDaySheet(true);
      return;
    }

    if (isPastDate(date)) return;

    if (dayAllAppointments.length >= MAX_APPOINTMENTS_PER_DAY) {
      Alert.alert(
        "Day is full",
        `Only ${MAX_APPOINTMENTS_PER_DAY} appointments are allowed per day.`,
      );
      return;
    }

    selectDate(date);
    openTimeModalForDate(date);
  };
  const openFromDaySheet = (fn) => {
    setShowDaySheet(false);
    setTimeout(fn, 250);
  };

  const editFromDaySheet = (appointment) =>
    openFromDaySheet(() => openTimeModalForEdit(appointment));

  const addFromDaySheet = () => {
    if (!daySheetDate) return;
    const key = getDateKey(daySheetDate);
    const count = appointments.filter((a) => a.date === key).length;

    if (count >= MAX_APPOINTMENTS_PER_DAY) {
      Alert.alert(
        "Day is full",
        `Only ${MAX_APPOINTMENTS_PER_DAY} appointments are allowed per day.`,
      );
      return;
    }
    openFromDaySheet(() => openTimeModalForDate(daySheetDate));
  };

  const renderTimeModal = () => {
    const isUpdate = !!editingAppointment;
    const isLocked = isUpdate && isPastAppointment(editingAppointment);

    return (
      <Modal
        visible={showTimeModal}
        transparent
        animationType="slide"
        onRequestClose={closeTimeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isUpdate ? "Update Appointment" : "Appointment Time"}
                </Text>
                <Text style={styles.modalDate}>
                  {bookingChild?.name} with {bookingTherapist?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={closeTimeModal}>
                <Feather name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Date</Text>
            <View style={styles.dateDisplayBox}>
              <Feather name="calendar" size={16} color="#4285F4" />
              <Text style={styles.dateDisplayText}>
                {timeModalDate
                  ? timeModalDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : ""}
              </Text>
            </View>

            <Text style={styles.label}>Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[
                  styles.dateTimeCard,
                  isLocked && styles.dateTimeCardLocked,
                ]}
                disabled={isLocked}
                onPress={() => {
                  setTimePickerTarget("start");
                  setShowTimePicker(true);
                }}
              >
                <Feather
                  name="clock"
                  size={16}
                  color={isLocked ? "#A0A6B0" : "#4285F4"}
                />
                <View>
                  <Text style={styles.dateTimeLabel}>Start</Text>
                  <Text style={styles.dateTimeValue}>
                    {apptStartTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateTimeCard,
                  isLocked && styles.dateTimeCardLocked,
                ]}
                disabled={isLocked}
                onPress={() => {
                  setTimePickerTarget("end");
                  setShowTimePicker(true);
                }}
              >
                <Feather
                  name="clock"
                  size={16}
                  color={isLocked ? "#A0A6B0" : "#4285F4"}
                />
                <View>
                  <Text style={styles.dateTimeLabel}>End</Text>
                  <Text style={styles.dateTimeValue}>
                    {apptEndTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {showTimePicker && !isLocked && (
              <DateTimePicker
                value={
                  timePickerTarget === "start" ? apptStartTime : apptEndTime
                }
                mode="time"
                display="default"
                onValueChange={(event, selected) => {
                  setShowTimePicker(false);
                  if (selected) {
                    if (timePickerTarget === "start")
                      setApptStartTime(selected);
                    else setApptEndTime(selected);
                  }
                }}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (isLocked || saving) && styles.saveButtonDisabled,
                ]}
                disabled={isLocked || saving}
                onPress={saveTimeAppointment}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#9AA2AE" />
                ) : (
                  <Text
                    style={[
                      styles.saveText,
                      isLocked && styles.saveTextDisabled,
                    ]}
                  >
                    {isUpdate ? "Update" : "Save"}
                  </Text>
                )}
              </TouchableOpacity>

              {isLocked && (
                <View style={styles.lockedNotice}>
                  <Feather name="lock" size={13} color="#94A3B8" />
                  <Text style={styles.lockedNoticeText}>
                    This date has passed, so the time can no longer be changed.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };
  const renderDaySheet = () => {
    const dayIsPast = daySheetDate ? isPastDate(daySheetDate) : false;
    const dayKey = daySheetDate ? getDateKey(daySheetDate) : null;
    const dayTotal = dayKey
      ? appointments.filter((a) => a.date === dayKey).length
      : 0;
    const canAdd = !dayIsPast && dayTotal < MAX_APPOINTMENTS_PER_DAY;

    return (
      <Modal
        visible={showDaySheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDaySheet(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {daySheetDate
                    ? daySheetDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : ""}
                </Text>
                <Text style={styles.modalDate}>
                  {daySheetAppointments.length} of {MAX_APPOINTMENTS_PER_DAY}{" "}
                  booked
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDaySheet(false)}>
                <Feather name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {daySheetAppointments.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.daySheetItem}
                onPress={() => editFromDaySheet(a)}
                activeOpacity={0.7}
              >
                <View style={styles.daySheetTimeBox}>
                  <Feather name="clock" size={15} color="#4285F4" />
                </View>

                <View style={styles.daySheetInfo}>
                  <Text style={styles.daySheetTime}>
                    {a.startTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {a.endTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>

                  <Text style={styles.daySheetName} numberOfLines={1}>
                    {a.childName} with {a.therapistName}
                  </Text>
                </View>

                {isPastAppointment(a) ? (
                  <Feather name="lock" size={15} color="#B0B6C0" />
                ) : (
                  <>
                    {/* EDIT */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        editFromDaySheet(a);
                      }}
                      hitSlop={8}
                    >
                      <Feather name="edit-2" size={15} color="#4285F4" />
                    </TouchableOpacity>

                    {/* DELETE */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteAppointment(a);
                      }}
                      disabled={deletingId === a.id}
                      hitSlop={8}
                    >
                      {deletingId === a.id ? (
                        <ActivityIndicator size="small" color="#f03029" />
                      ) : (
                        <Feather name="trash-2" size={15} color="#f03029" />
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            ))}

            {canAdd && (
              <TouchableOpacity
                style={styles.daySheetAdd}
                onPress={addFromDaySheet}
              >
                <Feather name="plus" size={16} color="#4285F4" />
                <Text style={styles.daySheetAddText}>
                  Add another appointment
                </Text>
              </TouchableOpacity>
            )}

            {dayIsPast && (
              <View style={styles.lockedNotice}>
                <Feather name="lock" size={13} color="#94A3B8" />
                <Text style={styles.lockedNoticeText}>
                  This date has passed. Appointments can be opened but not
                  changed.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const renderPickerModal = () => (
    <Modal
      visible={showPickerModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPickerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={styles.pickerHeaderLeft}>
              {pickerStep === 2 && (
                <TouchableOpacity
                  onPress={() => setPickerStep(1)}
                  style={styles.pickerBackIcon}
                >
                  <Feather name="arrow-left" size={20} color="#333" />
                </TouchableOpacity>
              )}
              <Text style={styles.modalTitle}>
                {pickerStep === 1 ? "Select Child" : "Select Therapist"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowPickerModal(false)}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.stepDots}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View
              style={[styles.stepDot, pickerStep === 2 && styles.stepDotActive]}
            />
          </View>

          {pickerStep === 1 ? (
            <View>
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchBoxInput}
                  placeholder="Search child..."
                  value={pickerChildSearch}
                  onChangeText={setPickerChildSearch}
                />
              </View>
              {pickerChildLoading && (
                <ActivityIndicator
                  size="small"
                  color="#4285F4"
                  style={{ marginVertical: 8 }}
                />
              )}
              <ScrollView
                style={styles.pickList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredPickerChildren.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>No children found</Text>
                  </View>
                ) : (
                  filteredPickerChildren.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.pickItem}
                      onPress={() => handlePickChild(c)}
                    >
                      <View style={styles.therapistAvatarCircle}>
                        <Text style={styles.therapistAvatarText}>
                          {getInitials(c.name)}
                        </Text>
                      </View>
                      <Text style={styles.pickItemText}>{c.name}</Text>
                      <Feather name="chevron-right" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          ) : (
            <View>
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchBoxInput}
                  placeholder="Search therapist..."
                  value={pickerTherapistSearch}
                  onChangeText={setPickerTherapistSearch}
                />
              </View>
              {pickerTherapistLoading && (
                <ActivityIndicator
                  size="small"
                  color="#4285F4"
                  style={{ marginVertical: 8 }}
                />
              )}

              <ScrollView
                style={styles.pickList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredPickerTherapists.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>No therapists found</Text>
                  </View>
                ) : (
                  filteredPickerTherapists.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.pickItem}
                      onPress={() => handlePickTherapist(t)}
                    >
                      <View style={styles.therapistAvatarCircle}>
                        <Text style={styles.therapistAvatarText}>
                          {getInitials(t.name)}
                        </Text>
                      </View>
                      <Text style={styles.pickItemText}>{t.name}</Text>
                      <Feather name="chevron-right" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (screenMode === "booking" && bookingChild && bookingTherapist) {
    const pairAppointments = appointments.filter(
      (a) =>
        a.childId === bookingChild.id && a.therapistId === bookingTherapist.id,
    );

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.bookingHeader}>
          <TouchableOpacity
            onPress={goBackToMain}
            style={styles.bookingHeaderIcon}
          >
            <Feather name="arrow-left" size={22} color="#222" />
          </TouchableOpacity>

          <View style={styles.bookingHeaderTitleWrap}>
            <Text style={styles.bookingHeaderTitle} numberOfLines={1}>
              {bookingChild.name}
            </Text>
            <Text style={styles.bookingHeaderSubtitle} numberOfLines={1}>
              with {bookingTherapist.name}
            </Text>
          </View>

          <TouchableOpacity
            onPress={goBackToMain}
            style={styles.bookingHeaderIcon}
          >
            <Feather name="x" size={22} color="#222" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.monthHeader}>
            <View>
              <Text style={styles.monthTitle}>{monthName}</Text>
              <Text style={styles.yearText}>{currentMonth.getFullYear()}</Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.todayButton} onPress={goToday}>
                <Text style={styles.todayText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.arrowButton}
                onPress={previousMonth}
              >
                <Feather name="chevron-left" size={22} color="#333" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.arrowButton} onPress={nextMonth}>
                <Feather name="chevron-right" size={22} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <View key={day} style={styles.weekDay}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((item, index) => {
              const date = item.date;
              const dateKey = getDateKey(date);
              const dayPairAppointments = pairAppointments.filter(
                (a) => a.date === dateKey,
              );
              const dayAllAppointments = appointments.filter(
                (a) => a.date === dateKey,
              );
              const todayDate = isToday(date);
              const selected = isSelected(date);
              const pastNoAppt =
                isPastDate(date) && dayPairAppointments.length === 0;

              return (
                <TouchableOpacity
                  key={`${dateKey}-${index}`}
                  style={[
                    styles.dayCell,
                    !item.currentMonth && styles.otherMonthCell,
                    selected && styles.selectedCell,
                    pastNoAppt && styles.disabledDayCell,
                  ]}
                  onPress={() =>
                    handleBookingDatePress(
                      date,
                      dayPairAppointments,
                      dayAllAppointments,
                    )
                  }
                  activeOpacity={pastNoAppt ? 1 : 0.7}
                >
                  <View
                    style={[
                      styles.dateCircle,
                      todayDate && styles.todayCircle,
                      selected && !todayDate && styles.selectedDateCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateText,
                        !item.currentMonth && styles.otherMonthText,
                        todayDate && styles.todayDateText,
                        selected && !todayDate && styles.selectedDateText,
                        pastNoAppt && styles.disabledDateText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>

                  {dayPairAppointments.length > 0 && (
                    <View style={styles.eventsContainer}>
                      {dayPairAppointments.slice(0, 2).map((a) => (
                        <View
                          key={a.id}
                          style={[
                            styles.eventChip,
                            selected && styles.selectedEventChip,
                            isPastAppointment(a) && styles.pastEventChip,
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.eventText,
                              selected && styles.selectedEventText,
                            ]}
                          >
                            {a.startTime.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {renderTimeModal()}
        {renderDaySheet()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle="Manage Schedule"
      />

      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#777" />
        <TextInput
          value={therapistSearch}
          onChangeText={setTherapistSearch}
          placeholder="Search therapist..."
          placeholderTextColor="#999"
          style={styles.searchInput}
        />
        {therapistSearch.length > 0 && (
          <TouchableOpacity onPress={() => setTherapistSearch("")}>
            <Feather name="x" size={18} color="#777" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.apptListScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingMain}
            onRefresh={onRefresh}
            colors={["#4285F4"]}
            tintColor="#4285F4"
          />
        }
      >
        {sortedAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather
              name={therapistSearch.trim() ? "search" : "calendar"}
              size={30}
              color="#C4C4C4"
            />

            <Text style={styles.emptyStateTitle}>
              {therapistSearch.trim()
                ? "No matches found"
                : "No appointments yet"}
            </Text>

            <Text style={styles.emptyStateText}>
              {therapistSearch.trim()
                ? `Nothing matches "${therapistSearch.trim()}"`
                : "Tap + to book one"}
            </Text>
          </View>
        ) : (
          sortedAppointments.map((a) => {
            const d = parseDateKey(a.date);
            const past = isPastAppointment(a);

            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.apptCard, past && styles.apptCardPast]}
                onPress={() => openAppointmentInCalendar(a)}
              >
                <View
                  style={[
                    styles.apptCardDateBox,
                    past && styles.apptCardDateBoxPast,
                  ]}
                >
                  <Text style={styles.apptCardDay}>{d.getDate()}</Text>
                  <Text style={styles.apptCardMonth}>
                    {d.toLocaleDateString("en-US", { month: "short" })}
                  </Text>
                </View>

                <View style={styles.apptCardInfo}>
                  <Text style={styles.apptCardTitle} numberOfLines={1}>
                    {a.childName} with {a.therapistName}
                  </Text>

                  <View style={styles.apptCardTimeRow}>
                    <Text style={styles.apptCardTime}>
                      {a.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" - "}
                      {a.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>

                    <StatusBadge status={a.attendanceStatus} />
                  </View>
                </View>

                {past && <Feather name="lock" size={14} color="#B0B6C0" />}
                <Feather name="chevron-right" size={18} color="#C4C4C4" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.floatingButton, { bottom: insets.bottom + 90 }]}
        activeOpacity={0.8}
        onPress={openPickerFlow}
      >
        <Feather name="plus" size={30} color="#fff" />
      </TouchableOpacity>

      {renderPickerModal()}

      <BottomBar
        activeTab="Schedule"
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FAFAFA",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#222",
  },
  therapistResults: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
    maxHeight: 220,
    overflow: "hidden",
  },
  therapistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
  },
  therapistAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  therapistAvatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  therapistName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  apptListScroll: {
    flex: 1,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  apptCardPast: {
    backgroundColor: "#FAFAFA",
    borderColor: "#EDEDED",
  },
  apptCardDateBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  apptCardDateBoxPast: {
    backgroundColor: "#A9B4C2",
  },
  apptCardDay: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  apptCardMonth: {
    fontSize: 10,
    fontWeight: "600",
    color: "#DCE8FF",
    textTransform: "uppercase",
  },
  apptCardInfo: {
    flex: 1,
  },
  apptCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
  },
  apptCardTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 8,
  },
  apptCardTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#777",
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 12,
    color: "#A0A0A0",
    marginTop: 3,
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
  },
  monthHeader: {
    height: 62,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#202124",
  },
  yearText: {
    fontSize: 12,
    color: "#777",
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  todayButton: {
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  todayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  arrowButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  weekRow: {
    flexDirection: "row",
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  weekDay: {
    width: "14.2857%",
    justifyContent: "center",
    alignItems: "center",
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6B6B",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: "#E4E6EA",
  },
  dayCell: {
    width: "14.2857%",
    height: 82,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E4E6EA",
    paddingTop: 6,
    alignItems: "center",
  },
  otherMonthCell: {
    backgroundColor: "#FAFAFA",
  },
  selectedCell: {
    backgroundColor: "#F8FAFF",
  },
  disabledDayCell: {
    backgroundColor: "#FAFAFA",
    opacity: 0.45,
  },
  dateCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dateText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#30343B",
  },
  otherMonthText: {
    color: "#A9ADB3",
  },
  disabledDateText: {
    color: "#C4C4C4",
  },
  todayCircle: {
    backgroundColor: "#4285F4",
  },
  todayDateText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  selectedDateCircle: {
    backgroundColor: "#DCE8FF",
  },
  selectedDateText: {
    color: "#1A73E8",
    fontWeight: "700",
  },
  eventsContainer: {
    width: "100%",
    paddingHorizontal: 3,
    marginTop: 2,
  },
  eventChip: {
    height: 20,
    backgroundColor: "#35AFA0",
    borderRadius: 5,
    paddingHorizontal: 5,
    justifyContent: "center",
    marginBottom: 2,
  },
  pastEventChip: {
    backgroundColor: "#AEB8C2",
  },
  eventText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  selectedEventChip: {
    backgroundColor: "#EEF1FF",
    borderWidth: 1,
    borderColor: "#7584D8",
  },
  selectedEventText: {
    color: "#3949AB",
  },
  floatingButton: {
    position: "absolute",
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  bookingHeader: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  bookingHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  bookingHeaderTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  bookingHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
  },
  bookingHeaderSubtitle: {
    fontSize: 11,
    color: "#888",
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 30,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  pickerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerBackIcon: {
    padding: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
  },
  modalDate: {
    fontSize: 12,
    color: "#888",
    marginTop: 3,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 18,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E5E5",
  },
  stepDotActive: {
    backgroundColor: "#4285F4",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
  },
  dateDisplayBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FAFAFA",
    marginBottom: 15,
  },
  dateDisplayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },
  dateTimeCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  dateTimeCardLocked: {
    backgroundColor: "#F1F3F6",
    borderColor: "#E0E3E8",
  },
  dateTimeLabel: {
    fontSize: 10,
    color: "#64748B",
  },
  dateTimeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
    marginBottom: 10,
  },
  searchBoxInput: {
    flex: 1,
    fontSize: 14,
    color: "#222",
  },
  pickList: {
    maxHeight: 320,
  },
  pickItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    marginBottom: 6,
  },
  pickItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  modalActions: {
    marginTop: 4,
  },
  saveButton: {
    height: 46,
    backgroundColor: "#4285F4",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#E3E6EB",
  },
  saveText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  saveTextDisabled: {
    color: "#9AA2AE",
  },
  lockedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: 11,
    color: "#94A3B8",
  },
  daySheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
  },
  daySheetTimeBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DCE8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  daySheetInfo: {
    flex: 1,
  },
  daySheetTime: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
  },
  daySheetName: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  daySheetAdd: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#4285F4",
    marginTop: 2,
  },
  daySheetAddText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4285F4",
  },
  emptyStateContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 7,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
