import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import {
  getAttendanceApi,
  updateAttendanceStatusApi,
} from '../../api/therapist/api';
import { fonts } from '../../styles/theme';

const BLUE = "#075BB8";
const DARK = "#10243D";
const MUTED = "#8A9DBA";

const pad = (n) => String(n).padStart(2, "0");

const dateKey = (date) => {
  const d = new Date(date);

  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
  ].join("-");
};

const addDays = (date, count) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + count
  );

const startWeek = (date) =>
  addDays(date, -((date.getDay() + 6) % 7));

const sameDate = (a, b) =>
  dateKey(a) === dateKey(b);

const time12 = (time) => {
  if (!time) return "--";

  const [h, m] = String(time).split(":").map(Number);

  if (!Number.isFinite(h)) return time;

  return `${h % 12 || 12}:${pad(m || 0)} ${
    h >= 12 ? "PM" : "AM"
  }`;
};

const getMonthWeeks = (month) => {
  const lastDay = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

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
  const [year, month, day] = item.date
    .split("-")
    .map(Number);

  const [hours, minutes] = String(
    item.startTime || "00:00"
  )
    .split(":")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    hours || 0,
    minutes || 0
  );
};

const formatAttendanceDate = (dateString) => {
  if (!dateString) return "--";

  // Parse YYYY-MM-DD without timezone shifting
  const [year, month, day] = dateString
    .slice(0, 10)
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function AttendanceTrackingScreen({ route }) {
  const [mode, setMode] = useState(
    route?.params?.filterType === "today"
      ? "Today"
      : "Week"
  );

  const [selectedDate, setSelectedDate] = useState(
    new Date()
  );

  const [month, setMonth] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  const [weekIndex, setWeekIndex] = useState(
    Math.floor((new Date().getDate() - 1) / 7)
  );

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(null);

  const [full, setFull] = useState(false);
  const [monthPicker, setMonthPicker] = useState(false);

  const [childFilterVisible, setChildFilterVisible] =
    useState(false);

  const [selectedChildId, setSelectedChildId] =
    useState(null);

  const [childSearch, setChildSearch] = useState("");

  const weeks = useMemo(
    () => getMonthWeeks(month),
    [month]
  );

  // ========================================
  // FETCH ATTENDANCE
  // ========================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        mode: mode.toLowerCase(),
        date: dateKey(selectedDate),
      };

      const response = await getAttendanceApi(params);

      const result = response?.data?.success
        ? response.data
        : response;

      if (!result?.success) {
        throw new Error(
          result?.message ||
          "Failed to fetch attendance"
        );
      }

      setRecords(result.data || []);
    } catch (error) {
      console.error("Attendance error:", error);

      Alert.alert(
        "Attendance",
        error?.response?.data?.message ||
          error.message ||
          "Unable to fetch attendance."
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

      setMonth(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        )
      );
    }
  }, [route?.params?.filterType]);

  // ========================================
  // MODE AND DATE SELECTION
  // ========================================

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setFull(false);

    if (
      nextMode === "Today" ||
      nextMode === "Tomorrow"
    ) {
      const date = addDays(
        new Date(),
        nextMode === "Tomorrow" ? 1 : 0
      );

      setSelectedDate(date);

      setMonth(
        new Date(
          date.getFullYear(),
          date.getMonth(),
          1
        )
      );
    } else if (nextMode === "Month") {
      setWeekIndex(
        Math.floor(
          (selectedDate.getDate() - 1) / 7
        )
      );
    }
  };

  const chooseDate = (date) => {
    setSelectedDate(date);

    setMonth(
      new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      )
    );

    setFull(false);
  };

  const moveMonth = (direction) => {
    const date = new Date(
      month.getFullYear(),
      month.getMonth() + direction,
      1
    );

    setMonth(date);
    setSelectedDate(date);
    setWeekIndex(0);
  };

  // ========================================
  // DAYS
  // ========================================

  const days = useMemo(() => {
    if (
      mode === "Today" ||
      mode === "Tomorrow"
    ) {
      return [];
    }

    if (mode === "Week") {
      return Array.from(
        { length: 7 },
        (_, index) =>
          addDays(
            startWeek(selectedDate),
            index
          )
      );
    }

    const week = weeks[
      Math.min(weekIndex, weeks.length - 1)
    ];

    if (!week) return [];

    return Array.from(
      {
        length:
          week.end - week.start + 1,
      },
      (_, index) =>
        new Date(
          month.getFullYear(),
          month.getMonth(),
          week.start + index
        )
    );
  }, [
    mode,
    selectedDate,
    month,
    weekIndex,
    weeks,
  ]);

  // ========================================
  // FILTER CHILDREN
  // ========================================

  const childOptions = useMemo(() => {
    const map = new Map();

    records.forEach((item) => {
      if (!map.has(item.childId)) {
        map.set(item.childId, {
          childId: item.childId,
          childName: item.childName,
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        a.childName.localeCompare(
          b.childName
        )
    );
  }, [records]);

  const filteredModalChildren = useMemo(() => {
    const search = childSearch
      .trim()
      .toLowerCase();

    return childOptions.filter((item) =>
      item.childName
        .toLowerCase()
        .includes(search)
    );
  }, [childOptions, childSearch]);

  const filteredRecords = useMemo(() => {
    if (!selectedChildId) {
      return records;
    }

    return records.filter(
      (item) =>
        item.childId === selectedChildId
    );
  }, [records, selectedChildId]);

  const shown = full
    ? filteredRecords
    : filteredRecords.slice(0, 5);

  // ========================================
  // UPDATE ATTENDANCE
  // ========================================

  const update = async (
    item,
    targetStatus
  ) => {
    if (updating) return;

    if (
      !item.attendanceId ||
      !item.appointmentId
    ) {
      return;
    }

    const appointmentDateTime =
      getAppointmentDateTime(item);

    if (
      appointmentDateTime > new Date()
    ) {
      Alert.alert(
        "Not Allowed",
        "You cannot mark future attendance."
      );
      return;
    }

    const nextStatus =
      item.attendanceStatus === targetStatus
        ? "Pending"
        : targetStatus;

    const updateId =
      `${item.attendanceId}:${item.appointmentId}:${item.childId}`;

    setUpdating(updateId);

    try {
      const response =
        await updateAttendanceStatusApi({
          attendanceId:
            item.attendanceId,
          appointmentId:
            item.appointmentId,
          childId: item.childId,
          status: nextStatus,
        });

      const result = response?.data?.success
        ? response.data
        : response;

      if (!result?.success) {
        throw new Error(
          result?.message ||
          "Update failed"
        );
      }

      setRecords((previous) =>
        previous.map((record) => {
          if (
            record.attendanceId ===
              item.attendanceId &&
            record.appointmentId ===
              item.appointmentId &&
            record.childId ===
              item.childId
          ) {
            return {
              ...record,
              attendanceStatus:
                nextStatus,
            };
          }

          return record;
        })
      );
    } catch (error) {
      Alert.alert(
        "Update Failed",
        error?.response?.data?.message ||
          error.message ||
          "Unable to update attendance."
      );
    } finally {
      setUpdating(null);
    }
  };

  const dayHeader =
    selectedDate.toLocaleDateString(
      "en-US",
      {
        weekday: "short",
        month: "long",
        day: "2-digit",
        year: "numeric",
      }
    );

  // ========================================
  // RENDER
  // ========================================

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
      >
        {/* MONTH HEADER */}

        <View style={styles.banner}>
          <TouchableOpacity
            onPress={() =>
              setMonthPicker(true)
            }
            style={styles.bannerLeft}
          >
            <Feather
              name="calendar"
              size={20}
              color="#FFFFFF"
            />

            <Text
              style={styles.bannerTitle}
            >
              {month.toLocaleDateString(
                "en-US",
                {
                  month: "long",
                  year: "numeric",
                }
              )}
            </Text>

            <Feather
              name="chevron-down"
              size={17}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View
            style={styles.statusHeader}
          >
            <Text
              style={
                styles.statusHeaderText
              }
            >
              Status
            </Text>
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
              onPress={() =>
                changeMode(value)
              }
              style={[
                styles.modeBtn,
                mode === value &&
                  styles.modeActive,
              ]}
            >
              <Feather
                name={icon}
                size={20}
                color={
                  mode === value
                    ? "#FFFFFF"
                    : "#60718A"
                }
              />

              <Text
                style={[
                  styles.modeText,
                  mode === value && {
                    color: "#FFFFFF",
                  },
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* MONTH WEEKS */}

        {mode === "Month" && (
          <View style={styles.weekRow}>
            {weeks.map(
              (week, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setWeekIndex(index);

                    chooseDate(
                      new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        week.start
                      )
                    );
                  }}
                  style={[
                    styles.weekBtn,
                    weekIndex === index &&
                      styles.weekActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekTitle,
                      weekIndex === index && {
                        color: "#FFFFFF",
                      },
                    ]}
                  >
                    {week.label}
                  </Text>

                  <Text
                    style={[
                      styles.weekRange,
                      weekIndex === index && {
                        color: "#DDEAFF",
                      },
                    ]}
                  >
                    {pad(week.start)} -{" "}
                    {pad(week.end)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {/* DATE SELECTOR */}

        {days.length > 0 && (
          <View style={styles.daysRow}>
            {days.map((day) => {
              const selected =
                sameDate(
                  day,
                  selectedDate
                );

              return (
                <TouchableOpacity
                  key={dateKey(day)}
                  onPress={() =>
                    chooseDate(day)
                  }
                  style={[
                    styles.dayBtn,
                    selected &&
                      styles.dayActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayName,
                      selected && {
                        color: "#DBEAFE",
                      },
                    ]}
                  >
                    {day.toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                      }
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.dayNumber,
                      selected && {
                        color: "#FFFFFF",
                      },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ATTENDANCE HEADER */}

        <View
          style={styles.sectionHeader}
        >
          <Text
            style={styles.sectionTitle}
          >
            {dayHeader}
          </Text>

          <Text style={styles.count}>
            {filteredRecords.length}{" "}
            Appointments
          </Text>

          <TouchableOpacity
            style={styles.refresh}
            onPress={() =>
              setChildFilterVisible(
                true
              )
            }
          >
            <Feather
              name="sliders"
              size={16}
              color="#60718A"
            />
          </TouchableOpacity>
        </View>

        {/* ATTENDANCE LIST */}

        {loading ? (
          <ActivityIndicator
            size="small"
            color={BLUE}
            style={{
              marginTop: 35,
            }}
          />
        ) : shown.length === 0 ? (
          <View
            style={styles.empty}
          >
            <Text
              style={styles.emptyText}
            >
              No scheduled appointments
              for this date
            </Text>
          </View>
        ) : (
          shown.map((item) => {
            const present =
              item.attendanceStatus ===
              "Present";

            const absent =
              item.attendanceStatus ===
              "Absent";

            const future =
              getAppointmentDateTime(
                item
              ) > new Date();

            const profileUri =
              typeof item.profileImage ===
              "string"
                ? item.profileImage
                : item.profileImage?.url;

            const rowId =
              `${item.attendanceId}:${item.appointmentId}:${item.childId}`;

            return (
              <View
                key={rowId}
                style={
                  styles.childCard
                }
              >
                {profileUri ? (
                  <Image
                    source={{
                      uri: profileUri,
                    }}
                    style={
                      styles.avatar
                    }
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                    ]}
                  >
                    <Feather
                      name="user"
                      size={23}
                      color="#7489A2"
                    />
                  </View>
                )}

<View style={styles.childInfo}>
  <Text
    style={styles.childName}
    numberOfLines={2}
  >
    {item.childName}
  </Text>

  {/* Appointment Date */}
  <View style={styles.childDateRow}>
    <Feather
      name="calendar"
      size={12}
      color="#075BB8"
    />

    <Text style={styles.childDate}>
      {formatAttendanceDate(item.date)}
    </Text>
  </View>

  {/* Appointment Time */}
  <View style={styles.childTimeRow}>
    <Feather
      name="clock"
      size={12}
      color="#8A9DBA"
    />

    <Text style={styles.childTime}>
      {time12(item.startTime)} - {time12(item.endTime)}
    </Text>
  </View>
</View>
                <View
                  style={
                    styles.controls
                  }
                >
                  <TouchableOpacity
                    disabled={
                      future ||
                      !!updating
                    }
                    onPress={() =>
                      update(
                        item,
                        "Present"
                      )
                    }
                    style={[
                      styles.control,
                      present &&
                        styles.presentControl,
                    ]}
                  >
                    <Feather
                      name="check"
                      size={15}
                      color={
                        present
                          ? "#FFFFFF"
                          : "#B4C2D2"
                      }
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={
                      future ||
                      !!updating
                    }
                    onPress={() =>
                      update(
                        item,
                        "Absent"
                      )
                    }
                    style={[
                      styles.control,
                      absent &&
                        styles.absentControl,
                    ]}
                  >
                    <Feather
                      name="x"
                      size={15}
                      color={
                        absent
                          ? "#FFFFFF"
                          : "#B4C2D2"
                      }
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.pill,
                    present
                      ? styles.pillPresent
                      : absent
                      ? styles.pillAbsent
                      : styles.pillPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: present
                          ? "#009D73"
                          : absent
                          ? "#E23838"
                          : "#BD7400",
                      },
                    ]}
                  >
                    {future
                      ? "Not Yet"
                      : item.attendanceStatus}
                  </Text>
                </View>

                {updating ===
                  rowId && (
                  <ActivityIndicator
                    size="small"
                    color={BLUE}
                  />
                )}
              </View>
            );
          })
        )}

        {!loading &&
          filteredRecords.length > 5 && (
            <TouchableOpacity
              onPress={() =>
                setFull(!full)
              }
              style={
                styles.history
              }
            >
              <Text
                style={
                  styles.historyText
                }
              >
                {full
                  ? "Hide Full History"
                  : "View Full History ›"}
              </Text>
            </TouchableOpacity>
          )}
      </ScrollView>

      {/* CHILD FILTER MODAL */}

      <Modal
        transparent
        visible={
          childFilterVisible
        }
        animationType="fade"
        onRequestClose={() =>
          setChildFilterVisible(
            false
          )
        }
      >
        <View
          style={styles.overlay}
        >
          <View
            style={styles.modal}
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                Filter Children
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setChildFilterVisible(
                    false
                  )
                }
              >
                <Feather
                  name="x"
                  size={22}
                  color={DARK}
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.searchBox
              }
            >
              <Feather
                name="search"
                size={18}
                color={MUTED}
              />

              <TextInput
                style={
                  styles.searchInput
                }
                placeholder="Search child name..."
                placeholderTextColor={
                  MUTED
                }
                value={
                  childSearch
                }
                onChangeText={
                  setChildSearch
                }
              />
            </View>

            <ScrollView
              style={{
                maxHeight: 350,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={
                  styles.filterOption
                }
                onPress={() => {
                  setSelectedChildId(
                    null
                  );

                  setChildFilterVisible(
                    false
                  );
                }}
              >
                <Feather
                  name="users"
                  size={20}
                  color={BLUE}
                />

                <Text
                  style={
                    styles.filterOptionText
                  }
                >
                  All Children
                </Text>

                {!selectedChildId && (
                  <Feather
                    name="check-circle"
                    size={20}
                    color={BLUE}
                  />
                )}
              </TouchableOpacity>

              {filteredModalChildren.map(
                (child) => (
                  <TouchableOpacity
                    key={
                      child.childId
                    }
                    style={
                      styles.filterOption
                    }
                    onPress={() => {
                      setSelectedChildId(
                        child.childId
                      );

                      setChildFilterVisible(
                        false
                      );

                      setFull(false);
                    }}
                  >
                    <Feather
                      name="user"
                      size={20}
                      color={BLUE}
                    />

                    <Text
                      style={
                        styles.filterOptionText
                      }
                    >
                      {child.childName}
                    </Text>

                    {selectedChildId ===
                      child.childId && (
                      <Feather
                        name="check-circle"
                        size={20}
                        color={BLUE}
                      />
                    )}
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MONTH PICKER */}

      <Modal
        transparent
        visible={monthPicker}
        animationType="fade"
        onRequestClose={() =>
          setMonthPicker(false)
        }
      >
        <View
          style={styles.overlay}
        >
          <View
            style={styles.modal}
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Select Month
            </Text>

            <View
              style={
                styles.monthNav
              }
            >
              <TouchableOpacity
                onPress={() =>
                  moveMonth(-1)
                }
              >
                <Feather
                  name="chevron-left"
                  size={25}
                  color={BLUE}
                />
              </TouchableOpacity>

              <Text
                style={
                  styles.monthNavText
                }
              >
                {month.toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    year: "numeric",
                  }
                )}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  moveMonth(1)
                }
              >
                <Feather
                  name="chevron-right"
                  size={25}
                  color={BLUE}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.done}
              onPress={() =>
                setMonthPicker(false)
              }
            >
              <Text
                style={
                  styles.doneText
                }
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 35,
  },
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
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  statusHeader: {
    backgroundColor: "#91F1EC",
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  statusHeaderText: {
    color: "#07508D",
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  modeRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 18,
  },
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
  modeActive: {
    backgroundColor: BLUE,
  },
  modeText: {
    fontSize: 11,
    color: "#60718A",
    fontFamily: fonts.medium,
  },
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
  weekActive: {
    backgroundColor: "#1F70F2",
  },
  weekTitle: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: DARK,
  },
  weekRange: {
    fontSize: 9,
    color: "#718096",
    marginTop: 4,
  },
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
  dayActive: {
    backgroundColor: "#1D70EE",
  },
  dayName: {
    fontSize: 11,
    color: MUTED,
  },
  dayNumber: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: DARK,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: DARK,
    flex: 1,
  },
  count: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fonts.medium,
  },
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
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: "#EAF0F7",
    alignItems: "center",
    justifyContent: "center",
  },
  childInfo: {
    flex: 1,
    minWidth: 0,
  },
  childName: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: DARK,
  },
  childTime: {
    fontSize: 10,
    color: MUTED,
    marginTop: 5,
  },
  controls: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#F6F8FB",
    gap: 3,
  },
  control: {
    height: 27,
    width: 27,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  presentControl: {
    backgroundColor: "#0CA47D",
  },
  absentControl: {
    backgroundColor: "#E63A45",
  },
  pill: {
    minWidth: 65,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  pillPresent: {
    backgroundColor: "#E3F8F1",
  },
  pillAbsent: {
    backgroundColor: "#FDEDED",
  },
  pillPending: {
    backgroundColor: "#FFF2D8",
  },
  pillText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
  history: {
    backgroundColor: "#ECF2FF",
    borderRadius: 15,
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
  },
  historyText: {
    fontSize: 13,
    color: "#166DF3",
    fontFamily: fonts.bold,
  },
  empty: {
    padding: 28,
    alignItems: "center",
  },
  emptyText: {
    color: MUTED,
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#0006",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 18,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: DARK,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F9FC",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    color: DARK,
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterOptionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: DARK,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 28,
  },
  monthNavText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: DARK,
  },
  done: {
    backgroundColor: BLUE,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
  },
  doneText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },
  childDateRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  marginTop: 5,
},

childDate: {
  fontSize: 10,
  fontFamily: fonts.medium,
  color: "#075BB8",
},

childTimeRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  marginTop: 4,
},

childTime: {
  fontSize: 10,
  fontFamily: fonts.regular,
  color: "#8A9DBA",
},
});
