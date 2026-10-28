import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BackToAdminButton from '../components/BackToAdminButton';
import BottomBar from '../components/BottomBar';
import TopBar from '../components/TopBar';
import { AuthContext } from '../context/AuthContext';
import AddNewPackageScreen from '../screens/admin/AddNewPackage';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AllPackagesScreen from '../screens/admin/AllPackages';
import AllUsersScreen from '../screens/admin/AllUsersScreen';
import BatchAdditionalClassScreen
  from '../screens/admin/BatchAdditionalClassScreen';
import BatchManagementScreen from '../screens/admin/BatchManagement';
import BatchScheduleScreen from '../screens/admin/BatchSchedule';
import BatchScheduleCreateScreen
  from '../screens/admin/Batchschedulecreatescreen';
import BatchSessionPostponeScreen
  from '../screens/admin/BatchSessionPostponeScreen';
import BroadcastManagementScreen from '../screens/admin/BroadcastManagement';
import ChildCustomAppointmentScreen
  from '../screens/admin/ChildCustomAppointmentScreen';
import ChildDetailsScreen from '../screens/admin/ChildDetailsScreen';
import ChildFormScreen from '../screens/admin/ChildForm';
import ChildrenScreen from '../screens/admin/Children';
import ChildScheduleScreen from '../screens/admin/ChildScheduleScreen';
import ComplainManagementScreen from '../screens/admin/ComplainManagement';
import CreateNewInvoiceScreen from '../screens/admin/CreateNewInvoice';
import FeedbackScreen from '../screens/admin/Feedback';
import FeeManagementScreen from '../screens/admin/FeeManagement';
import InvoiceDetailScreen from '../screens/admin/InvoiceDetailScreen';
import InvoiceManagementScreen from '../screens/admin/InvoiceManagement';
import InvoiceViewScreen from '../screens/admin/InvoiceViewScreen';
import LeaveRequestsScreen from '../screens/admin/LeaveRequest';
import NotificationScreen from '../screens/admin/Notification';
import ProgramBuilderScreen from '../screens/admin/ProgramBuilder';
import ScheduleScreen from '../screens/admin/Schedule';
import SendPushNotificationScreen
  from '../screens/admin/SendPushNotificationScreen';
import ServiceManagementScreen from '../screens/admin/ServiceManagementScreen';
import SettingsScreen from '../screens/admin/SettingsScreen';
import StaffOnLeaveScreen from '../screens/admin/StaffOnLeave';
import TherapistsScreen from '../screens/admin/Therapist';
import TherapistAvailabilityScreen
  from '../screens/admin/TherapistAvailability';
import TherapistScheduleScreen from '../screens/admin/TherapistScheduleScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPassword';
import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import ChildProfileScreen from '../screens/auth/ProfileScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import WelcomeScreen from '../screens/auth/Welcome';
import ChildAddFeedbackScreen from '../screens/child/AddFeedback';
import AttendanceScreen from '../screens/child/Attendence';
import ChatDetailsScreen from '../screens/child/ChatDetails';
import ChildDashboard from '../screens/child/ChildDashboard';
import ChildVideoScreen from '../screens/child/ChildVideo';
import ComplaintDetailsScreen from '../screens/child/ComplaintDetails';
import ComplaintsScreen from '../screens/child/Complaints';
import ChildFeedbackScreen from '../screens/child/Feedback';
import ChildInvoicesScreen from '../screens/child/Invoice';
import MessagingScreen from '../screens/child/Messages';
import ReportScreen from '../screens/child/Report';
import AddFeedbackScreen from '../screens/therapist/AddFeedback';
import AssignedChildrenScreen from '../screens/therapist/AssignedChildren';
import AttendanceTrackingScreen from '../screens/therapist/AttendanceTracking';
import FeedbackManagementScreen from '../screens/therapist/FeedbackManagement';
import LeaveRequestScreen from '../screens/therapist/LeaveRequest';
import ProgressTrackingScreen from '../screens/therapist/ProgressTracking';
import QuarterlyReportsScreen from '../screens/therapist/QuarterlyReports';
import TherapistDashboard from '../screens/therapist/TherapistDashboard';
import WeeklyVideoScreen from '../screens/therapist/WeeklyVideo';
import { commonStyles } from '../styles/theme';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const DEFAULT_LAYOUT = {
  showHeader: true,
  showFooter: true,
  headerTitle: "",
};

