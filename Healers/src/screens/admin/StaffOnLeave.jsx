import React, { useState, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import TopBar from "../../components/TopBar";
import { colors, commonStyles, fonts } from "../../styles/theme";
import { getStaffOnLeaveToday } from "../../api/admin/api";

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatDateRange = (start, end) =>
  new Date(start).toDateString() === new Date(end).toDateString()
    ? formatDate(start)
    : `${formatDate(start)} - ${formatDate(end)}`;

export default function StaffOnLeaveScreen({ navigation }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await getStaffOnLeaveToday();
        setStaff(response.data.data);
      } catch (error) {
        console.log("Failed to fetch staff on leave:", error);
        Alert.alert("Error", "Could not load staff on leave.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Staff on Leave Today"}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />}

        {!loading && staff.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No staff on leave today.</Text>
          </View>
        )}

        {!loading &&
          staff.map((item) => (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  emptyState: { padding: 30, alignItems: "center" },
  emptyStateText: { color: "#414750", fontSize: 14, fontWeight: "500" },
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
  name: { fontSize: 16, fontFamily: fonts.semiBold, color: "#181C1E", lineHeight: 20 },
  role: { fontSize: 14, fontFamily: fonts.regular, color: "#414750", lineHeight: 20, marginBottom: 10 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dateText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary },
  leaveType: { fontSize: 14, fontFamily: fonts.regular, color: "#414750" },
});