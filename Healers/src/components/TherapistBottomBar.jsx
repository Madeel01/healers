import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

export default function TherapistBottomBar({ activeTab = "TherapistDashboard" }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [currentTab, setCurrentTab] = useState(activeTab);

  const tabs = [
    { id: "TherapistDashboard", label: "Home", iconType: "MaterialIcons", iconName: "home", iconSize: 22 },
    { id: "AssignedChildren", label: "Children", iconType: "FontAwesome5", iconName: "child", iconSize: 18 },
    { id: "FeedbackManagement", label: "Feedback", iconType: "MaterialIcons", iconName: "feedback", iconSize: 22 },
    { id: "AttendanceTracking", label: "Scheduling", iconType: "MaterialIcons", iconName: "event", iconSize: 22 },
    { id: "Alert", label: "Alerts", iconType: "MaterialIcons", iconName: "notifications", iconSize: 22 },
  ];


  return (
    <View style={[styles.bottomBar]}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        const IconComponent = tab.iconType === "MaterialIcons" ? MaterialIcons : FontAwesome5;
        const iconColor = isActive ? "#0B4A6F" : "#94A3B8";

        return (
          <TouchableOpacity
            key={tab.id}
            style={isActive ? styles.navTabActive : styles.navTab}
            onPress={() => navigation.navigate(tab.id)}
            activeOpacity={0.7}
          >
            <IconComponent name={tab.iconName} size={tab.iconSize} color={iconColor} />
            <Text style={isActive ? styles.navTextActive : styles.navText}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  navTabActive: {
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  navTab: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navTextActive: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B4A6F",
    marginTop: 2,
  },
  navText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
  },
});