const SCREEN_LAYOUTS = {
  Admin: {
    AdminDashboard: { showHeader: false, showFooter: true },
    LeaveRequest: { headerTitle: "Leave Requests" },
    Therapist: { headerTitle: "Therapists" },
    Children: { headerTitle: "Children" },
    Schedule: { headerTitle: "Schedule" },
    Feedback: { headerTitle: "Feedback" },
    BatchManagment: { headerTitle: "Batch Management" },
    BroadcastManagement: { headerTitle: "Broadcast Management" },
    ComplainManagement: { headerTitle: "Complaint Management" },
    FeeManagement: { headerTitle: "Fee Management" },
    AddNewPackage: { headerTitle: "Package" },
    InvoiceManagement: { headerTitle: "Invoice Management" },
    CreateNewInvoice: { headerTitle: "Create Invoice" },
    InvoiceDetail: { headerTitle: "Invoice Details" },
    Notifications: { headerTitle: "Notifications" },
    TherapistAvailability: { headerTitle: "Therapist Availability" },
    BatchSchedule: { headerTitle: "Batch Schedule" },
    BatchScheduleCreate: { headerTitle: "Create Batch Schedule" },
    StaffOnLeave: { headerTitle: "Staff on Leave Today" },
    ChildMessages: { headerTitle: "Messages" },
    ChatDetails: { showFooter: false, showHeader: false, headerTitle: "Chat" },
    ChildProfile: { headerTitle: "Profile" },
    BatchSessionPostpone: { headerTitle: "Postpone Session" },
    BatchAdditionalClass: { headerTitle: "Additional Class" },
    TherapistSchedule: { headerTitle: "Therapist Schedule" },
    ChildSchedule: { headerTitle: "Child Schedule" },
    ChildCustomAppointment: { headerTitle: "Custom Appointment" },
    AllPackages: { headerTitle: "All Packages" },
    ServiceManagement: { headerTitle: "Service Management" },
    ProgramBuilder: { headerTitle: "Program Builder" },
    InvoiceView: { headerTitle: "Invoice" },
    Settings: { headerTitle: "Settings" },
    ChildForm: { headerTitle: "Child Form" },
    ChildDetails: { showHeader: false, showFooter: false },
    SendPushNotification: { headerTitle: "Send Notification" },
    AllUsers: { headerTitle: "All Users" },
  },
  Therapist: {
    TherapistDashboard: { showHeader: false, showFooter: true },
    AssignedChildren: { headerTitle: "Assigned Children" },
    FeedbackManagement: { headerTitle: "Feedback Management" },
    AddFeedback: { headerTitle: "Feedback" },
    AttendanceTracking: { headerTitle: "Attendance Tracking" },
    WeeklyVideo: { headerTitle: "Weekly Videos" },
    LeaveRequest: { headerTitle: "Leave Request" },
    QuarterlyReports: { headerTitle: "Quarterly Reports" },
    ProgressTracking: { headerTitle: "Progress Tracking" },
    ChildMessages: { headerTitle: "Messages" },
    ChatDetails: { showFooter: false, showHeader: false, headerTitle: "Chat" },
    ChildProfile: { headerTitle: "Profile" },
    Notifications: { headerTitle: "Notifications" },
    TherapistComplaints: { headerTitle: "Complaints" },
    ComplaintDetails: { headerTitle: "Complaint Details" },
  },
  Child: {
    ChildDashboard: { showHeader: false, showFooter: true },
    ChildFeedback: { headerTitle: "Feedback" },
    CreateFeedback: { headerTitle: "Create Feedback" },
    ChildAttendance: { headerTitle: "Attendance" },
    ChildVideo: { headerTitle: "Videos" },
    ChildMessages: { headerTitle: "Messages" },
    ChatDetails: { showFooter: false, showHeader: false, headerTitle: "Chat" },
    ChildReport: { headerTitle: "Reports" },
    Notifications: { headerTitle: "Notifications" },
    ChildProfile: { headerTitle: "Profile" },
    ChildComplaints: { headerTitle: "Complaints" },
    ComplaintDetails: { headerTitle: "Complaint Details" },
    ChildInvoices: { headerTitle: "Invoices" },
    InvoiceView: { headerTitle: "Invoice" },
  },
};

