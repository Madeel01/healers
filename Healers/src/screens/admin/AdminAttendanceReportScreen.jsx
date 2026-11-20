import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Alert,
  Modal,
  TouchableOpacity,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import { getAdminAttendanceApi, updateAdminAttendanceApi } from '../../api/admin/api';
import { fonts } from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

const COLORS = {
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  background: "#F5F7FB",
  white: "#FFFFFF",
  text: "#172033",
  secondary: "#64748B",
  border: "#E2E8F0",
  green: "#16A34A",
  greenLight: "#DCFCE7",
  red: "#DC2626",
  redLight: "#FEE2E2",
  orange: "#D97706",
  orangeLight: "#FEF3C7",
  grayLight: "#F1F5F9",
};

const PAGE_SIZE = 5;
const STATUS_OPTIONS = [
  { value: "present", label: "Present", icon: "check-circle", bg: COLORS.greenLight, color: COLORS.green },
  { value: "absent", label: "Absent", icon: "x-circle", bg: COLORS.redLight, color: COLORS.red },
  { value: "pending", label: "Pending", icon: "clock", bg: COLORS.grayLight, color: COLORS.secondary },
];

const canEditRecord = (item, type) => {
  const current = normalizeStatus(getStatus(item, type));
  if (current === "cancelled" || current === "postponed") return false;
  return !!item?.date && item.date <= getDateKey(new Date());
};
const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDate = (value) => {
  if (!value) return new Date();

  if (value instanceof Date) return new Date(value);

  const parts = String(value).split("-");

  if (parts.length === 3) {
    return new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2]),
    );
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const startOfWeek = (date) => {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getMonthWeeks = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let currentWeekStart = startOfWeek(firstDay);

  const weeks = [];

  while (currentWeekStart <= lastDay) {
    const days = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(currentWeekStart, i);

      if (
        currentDate.getMonth() === month
        && currentDate.getFullYear() === year
      ) {
        days.push(currentDate);
      }
    }

    if (days.length > 0) {
      weeks.push({
        id: weeks.length + 1,
        days,
        startDate: days[0],
        endDate: days[days.length - 1],
      });
    }

    currentWeekStart = addDays(currentWeekStart, 7);
  }

  return weeks;
};

const formatMonth = (date) => {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const formatDay = (date) => {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
};

const formatDateNumber = (date) => {
  return String(date.getDate()).padStart(2, "0");
};

const formatFullDate = (date) => {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};


const getStatus = (item, attendanceType) => {
  if (item?.sessionType === "cancel") return "cancelled";
  if (item?.sessionType === "postponed") return "postponed";
  if (attendanceType === "therapist") {
    return (
      item?.therapistAttendance
      || item?.attendanceStatus
      || item?.status
      || "pending"
    );
  }

  return (
    item?.attendanceStatus
    || item?.status
    || "pending"
  );
};

const normalizeStatus = (status) => {
  const value = String(status || "pending").toLowerCase();

  if (value === "present") return "present";

  if (value === "absent") return "absent";

  if (
    value === "cancel"
    || value === "cancelled"
    || value === "canceled"
  ) {
    return "cancelled";
  }

  if (value === "postpond" || value === "postponed") {
    return "postponed";
  }

  return "pending";
};

const getStatusColors = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "present") {
    return {
      background: COLORS.greenLight,
      text: COLORS.green,
    };
  }

  if (normalized === "absent") {
    return {
      background: COLORS.redLight,
      text: COLORS.red,
    };
  }

  if (normalized === "cancelled" || normalized === "postponed") {
    return {
      background: COLORS.orangeLight,
      text: COLORS.orange,
    };
  }

  return {
    background: COLORS.grayLight,
    text: COLORS.secondary,
  };
};

const getRecordKey = (item, index, attendanceType) => {
  const attendanceId = item?.attendanceId;
  const appointmentId = item?.appointmentId;
  const childId = item?.childId;
  const therapistId = item?.therapistId;
  const recordId = item?._id || item?.id;
  const date = item?.date || item?.attendanceDate || "";

  const personId = attendanceType === "therapist"
    ? therapistId || item?.userId
    : childId;

  const uniqueParts = [
    attendanceType,
    attendanceId || "",
    appointmentId || "",
    personId || "",
    recordId || "",
    date,
    index,
  ];

  return uniqueParts.join("-");
};

