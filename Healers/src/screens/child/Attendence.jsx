import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';

import { getChildAttendance } from '../../api/child/api';
import ChildBottomBar from '../../components/ChildBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const PAGE_LIMIT = 10;

const formatDateForApi = (date) => {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date) => {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatTime = (time) => {
  if (!time) {
    return "--";
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (
    Number.isNaN(hours)
    || Number.isNaN(minutes)
  ) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatTimeRange = (startTime, endTime) => {
  if (!startTime && !endTime) {
    return "--";
  }

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

const AttendanceScreen = () => {
  const [activeTab, setActiveTab] = useState("History");
  const [activeBottomTab, setActiveBottomTab] = useState("");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });

  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchAttendance = useCallback(
    async ({ pageNumber = 1, isLoadMore = false } = {}) => {
      if (isLoadMore) {
        if (loadingMore || loading || !hasMore) {
          return;
        }

        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const params = {
          page: pageNumber,
          limit: PAGE_LIMIT,
        };

        if (activeTab === "Today") {
          params.filter = "today";
        } else {
          params.fromDate = formatDateForApi(fromDate);
          params.toDate = formatDateForApi(toDate);
        }

        const response = await getChildAttendance(params);

        if (!response?.success) {
          throw new Error(
            response?.message
              || "Unable to fetch attendance",
          );
        }

        const newData = response?.data || [];

        if (isLoadMore) {
          setAttendanceData(
            (previous) => [
              ...previous,
              ...newData,
            ],
          );
        } else {
          setAttendanceData(newData);
        }

        setPage(pageNumber);

        setHasMore(
          Boolean(response?.hasMore),
        );
      } catch (err) {
        console.error(
          "Attendance error:",
          err,
        );

        if (!isLoadMore) {
          setAttendanceData([]);
          setError(
            err?.response?.data?.message
              || err?.message
              || "Unable to fetch attendance",
          );
        }
      } finally {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [activeTab, fromDate, toDate, loading, loadingMore, hasMore],
  );

  useEffect(() => {
    setAttendanceData([]);
    setPage(1);
    setHasMore(true);
    setError("");

    fetchAttendance({
      pageNumber: 1,
      isLoadMore: false,
    });
  }, [activeTab, fromDate, toDate]);

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore || attendanceData.length < PAGE_LIMIT) {
      return;
    }

    fetchAttendance({
      pageNumber: page + 1,
      isLoadMore: true,
    });
  };

  const handleRetry = () => {
    setAttendanceData([]);
    setPage(1);
    setHasMore(true);
    setError("");

    fetchAttendance({
      pageNumber: 1,
      isLoadMore: false,
    });
  };

  const handleFromDateChange = (event, selectedDate) => {
    setShowFromPicker(false);

    if (!selectedDate) {
      return;
    }

    setFromDate(selectedDate);

    if (selectedDate > toDate) {
      setToDate(selectedDate);
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToPicker(false);

    if (!selectedDate) {
      return;
    }

    setToDate(selectedDate);
  };

  const renderAttendanceItem = ({ item }) => {
    const status = String(
      item?.attendance_status
        || "Pending",
    ).toLowerCase();

    const isPresent = status === "complete"
      || status === "present"
      || status === "completed";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>
            {item?.date || "--"}
          </Text>

          <View
            style={[
              styles.statusBadge,
              isPresent
                ? styles.badgePresent
                : styles.badgeAbsent,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPresent
                  ? styles.textPresent
                  : styles.textAbsent,
              ]}
            >
              {isPresent
                ? "Present"
                : "Pending"}
            </Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <Feather
            name="clock"
            size={17}
            color="#64748B"
            style={styles.clockIcon}
          />

          <Text style={styles.timeText}>
            {formatTimeRange(
              item?.startTime,
              item?.endTime,
            )}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => {
    if (loading) {
      return null;
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Feather
            name="alert-circle"
            size={38}
            color="#DC2626"
          />

          <Text style={styles.errorText}>
            {error}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Feather
          name="calendar"
          size={40}
          color="#94A3B8"
        />

        <Text style={styles.emptyTitle}>
          No attendance found
        </Text>

        <Text style={styles.emptyText}>
          There is no attendance available for the selected dates.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, commonStyles.container]}
      edges={["top", "bottom"]}
    >
      <TopBar
        headerTitle="Attendance"
        isNotificationOpen={isNotificationOpen}
        setIsNotificationOpen={setIsNotificationOpen}
      />

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "History"
            && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("History")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "History"
                ? styles.activeTabText
                : styles.inactiveTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "Today"
            && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("Today")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "Today"
                ? styles.activeTabText
                : styles.inactiveTabText,
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === "History" && (
          <>
            <Text style={styles.sectionLabel}>
              Select Date Range
            </Text>

            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowFromPicker(true)}
              >
                <View
                  style={styles.dateTextContainer}
                >
                  <Text
                    style={styles.dateLabel}
                  >
                    From
                  </Text>

                  <Text
                    style={styles.dateSelectorText}
                  >
                    {formatDisplayDate(
                      fromDate,
                    )}
                  </Text>
                </View>

                <Feather
                  name="calendar"
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowToPicker(true)}
              >
                <View
                  style={styles.dateTextContainer}
                >
                  <Text
                    style={styles.dateLabel}
                  >
                    To
                  </Text>

                  <Text
                    style={styles.dateSelectorText}
                  >
                    {formatDisplayDate(
                      toDate,
                    )}
                  </Text>
                </View>

                <Feather
                  name="calendar"
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {showFromPicker && (
              <DateTimePicker
                value={fromDate}
                mode="date"
                display={Platform.OS === "ios"
                  ? "spinner"
                  : "default"}
                maximumDate={toDate}
                onValueChange={handleFromDateChange}
              />
            )}

            {showToPicker && (
              <DateTimePicker
                value={toDate}
                mode="date"
                display={Platform.OS === "ios"
                  ? "spinner"
                  : "default"}
                minimumDate={fromDate}
                maximumDate={new Date()}
                onValueChange={handleToDateChange}
              />
            )}
          </>
        )}

        <View style={styles.headingRow}>
          <Text style={styles.historyHeading}>
            {activeTab === "Today"
              ? "Today's Attendance"
              : "Attendance History"}
          </Text>

          {attendanceData.length > 0 && (
            <Text style={styles.countText}>
              {attendanceData.length}
            </Text>
          )}
        </View>

        {loading
          ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#0B64A4"
              />

              <Text style={styles.loadingText}>
                Loading attendance...
              </Text>
            </View>
          )
          : (
            <FlatList
              data={attendanceData}
              keyExtractor={(item, index) => String(item?.id || `${item?.date}-${item?.startTime}-${index}`)}
              renderItem={renderAttendanceItem}
              ListEmptyComponent={renderEmptyComponent}
              ListFooterComponent={loadingMore
                ? (
                  <View
                    style={styles.loadingMoreContainer}
                  >
                    <ActivityIndicator
                      size="small"
                      color="#0B64A4"
                    />

                    <Text
                      style={styles.loadingMoreText}
                    >
                      Loading more...
                    </Text>
                  </View>
                )
                : null}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={attendanceData.length === 0
                ? styles.emptyListContent
                : styles.listContent}
            />
          )}
      </View>

      <ChildBottomBar
        activeTab="ChildAttendance"
        setActiveTab={setActiveBottomTab}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  activeTabButton: {
    borderBottomColor: colors.primary,
  },

  tabText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#334155",
  },

  activeTabText: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },

  inactiveTabText: {
    fontFamily: fonts.semiBold,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.bold,
    color: "#334155",
    marginBottom: 8,
  },

  dateRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  dateSelector: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 62,
  },

  dateTextContainer: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: "#CBD5E1",
    marginBottom: 2,
  },

  dateSelectorText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  historyHeading: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.bold,
    color: "#334155",
  },

  countText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  listContent: {
    paddingBottom: 20,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardDate: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.bold,
    color: "#334155",
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },

  badgePresent: {
    backgroundColor: "#8BF6D9",
  },

  badgeAbsent: {
    backgroundColor: "#FFDAD5",
  },

  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.bold,
  },

  textPresent: {
    color: "#334155",
  },

  textAbsent: {
    color: "#BA1A1A",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  clockIcon: {
    marginRight: 8,
  },

  timeText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "#334155",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingMoreText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.bold,
    color: "#334155",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: "#64748B",
    textAlign: "center",
  },

  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 12,
  },

  retryButton: {
    backgroundColor: "#0B64A4",
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 6,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: fonts.bold,
  },
});

export default AttendanceScreen;
