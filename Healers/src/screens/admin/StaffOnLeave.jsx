import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { getStaffOnLeaveToday } from '../../api/admin/api';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { fontSize } from '../../utils/responsive';

const LIMIT = 10;
const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatDateRange = (start, end) =>
  new Date(start).toDateString() === new Date(end).toDateString()
    ? formatDate(start)
    : `${formatDate(start)} - ${formatDate(end)}`;

export default function StaffOnLeaveScreen({ navigation }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const requestIdRef = useRef(0);

  const loadStaff = async (pageNum = 1) => {
    const isFirst = pageNum === 1;
    const requestId = ++requestIdRef.current;

    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await getStaffOnLeaveToday({ page: pageNum, limit: LIMIT });
      if (requestId !== requestIdRef.current) return;

      const list = response?.data?.data || [];
      setStaff((prev) =>
        isFirst
          ? list
          : [...prev, ...list.filter((i) => !prev.some((p) => p._id === i._id))]
      );
      setPage(pageNum);
      setHasMore(Boolean(response?.data?.hasMore));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.log("Failed to fetch staff on leave:", error);
      Alert.alert("Error", "Could not load staff on leave.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadStaff(1);
  }, []);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;

    if (nearBottom && hasMore && !loading && !loadingMore) {
      loadStaff(page + 1);
    }
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
        )}

        {!loading && staff.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No staff on leave today.</Text>
          </View>
        )}

        {staff.map((item) => (
            <View key={item._id} style={styles.card}>
              <Text style={styles.name}>{item.applicantId.fullName}</Text>
              <Text style={styles.role}>{item.role}</Text>

              <View style={styles.dateRow}>
                <MaterialIcons name="event" size={18} color={colors.primary} />
                <Text style={styles.dateText}>
                    {formatDateRange(item.startDate, item.endDate)}
                </Text>
              </View>

              <Text style={styles.leaveType}>{item.leaveType}</Text>
            </View>
          ))}
          {loadingMore && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  emptyState: { padding: 30, alignItems: "center" },
  emptyStateText: { color: "#414750", fontSize: fontSize(14), fontFamily: fonts.medium,},
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "rgba(0,0,0,.4)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  name: { fontSize: fontSize(16), fontFamily: fonts.semiBold, color: "#181C1E", lineHeight: 20 },
  role: { fontSize: fontSize(14), fontFamily: fonts.regular, color: "#414750", lineHeight: 20, marginBottom: 10 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dateText: { fontSize: fontSize(16), fontFamily: fonts.semiBold, color: colors.primary },
  leaveType: { fontSize: fontSize(14), fontFamily: fonts.regular, color: "#414750" },
});