import React from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import {
  fontSize,
  hp,
  wp,
} from '../utils/responsive';

export default function BottomBar({ activeTab = "AdminDashboard" }) {
  const navigation = useNavigation();

  const tabs = [
    { id: "AdminDashboard", label: "Home", iconType: "MaterialIcons", iconName: "home", iconSize: 19 },
    { id: "Therapist", label: "Therapists", iconType: "FontAwesome5", iconName: "user-md", iconSize: 18 },
    { id: "Children", label: "Children", iconType: "FontAwesome5", iconName: "child", iconSize: 18 },
    { id: "Schedule", label: "Scheduling", iconType: "MaterialIcons", iconName: "event", iconSize: 19 },
    { id: "Notifications", label: "Notifications", iconType: "MaterialIcons", iconName: "notifications", iconSize: 19 },
  ];

  // const handlePress = (tabId) => {
  //   setCurrentTab(tabId);
  //   if (onTabPress) onTabPress(tabId);
  // };

  return (
    <View style={[styles.bottomBar]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const IconComponent = tab.iconType === "MaterialIcons" ? MaterialIcons : FontAwesome5;
        const iconColor = isActive ? "#0B4A6F" : "#94A3B8";

        return (
          <TouchableOpacity
            key={tab.id}
            style={isActive ? styles.navTabActive : styles.navTab}
            onPress={() => navigation.navigate(tab.id)}
            activeOpacity={0.7}
          >
            <IconComponent name={tab.iconName} size={fontSize(tab.iconSize)} color={iconColor} />
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
    paddingTop: hp(10),
    paddingBottom: hp(5),
    paddingHorizontal: wp(15),
  },
  navTabActive: {
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: wp(10),
    paddingVertical: hp(5),
    borderRadius: wp(10),
  },
  navTab: {
    alignItems: "center",
    paddingHorizontal: wp(10),
    paddingVertical: hp(5),
  },
  navTextActive: {
    fontSize: fontSize(9),
    fontWeight: "700",
    color: "#0B4A6F",
    marginTop: 2,
  },
  navText: {
    fontSize: fontSize(9),
    color: "#94A3B8",
    marginTop: 4,
  },
});
