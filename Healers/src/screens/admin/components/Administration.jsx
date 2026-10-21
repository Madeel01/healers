import React from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AntDesign from '@expo/vector-icons/AntDesign';
import Entypo from '@expo/vector-icons/Entypo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import {
  colors,
  fonts,
} from '../../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../../utils/responsive';

const administrationItems = [
  {
    title: "Program Builder",
    subtitle: "Create and manage Programs",
    route: "ProgramBuilder",
    backgroundColor: "#DBEAFE",
    iconBackground: "#1669A9",
    icon: "plus",
    iconType: "Entypo",
  },
  {
    title: "Batch Management",
    subtitle: "Create and manage batches",
    route: "BatchManagment",
    backgroundColor: "#E6CFF9",
    iconBackground: "#DC9EE8",
    icon: "dynamic-feed",
    iconType: "MaterialIcons",
  },
  {
    title: "Leave Requests",
    subtitle: "Approve or reject leave requests",
    route: "LeaveRequest",
    backgroundColor: "#F9DDCF",
    iconBackground: "#E8B79E",
    icon: "event-note",
    iconType: "MaterialIcons",
    showBadge: true,
  },
  {
    title: "Therapist Management",
    subtitle: "Manage therapist accounts",
    route: "Therapist",
    backgroundColor: "#D6EAF8",
    iconBackground: colors.primary,
    icon: "message",
    iconType: "MaterialIcons",
  },
  {
    title: "Feedback Management",
    subtitle: "View and manage feedback",
    route: "Feedback",
    backgroundColor: "#FDD7D7",
    iconBackground: "rgba(216,82,67,.2)",
    icon: "message",
    iconType: "MaterialIcons",
    iconColor: "#D85243",
  },
  {
    title: "Broadcast Management",
    subtitle: "Manage fees and payments",
    route: "BroadcastManagement",
    backgroundColor: "#6DDDC2",
    iconBackground: "#006B58",
    icon: "broadcast",
    iconType: "MaterialCommunityIcons",
  },
];

const iconComponents = {
  Entypo,
  MaterialIcons,
  MaterialCommunityIcons,
};

export default function Administration({
  customstyles,
  leaveCount = 0,
}) {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text
        style={[
          customstyles?.sectionTitle,
          styles.sectionHeader,
        ]}
      >
        Administration
      </Text>

      {administrationItems.map((item) => {
        const IconComponent = iconComponents[item.iconType];

        return (
          <TouchableOpacity
            key={item.route}
            activeOpacity={0.8}
            style={[
              styles.adminBanner,
              { backgroundColor: item.backgroundColor },
            ]}
            onPress={() => navigation.navigate(item.route)}
          >
            <View
              style={[
                styles.adminIconBox,
                { backgroundColor: item.iconBackground },
              ]}
            >
              <IconComponent
                name={item.icon}
                size={fontSize(22)}
                color={item.iconColor || "#FFFFFF"}
              />
            </View>

            <View style={styles.adminTextContainer}>
              <Text style={styles.adminBannerTitle}>
                {item.title}
              </Text>

              <Text style={styles.adminBannerSub}>
                {item.subtitle}
              </Text>
            </View>

            <View style={styles.rightContainer}>
              {item.showBadge && Number(leaveCount) > 0 && (
                <View style={styles.leaveBadge}>
                  <Text style={styles.leaveBadgeText}>
                    {Number(leaveCount) > 99
                      ? "99+"
                      : leaveCount}
                  </Text>
                </View>
              )}

              <AntDesign
                name="file-text"
                size={fontSize(22)}
                color="#717781"
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: hp(10),
  },
  sectionHeader: {
    marginBottom: hp(10),
  },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: hp(82),
    paddingHorizontal: wp(14),
    paddingVertical: hp(16),
    borderRadius: wp(16),
    marginBottom: hp(10),
  },
  adminIconBox: {
    width: wp(42),
    height: wp(42),
    borderRadius: wp(12),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  adminTextContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: wp(12),
    marginRight: wp(8),
    paddingRight: wp(35),
    justifyContent: "center",
  },
  adminBannerTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.medium,
    color: "#181C1E",
    lineHeight: fontSize(22),
    marginBottom: hp(4),
    flexShrink: 1,
  },
  adminBannerSub: {
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#414750",
    lineHeight: fontSize(20),
    flexShrink: 1,
    paddingBottom:0,

  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: wp(6),
    flexShrink: 0,
  },
  leaveBadge: {
    backgroundColor: "#EF4444",
    minWidth: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    paddingHorizontal: wp(6),
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBadgeText: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    textAlign: "center",
  },
});