const ACTIVE_TAB_ROUTES = {
  Admin: {
    AdminDashboard: "AdminDashboard",
    Therapist: "Therapist",
    TherapistAvailability: "Therapist",
    TherapistSchedule: "Therapist",
    Children: "Children",
    ChildDetails: "Children",
    ChildForm: "Children",
    Schedule: "Schedule",
    Notifications: "Notifications",
    ChildSchedule: "Schedule",
    BatchSchedule: "Schedule",
    BatchScheduleCreate: "Schedule",
    ChildCustomAppointment: "Schedule",
    BatchSessionPostpone: "Schedule",
    BatchAdditionalClass: "Schedule",
    Feedback: "Feedback",
    LeaveRequest: "AdminDashboard",
    StaffOnLeave: "AdminDashboard",
    BatchManagment: "AdminDashboard",
    BroadcastManagement: "AdminDashboard",
    ComplainManagement: "AdminDashboard",
    FeeManagement: "AdminDashboard",
    AddNewPackage: "AdminDashboard",
    InvoiceManagement: "AdminDashboard",
    CreateNewInvoice: "AdminDashboard",
    InvoiceDetail: "AdminDashboard",
    AllPackages: "AdminDashboard",
    ServiceManagement: "AdminDashboard",
    ProgramBuilder: "AdminDashboard",
    InvoiceView: "AdminDashboard",
    Settings: "AdminDashboard",
    SendPushNotification: "AdminDashboard",
    AllUsers: "AdminDashboard",
  },
  Therapist: {
    TherapistDashboard: "TherapistDashboard",
    AssignedChildren: "AssignedChildren",
    FeedbackManagement: "FeedbackManagement",
    AddFeedback: "FeedbackManagement",
    AttendanceTracking: "AttendanceTracking",
    WeeklyVideo: "TherapistDashboard",
    QuarterlyReports: "AssignedChildren",
    ProgressTracking: "AssignedChildren",
    LeaveRequest: "TherapistDashboard",
    TherapistComplaints: "TherapistDashboard",
    ComplaintDetails: "TherapistDashboard",
    Notifications: "Notifications",
  },
  Child: {
    ChildDashboard: "ChildDashboard",
    ChildFeedback: "ChildFeedback",
    CreateFeedback: "ChildFeedback",
    ChildAttendance: "Attendance",
    ChildVideo: "Videos",
    ChildReport: "Reports",
    ChildMessages: "ChildDashboard",
    ChildInvoices: "ChildDashboard",
    ChildComplaints: "ChildDashboard",
    ComplaintDetails: "ChildDashboard",
    Notifications: "Notifications",
    ChildAttendance: "ChildAttendance",
  },
};

const AUTH_SCREENS = [
  ["Onboarding", OnboardingScreen],
  ["Welcome", WelcomeScreen],
  ["Login", LoginScreen],
  ["Register", RegisterScreen],
  ["ForgotPassword", ForgotPasswordScreen],
];

const ADMIN_SCREENS = [
  ["AdminDashboard", AdminDashboard],
  ["LeaveRequest", LeaveRequestsScreen],
  ["Therapist", TherapistsScreen],
  ["Children", ChildrenScreen],
  ["Schedule", ScheduleScreen],
  ["Feedback", FeedbackScreen],
  ["BatchManagment", BatchManagementScreen],
  ["BroadcastManagement", BroadcastManagementScreen],
  ["ComplainManagement", ComplainManagementScreen],
  ["FeeManagement", FeeManagementScreen],
  ["AddNewPackage", AddNewPackageScreen],
  ["InvoiceManagement", InvoiceManagementScreen],
  ["CreateNewInvoice", CreateNewInvoiceScreen],
  ["InvoiceDetail", InvoiceDetailScreen],
  ["Notifications", NotificationScreen],
  ["TherapistAvailability", TherapistAvailabilityScreen],
  ["BatchSchedule", BatchScheduleScreen],
  ["BatchScheduleCreate", BatchScheduleCreateScreen],
  ["StaffOnLeave", StaffOnLeaveScreen],
  ["ChildMessages", MessagingScreen],
  ["ChatDetails", ChatDetailsScreen],
  ["ChildProfile", ChildProfileScreen],
  ["BatchSessionPostpone", BatchSessionPostponeScreen],
  ["BatchAdditionalClass", BatchAdditionalClassScreen],
  ["TherapistSchedule", TherapistScheduleScreen],
  ["ChildSchedule", ChildScheduleScreen],
  ["ChildCustomAppointment", ChildCustomAppointmentScreen],
  ["AllPackages", AllPackagesScreen],
  ["ServiceManagement", ServiceManagementScreen],
  ["ProgramBuilder", ProgramBuilderScreen],
  ["InvoiceView", InvoiceViewScreen],
  ["Settings", SettingsScreen],
  ["ChildForm", ChildFormScreen],
  ["ChildDetails", ChildDetailsScreen],
  ["SendPushNotification", SendPushNotificationScreen],
  ["AllUsers", AllUsersScreen],
];

const THERAPIST_SCREENS = [
  ["TherapistDashboard", TherapistDashboard],
  ["AssignedChildren", AssignedChildrenScreen],
  ["FeedbackManagement", FeedbackManagementScreen],
  ["AddFeedback", AddFeedbackScreen],
  ["AttendanceTracking", AttendanceTrackingScreen],
  ["WeeklyVideo", WeeklyVideoScreen],
  ["LeaveRequest", LeaveRequestScreen],
  ["QuarterlyReports", QuarterlyReportsScreen],
  ["ProgressTracking", ProgressTrackingScreen],
  ["ChildMessages", MessagingScreen],
  ["ChatDetails", ChatDetailsScreen],
  ["ChildProfile", ChildProfileScreen],
  ["Notifications", NotificationScreen],
  ["TherapistComplaints", ComplaintsScreen],
  ["ComplaintDetails", ComplaintDetailsScreen],
];

