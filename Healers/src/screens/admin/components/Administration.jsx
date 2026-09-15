import React from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import {
  colors,
  fonts,
} from '../../../styles/theme';

export default function Administration({ customstyles }) {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text style={[customstyles?.sectionTitle, styles.sectionHeader]}>
        Administration
      </Text>

      <TouchableOpacity
        style={[styles.adminBanner, { backgroundColor: "#F9DDCF" }]}
        onPress={() => navigation.navigate('LeaveRequest')}
      >
        <View style={[styles.adminIconBox, { backgroundColor: "#E8B79E" }]}>
          <MaterialIcons name="event-note" size={22} color="#FFFFFF" />
        </View>

        <View style={styles.adminTextContainer}>
          <View style={{ width: "70%" }}>
            <Text style={styles.adminBannerTitle}>Leave Requests</Text>
            <Text style={styles.adminBannerSub}>Approve or reject leave requests</Text>
          </View>

          <AntDesign name="file-text" size={24} color="#717781" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.adminBanner, { backgroundColor: "#D6EAF8" }]}
        onPress={() => navigation.navigate('Therapist')}

      >
        <View style={[styles.adminIconBox, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="message" size={22} color="#FFFFFF" />
        </View>

        <View style={styles.adminTextContainer}>
          <View style={{ width: "74%" }}>
            <Text style={styles.adminBannerTitle}>Therapist Management</Text>
            <Text style={styles.adminBannerSub}>Manage therapist accounts</Text>
          </View>

          <AntDesign name="file-text" size={24} color="#717781" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.adminBanner, { backgroundColor: "#FDD7D7" }]}
        onPress={() => navigation.navigate('Feedback')}

      >
        <View style={[styles.adminIconBox, { backgroundColor: "rgba(216,82,67,.2)" }]}>
          <MaterialIcons name="message" size={22} color="#FFFFFF" />
        </View>

        <View style={styles.adminTextContainer}>
          <View style={{ width: "75%" }}>
            <Text style={styles.adminBannerTitle}>Feedback Management</Text>
            <Text style={styles.adminBannerSub}>View and manage feedback</Text>
          </View>

          <AntDesign name="file-text" size={24} color="#717781" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.adminBanner, { backgroundColor: "#6DDDC2" }]}
        onPress={() => navigation.navigate('BroadcastManagement')}

      >
        <View style={[styles.adminIconBox, { backgroundColor: "#006B58" }]}>
          <MaterialCommunityIcons name="broadcast" size={22} color="#FFFFFF" />
        </View>

        <View style={styles.adminTextContainer}>
          <View style={{ width: "75%" }}>
           <Text style={styles.adminBannerTitle}>Broadcast Management</Text>
            <Text style={styles.adminBannerSub}>Manage fees and payments</Text>
          </View>

          <AntDesign name="file-text" size={24} color="#717781" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  adminIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  adminTextContainer: {
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  adminBannerTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 24,
  },
  adminBannerSub: {
    fontSize: 14,
    color: "#414750",
    fontFamily: fonts.regular,
  },
});
