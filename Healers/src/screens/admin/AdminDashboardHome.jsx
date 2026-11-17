import React from "react";

import { ActivityIndicator, View } from "react-native";

import {
  DASHBOARD_LAYOUTS,
  useDashboardLayout,
} from "../../context/DashboardLayoutContext";
import AdminDashboard from "./AdminDashboard";
import AdminDashboard2 from "./AdminDashboard2";

export default function AdminDashboardHome() {
  const { layout, ready } = useDashboardLayout();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return layout === DASHBOARD_LAYOUTS.MODERN
    ? <AdminDashboard2 />
    : <AdminDashboard />;
}