const CHILD_SCREENS = [
  ["ChildDashboard", ChildDashboard],
  ["ChildFeedback", ChildFeedbackScreen],
  ["CreateFeedback", ChildAddFeedbackScreen],
  ["ChildAttendance", AttendanceScreen],
  ["ChildVideo", ChildVideoScreen],
  ["ChildMessages", MessagingScreen],
  ["ChatDetails", ChatDetailsScreen],
  ["ChildReport", ReportScreen],
  ["Notifications", NotificationScreen],
  ["ChildProfile", ChildProfileScreen],
  ["ChildComplaints", ComplaintsScreen],
  ["ComplaintDetails", ComplaintDetailsScreen],
  ["ChildInvoices", ChildInvoicesScreen],
  ["InvoiceView", InvoiceViewScreen],
];

function ScreenStack({ screens, initialRouteName }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      {screens.map(([name, component]) => (
        <Stack.Screen
          key={name}
          name={name}
          component={component}
        />
      ))}
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <ScreenStack
      screens={AUTH_SCREENS}
      initialRouteName="Onboarding"
    />
  );
}

function AdminStack() {
  return (
    <ScreenStack
      screens={ADMIN_SCREENS}
      initialRouteName="AdminDashboard"
    />
  );
}

function TherapistStack() {
  return (
    <ScreenStack
      screens={THERAPIST_SCREENS}
      initialRouteName="TherapistDashboard"
    />
  );
}

function ChildStack() {
  return (
    <ScreenStack
      screens={CHILD_SCREENS}
      initialRouteName="ChildDashboard"
    />
  );
}

function getActiveRoute(state) {
  if (!state?.routes?.length) return null;

  const route = state.routes[state.index ?? 0];

  return route.state ? getActiveRoute(route.state) : route;
}

export default function AppNavigator() {
  const { token, userRole, isLoading } = useContext(AuthContext);
  const normalizedRole = userRole?.toString().trim();

  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [activeTab, setActiveTab] = useState("AdminDashboard");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const updateLayout = useCallback(() => {
    if (!navigationRef.isReady()) return;

    const route = getActiveRoute(navigationRef.getRootState());

    if (!route) return;

    const routeLayout = SCREEN_LAYOUTS[normalizedRole]?.[route.name] || {};
    const overrideLayout = route.params?.layout || {};

    setLayout((previous) => {
      const next = {
        ...DEFAULT_LAYOUT,
        ...routeLayout,
        ...overrideLayout,
      };

      if (
        previous.showHeader === next.showHeader
        && previous.showFooter === next.showFooter
        && previous.headerTitle === next.headerTitle
      ) {
        return previous;
      }

      return next;
    });

    const nextTab = ACTIVE_TAB_ROUTES[normalizedRole]?.[route.name];

    if (nextTab) {
      setActiveTab((previous) => previous === nextTab ? previous : nextTab);
    }
  }, [normalizedRole]);

  useEffect(() => {
    if (!token) {
      setLayout(DEFAULT_LAYOUT);
      setActiveTab("AdminDashboard");
      setIsNotificationOpen(false);
      return;
    }

    setActiveTab("AdminDashboard");
    updateLayout();
  }, [token, normalizedRole, updateLayout]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isAuthenticatedRole = !!token && ["Admin", "Therapist", "Child"].includes(normalizedRole);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={updateLayout}
      onStateChange={updateLayout}
    >
      {!isAuthenticatedRole ? <AuthStack /> : (
        <SafeAreaView
          style={[styles.container, commonStyles.container]}
        >
          <View
            style={layout.showHeader
              ? styles.visible
              : styles.hidden}
          >
            <TopBar
              navigation={navigationRef}
              headerTitle={layout.headerTitle}
              isNotificationOpen={isNotificationOpen}
              onToggleNotification={setIsNotificationOpen}
            />
          </View>

          <View style={styles.content}>
            {normalizedRole === "Admin"
              ? <AdminStack />
              : normalizedRole === "Therapist"
              ? <TherapistStack />
              : <ChildStack />}
          </View>

          <View
            style={layout.showFooter
              ? styles.visible
              : styles.hidden}
          >
            <BottomBar
              navigation={navigationRef}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </View>

          {/* Visible on every impersonated Child/Therapist screen */}
          <BackToAdminButton />
        </SafeAreaView>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  visible: {
    display: "flex",
  },
  hidden: {
    display: "none",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