const AdminAttendanceReportScreen = ({ navigation }) => {
  const [attendanceType, setAttendanceType] = useState("child");
  const [mode, setMode] = useState("today");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [records, setRecords] = useState([]);
  const [editTarget, setEditTarget] = useState(null);
  const [pickStatus, setPickStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    present: 0,
    absent: 0,
    pending: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const pageRef = useRef(1);
  const requestIdRef = useRef(0);
  const requestLockRef = useRef(false);
  const hasMoreRef = useRef(false);

  const monthWeeks = useMemo(
    () => getMonthWeeks(selectedDate),
    [selectedDate.getFullYear(), selectedDate.getMonth()],
  );

  const currentWeekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate);

    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [selectedDate]);

  const activeMonthWeek = useMemo(() => {
    return (
      monthWeeks.find((week) => week.id === selectedWeek)
      || monthWeeks[0]
    );
  }, [monthWeeks, selectedWeek]);

  const visibleDays = useMemo(() => {
    if (mode === "week") {
      return currentWeekDays;
    }

    if (mode === "month" && activeMonthWeek) {
      return activeMonthWeek.days;
    }

    return [];
  }, [mode, currentWeekDays, activeMonthWeek]);

  const fetchAttendance = useCallback(
    async (reset = false, isRefresh = false) => {
      if (requestLockRef.current && !reset) return;

      if (!reset && !hasMoreRef.current) return;

      requestLockRef.current = true;

      const requestId = ++requestIdRef.current;

      const nextPage = reset ? 1 : pageRef.current + 1;

      if (reset) {
        pageRef.current = 1;
        hasMoreRef.current = false;
        setHasMore(false);
        setLoading(!isRefresh);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = {
          attendanceType,
          mode: "today",
          date: getDateKey(selectedDate),
          year: selectedDate.getFullYear(),
          month: selectedDate.getMonth() + 1,
          page: nextPage,
          limit: PAGE_SIZE,
        };

        const response = await getAdminAttendanceApi(params);

        if (requestId !== requestIdRef.current) return;

        const result = response?.data || response;

        const newRecords = Array.isArray(result?.data)
          ? result.data
          : [];

        const pagination = result?.pagination || {};

        if (reset) {
          setRecords(newRecords);
        } else {
          setRecords((previous) => {
            const existingIds = new Set(
              previous.map((item, index) => getRecordKey(item, index, attendanceType)),
            );

            const uniqueRecords = newRecords.filter((item, index) => {
              const key = getRecordKey(
                item,
                previous.length + index,
                attendanceType,
              );

              if (existingIds.has(key)) return false;

              existingIds.add(key);

              return true;
            });

            return [...previous, ...uniqueRecords];
          });
        }

        const nextHasMore = pagination.hasMore
          ?? nextPage < (pagination.totalPages || 1);

        pageRef.current = nextPage;
        hasMoreRef.current = Boolean(nextHasMore);
        setHasMore(Boolean(nextHasMore));

        if (result?.summary) {
          setSummary({
            total: result.summary.total || 0,
            present: result.summary.present || 0,
            absent: result.summary.absent || 0,
            pending: result.summary.pending || 0,
          });
        }
      } catch (error) {
        console.log(
          "Admin attendance error:",
          error?.response?.data || error.message,
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          requestLockRef.current = false;
        }
      }
    },
    [attendanceType, selectedDate],
  );

  useFocusEffect(
    useCallback(() => {
      fetchAttendance(true);
    }, [fetchAttendance]),
  );
  const saveStatus = async () => {
    const newStatus = pickStatus;
    if (!editTarget || saving || !newStatus) return;

    const oldStatus = normalizeStatus(getStatus(editTarget, attendanceType));
    if (oldStatus === newStatus) return setEditTarget(null);

    try {
      setSaving(true);
      const res = await updateAdminAttendanceApi({
        attendanceType,
        scheduleId: editTarget.attendanceId,
        appointmentId: editTarget.appointmentId,
        childId: attendanceType === "child" ? editTarget.childId : undefined,
        status: newStatus,
      });

      if (!res?.success) {
        return Alert.alert("Could not update", res?.message || "Please try again.");
      }

      // const targetKey = getRecordKey(editTarget, 0, attendanceType).split("-").slice(0, 5).join("-");
      setRecords((prev) =>
        prev.map((r) => {
          const same =
            r.appointmentId === editTarget.appointmentId &&
            (attendanceType === "therapist" || r.childId === editTarget.childId);
          if (!same) return r;
          return attendanceType === "therapist"
            ? { ...r, therapistAttendance: newStatus }
            : { ...r, attendanceStatus: newStatus };
        }),
      );

      setSummary((s) => ({
        ...s,
        [oldStatus]: Math.max(0, (s[oldStatus] || 0) - 1),
        [newStatus]: (s[newStatus] || 0) + 1,
      }));

      setEditTarget(null);
    } catch (e) {
      Alert.alert("Could not update", e?.response?.data?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAttendance(true, true);
  }, [fetchAttendance]);

  const handleAttendanceType = (type) => {
    if (attendanceType === type) return;

    setAttendanceType(type);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);

    if (newMode === "today") {
      const today = new Date();

      setSelectedDate(today);
      setSelectedWeek(1);
      return;
    }

    if (newMode === "week") {
      const today = new Date();

      setSelectedDate(today);
      setSelectedWeek(1);
      return;
    }

    if (newMode === "month") {
      const today = new Date();
      const weeks = getMonthWeeks(today);

      const weekIndex = weeks.findIndex((week) =>
        week.days.some(
          (day) => getDateKey(day) === getDateKey(today),
        )
      );

      setSelectedDate(today);
      setSelectedWeek(weekIndex >= 0 ? weekIndex + 1 : 1);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(new Date(date));
  };

  const handleWeekSelect = (week) => {
    setSelectedWeek(week.id);
    setSelectedDate(new Date(week.days[0]));
  };

  const handleMonthChange = (direction) => {
    const nextDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + direction,
      1,
    );

    const weeks = getMonthWeeks(nextDate);

    setSelectedDate(nextDate);
    setSelectedWeek(1);

    if (weeks.length > 0) {
      setSelectedDate(new Date(weeks[0].days[0]));
    }
  };

  const renderModeButton = (label, value) => {
    const active = mode === value;

    return (
      <TouchableOpacity
        key={value}
        style={[
          styles.modeButton,
          active && styles.modeButtonActive,
        ]}
        onPress={() => handleModeChange(value)}
      >
        <Text
          style={[
            styles.modeButtonText,
            active && styles.modeButtonTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDayTabs = () => {
    if (visibleDays.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabsContainer}
      >
        {visibleDays.map((day) => {
          const active = getDateKey(day) === getDateKey(selectedDate);

          return (
            <TouchableOpacity
              key={getDateKey(day)}
              style={[
                styles.dayTab,
                active && styles.dayTabActive,
              ]}
              onPress={() => handleDateSelect(day)}
            >
              <Text
                style={[
                  styles.dayTabName,
                  active && styles.dayTabTextActive,
                ]}
              >
                {formatDay(day)}
              </Text>

              <Text
                style={[
                  styles.dayTabDate,
                  active && styles.dayTabTextActive,
                ]}
              >
                {formatDateNumber(day)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderWeekTabs = () => {
    if (mode !== "month") return null;

    return (
      <View style={styles.weekSection}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => handleMonthChange(-1)}
          >
            <Feather
              name="chevron-left"
              size={fontSize(20)}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {formatMonth(selectedDate)}
          </Text>

          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => handleMonthChange(1)}
          >
            <Feather
              name="chevron-right"
              size={fontSize(20)}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekTabsContainer}
        >
          {monthWeeks.map((week) => {
            const active = selectedWeek === week.id;

            return (
              <TouchableOpacity
                key={week.id}
                style={[
                  styles.weekTab,
                  active && styles.weekTabActive,
                ]}
                onPress={() => handleWeekSelect(week)}
              >
                <Text
                  style={[
                    styles.weekTabTitle,
                    active && styles.weekTabTextActive,
                  ]}
                >
                  Week {week.id}
                </Text>

                <Text
                  style={[
                    styles.weekTabDate,
                    active && styles.weekTabTextActive,
                  ]}
                >
                  {formatDateNumber(week.startDate)} - {formatDateNumber(week.endDate)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {renderDayTabs()}
      </View>
    );
  };

  const renderDateSection = () => {
    if (mode === "today") {
      return (
        <View style={styles.todayDateContainer}>
          <Feather
            name="calendar"
            size={fontSize(17)}
            color={COLORS.primary}
          />

          <Text style={styles.todayDateText}>
            {formatFullDate(selectedDate)}
          </Text>
        </View>
      );
    }

    if (mode === "week") {
      return (
        <View style={styles.weekSection}>
          <Text style={styles.sectionHeading}>
            Current Week
          </Text>

          {renderDayTabs()}
        </View>
      );
    }

    return renderWeekTabs();
  };

  const renderSummaryCard = (label, value, color, background) => {
    return (
      <View style={styles.summaryCard}>
        <View
          style={[
            styles.summaryIcon,
            { backgroundColor: background },
          ]}
        >
          <View
            style={[
              styles.summaryDot,
              { backgroundColor: color },
            ]}
          />
        </View>

        <Text style={styles.summaryValue}>{value}</Text>

        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    );
  };

  const renderSummary = () => {
    return (
      <View style={styles.summaryContainer}>
        {renderSummaryCard(
          "Total",
          summary.total,
          COLORS.primary,
          COLORS.primaryLight,
        )}

        {renderSummaryCard(
          "Present",
          summary.present,
          COLORS.green,
          COLORS.greenLight,
        )}

        {renderSummaryCard(
          "Absent",
          summary.absent,
          COLORS.red,
          COLORS.redLight,
        )}

        {renderSummaryCard(
          "Pending",
          summary.pending,
          COLORS.orange,
          COLORS.orangeLight,
        )}
      </View>
    );
  };

  const renderAttendanceCard = ({ item, index }) => {
    const status = getStatus(item, attendanceType);
    const statusColors = getStatusColors(status);

    const personName = attendanceType === "therapist"
      ? item?.therapistName
        || item?.name
        || item?.userName
        || "Unknown Therapist"
      : item?.childName
        || item?.name
        || "Unknown Child";

    const relatedName = attendanceType === "therapist"
      ? item?.childNames
        || item?.childrenNames
        || ""
      : item?.therapistName
        || "";

    const startTime = item?.startTime
      || item?.appointmentTime
      || item?.time
      || "";

    const endTime = item?.endTime || "";

    const recordDate = item?.date
      ? formatFullDate(parseDate(item.date))
      : formatFullDate(selectedDate);
    const editable = canEditRecord(item, attendanceType);
    return (
      <TouchableOpacity
        style={styles.attendanceCard}
        key={getRecordKey(item, index, attendanceType)}
        activeOpacity={editable ? 0.8 : 1}
        onPress={() => editable && openEdit(item)}
      >

        <View style={styles.cardTop}>
          <View style={styles.personInfo}>
            <View style={styles.avatar}>
              <Feather
                name={attendanceType === "therapist"
                  ? "user"
                  : "users"}
                size={fontSize(21)}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.personText}>
              <Text
                style={styles.personName}
                numberOfLines={1}
              >
                {personName}
              </Text>

              <Text style={styles.personRole}>
                {attendanceType === "therapist"
                  ? "Therapist"
                  : "Child"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            disabled={!editable}
            activeOpacity={0.7}
            onPress={() => openEdit(item)}
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors.background },
              editable && { borderWidth: 1, borderColor: statusColors.text + "55" },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {normalizeStatus(status).toUpperCase()}
            </Text>
            {editable && (
              <Feather name="chevron-down" size={fontSize(13)} color={statusColors.text} />
            )}
          </TouchableOpacity>
        </View>

        {relatedName
          ? (
            <View style={styles.cardDetail}>
              <Feather
                name="user"
                size={fontSize(15)}
                color={COLORS.secondary}
              />

              <Text style={styles.detailText}>
                {attendanceType === "therapist"
                  ? `Children: ${
                    Array.isArray(relatedName)
                      ? relatedName.join(", ")
                      : relatedName
                  }`
                  : `Therapist: ${relatedName}`}
              </Text>
            </View>
          )
          : null}

        <View style={styles.cardFooter}>
          <View style={styles.cardDetail}>
            <Feather
              name="calendar"
              size={fontSize(14)}
              color={COLORS.secondary}
            />

            <Text style={styles.detailText}>
              {recordDate}
            </Text>
          </View>

          {startTime
            ? (
              <View style={styles.cardDetail}>
                <Feather
                  name="clock"
                  size={fontSize(14)}
                  color={COLORS.secondary}
                />

                <Text style={styles.detailText}>
                  {formatTo12Hour(startTime)}
                  {endTime ? ` - ${formatTo12Hour(endTime)}` : ""}
                </Text>
              </View>
            )
            : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Feather
            name="calendar"
            size={fontSize(30)}
            color={COLORS.secondary}
          />
        </View>

        <Text style={styles.emptyTitle}>
          No Attendance Found
        </Text>

        <Text style={styles.emptyText}>
          There are no attendance records for this date.
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator
          size="small"
          color={COLORS.primary}
        />

        <Text style={styles.footerText}>
          Loading more records...
        </Text>
      </View>
    );
  };

  const handleLoadMore = () => {
    if (
      !loading
      && !loadingMore
      && hasMore
      && records.length > 0
    ) {
      fetchAttendance(false);
    }
  };

  const listHeader = (
    <View>
     

      <View style={styles.typeContainer}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            attendanceType === "child"
            && styles.typeButtonActive,
          ]}
          onPress={() => handleAttendanceType("child")}
        >
          <Feather
            name="users"
            size={fontSize(17)}
            color={attendanceType === "child"
              ? COLORS.white
              : COLORS.secondary}
          />

          <Text
            style={[
              styles.typeButtonText,
              attendanceType === "child"
              && styles.typeButtonTextActive,
            ]}
          >
            Child 
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            attendanceType === "therapist"
            && styles.typeButtonActive,
          ]}
          onPress={() => handleAttendanceType("therapist")}
        >
          <Feather
            name="user"
            size={fontSize(17)}
            color={attendanceType === "therapist"
              ? COLORS.white
              : COLORS.secondary}
          />

          <Text
            style={[
              styles.typeButtonText,
              attendanceType === "therapist"
              && styles.typeButtonTextActive,
            ]}
          >
            Therapist
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.sectionHeading}>
          Select Attendance Period
        </Text>

        <View style={styles.modeContainer}>
          {renderModeButton("Today", "today")}
          {renderModeButton("Week", "week")}
          {renderModeButton("Month", "month")}
        </View>

        {renderDateSection()}
      </View>

      {renderSummary()}

      <View style={styles.recordsHeading}>
        <View>
          <Text style={styles.recordsTitle}>
            Attendance Records
          </Text>

          <Text style={styles.recordsSubtitle}>
            {formatFullDate(selectedDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Feather
            name="refresh-cw"
            size={fontSize(17)}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
  const openEdit = (item) => {
    setPickStatus(normalizeStatus(getStatus(item, attendanceType)));
    setEditTarget(item);
  };
  return (
    <View style={styles.safeArea}>
      <StatusBar
        backgroundColor={COLORS.background}
        barStyle="dark-content"
      />

      {loading && records.length === 0
        ? (
          <View style={styles.loadingContainer}>
            {listHeader}

            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text style={styles.loadingText}>
              Loading attendance...
            </Text>
          </View>
        )
        : (
          <FlatList
            data={records}
            keyExtractor={(item, index) => getRecordKey(item, index, attendanceType)}
            renderItem={renderAttendanceCard}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
          />
        )}
        <Modal
          visible={!!editTarget}
          transparent
          animationType="slide"
          onRequestClose={() => setEditTarget(null)}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => !saving && setEditTarget(null)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.sheet}>
              <View style={styles.handle} />

              <View style={styles.sheetPerson}>
                <View style={styles.avatar}>
                  <Feather
                    name={attendanceType === "therapist" ? "user" : "users"}
                    size={fontSize(21)}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {attendanceType === "therapist" ? editTarget?.therapistName : editTarget?.childName}
                  </Text>
                  <Text style={styles.sheetSub} numberOfLines={1}>
                    {editTarget?.date ? formatFullDate(parseDate(editTarget.date)) : ""}
                    {editTarget?.startTime ? `  ·  ${formatTo12Hour(editTarget.startTime)}` : ""}
                  </Text>
                </View>
              </View>

              <Text style={styles.sheetLabel}>Mark attendance as</Text>

              <View style={styles.tileRow}>
                {STATUS_OPTIONS.map((o) => {
                  const on = pickStatus === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      disabled={saving}
                      activeOpacity={0.8}
                      onPress={() => setPickStatus(o.value)}
                      style={[
                        styles.tile,
                        on && { backgroundColor: o.bg, borderColor: o.color },
                      ]}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: on ? o.color : o.bg }]}>
                        <Feather name={o.icon} size={fontSize(20)} color={on ? "#FFFFFF" : o.color} />
                      </View>
                      <Text style={[styles.tileText, { color: on ? o.color : COLORS.secondary }]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (saving ||
                    pickStatus === normalizeStatus(getStatus(editTarget || {}, attendanceType))) && { opacity: 0.5 },
                ]}
                disabled={
                  saving ||
                  pickStatus === normalizeStatus(getStatus(editTarget || {}, attendanceType))
                }
                onPress={saveStatus}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
    </View>
  );
};

export default AdminAttendanceReportScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    paddingTop: hp(10),

  },

  listContent: {
    paddingHorizontal: wp(16),
    paddingBottom: hp(30),
  },

  typeContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: wp(8),
    borderRadius: wp(14),
    marginBottom: hp(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap:wp(5)
  },

  typeButton: {
    flex: 1,
    minHeight: hp(44),
    borderRadius: wp(10),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: wp(6),
    paddingHorizontal: wp(5),
  },

  typeButtonActive: {
    backgroundColor: "#2563EB",
  },

  typeButtonText: {
    color: "#64748B",
    fontSize: fontSize(10),
    fontFamily: fonts.semiBold,
    textAlign: "center",
    lineHeight:hp(16)
  },

  typeButtonTextActive: {
    color: "#FFFFFF",
  },

  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(17),
    padding: wp(15),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: hp(14),
  },

  sectionHeading: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#172033",
    marginBottom: hp(13),
  },

  modeContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: wp(11),
    padding: wp(8),
    marginBottom: hp(15),
  },

  modeButton: {
    flex: 1,
    height: hp(38),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: wp(8),
  },

  modeButtonActive: {
    backgroundColor: "#2563EB",
  },

  modeButtonText: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#64748B",
    lineHeight:hp(16)

  },

  modeButtonTextActive: {
    color: "#FFFFFF",
  },

  todayDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(9),
    backgroundColor: "#EFF6FF",
    borderRadius: wp(10),
    padding: wp(12),
  },

  todayDateText: {
    color: "#2563EB",
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    lineHeight:hp(16)

  },

  weekSection: {
    marginTop: hp(2),
  },

  dayTabsContainer: {
    gap: wp(8),
    paddingVertical: hp(5),
  },

  dayTab: {
    minWidth: wp(48),
    height: hp(62),
    borderRadius: wp(11),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: wp(7),
  },

  dayTabActive: {
    backgroundColor: "#2563EB",
  },

  dayTabName: {
    fontSize: fontSize(11),
    fontFamily: fonts.medium,
    color: "#64748B",
    marginBottom: hp(5),
    lineHeight:hp(16)

  },

  dayTabDate: {
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: "#172033",
  },

  dayTabTextActive: {
    color: "#FFFFFF",
  },

  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(12),
  },

  monthTitle: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#172033",
    lineHeight:hp(19)

  },

  monthArrow: {
    width: wp(34),
    height: wp(34),
    borderRadius: wp(9),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  weekTabsContainer: {
    gap: wp(9),
    paddingBottom: hp(13),
  },

  weekTab: {
    minWidth: wp(91),
    paddingHorizontal: wp(12),
    paddingVertical: hp(11),
    borderRadius: wp(11),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },

  weekTabActive: {
    backgroundColor: "#2563EB",
  },

  weekTabTitle: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#172033",
    lineHeight:hp(16)

  },

  weekTabDate: {
    fontSize: fontSize(10),
    fontFamily: fonts.medium,
    color: "#64748B",
    marginTop: hp(5),
  },

  weekTabTextActive: {
    color: "#FFFFFF",
  },

  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp(5),
    marginBottom: hp(20),
  },

  summaryCard: {
    width: "22%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: wp(14),
    padding: wp(12),
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  summaryIcon: {
    width: wp(27),
    height: wp(27),
    borderRadius: wp(9),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(9),
  },

  summaryDot: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(5),
  },

  summaryValue: {
    fontSize: fontSize(22),
    fontFamily: fonts.bold,
    color: "#172033",
  },

  summaryLabel: {
    fontSize: fontSize(11),
    fontFamily: fonts.medium,
    color: "#64748B",
    marginTop: hp(3),
  },

  recordsHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(12),
  },

  recordsTitle: {
    fontSize: fontSize(17),
    fontFamily: fonts.semiBold,
    color: "#172033",
  },

  recordsSubtitle: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: hp(4),
  },

  refreshButton: {
    width: wp(38),
    height: wp(38),
    borderRadius: wp(11),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  attendanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(15),
    padding: wp(14),
    marginBottom: hp(11),
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(13),
  },

  personInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: wp(8),
  },

  avatar: {
    width: wp(43),
    height: wp(43),
    borderRadius: wp(13),
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(10),
  },

  personText: {
    flex: 1,
  },

  personName: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#172033",
  },

  personRole: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: hp(4),
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(5),
    borderRadius: wp(20),
    paddingHorizontal: wp(10),
    paddingVertical: hp(6),
  },


  statusText: {
    fontSize: fontSize(9),
    fontFamily: fonts.semiBold,
  },

  cardDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(7),
    marginBottom: hp(9),
  },

  detailText: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
    flexShrink: 1,
    lineHeight:hp(16)

  },

  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: hp(11),
    marginTop: hp(2),
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: hp(45),
  },

  emptyIcon: {
    width: wp(65),
    height: wp(65),
    borderRadius: wp(20),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(13),
  },

  emptyTitle: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#172033",
  },

  emptyText: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: hp(7),
    textAlign: "center",
  },

  loadingContainer: {
    flex: 1,
    paddingHorizontal: wp(16),
  },

  loadingText: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    textAlign: "center",
    marginTop: hp(10),
  },

  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: hp(18),
    gap: wp(9),
  },

  footerText: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: wp(20), paddingBottom: hp(30) },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: hp(12) },
  sheetTitle: { fontSize: fontSize(18), fontFamily: fonts.semiBold, color: "#172033" },
  sheetSub: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", marginTop: hp(3) },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: hp(14),
  },
  sheetPerson: { flexDirection: "row", alignItems: "center", gap: wp(2) },
  sheetLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#64748B",
    marginTop: hp(18),
    marginBottom: hp(10),
  },
  tileRow: { flexDirection: "row", gap: wp(10) },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: hp(14),
    borderRadius: wp(14),
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    gap: hp(8),
  },
  tileIcon: {
    width: wp(38),
    height: wp(38),
    borderRadius: wp(12),
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, lineHeight: hp(16) },
  saveBtn: {
    height: hp(48),
    borderRadius: wp(12),
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: hp(18),
  },
  saveText: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#FFFFFF" },
});
