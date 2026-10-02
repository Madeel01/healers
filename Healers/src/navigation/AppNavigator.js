import { useContext } from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthContext } from '../context/AuthContext';
import AddNewPackageScreen from '../screens/admin/AddNewPackage';
import AdminDashboard from '../screens/admin/AdminDashboard';
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
import ChildrenScreen from '../screens/admin/Children';
import ChildScheduleScreen from '../screens/admin/ChildScheduleScreen';
import ComplainManagementScreen from '../screens/admin/ComplainManagement';
import CreateNewInvoiceScreen from '../screens/admin/CreateNewInvoice';
import FeedbackScreen from '../screens/admin/Feedback';
import FeeManagementScreen from '../screens/admin/FeeManagement';
import InvoiceDetailScreen from '../screens/admin/InvoiceDetailScreen';
import InvoiceManagementScreen from '../screens/admin/InvoiceManagement';
import LeaveRequestsScreen from '../screens/admin/LeaveRequest';
import NotificationScreen from '../screens/admin/Notification';
import ProgramBuilderScreen from '../screens/admin/ProgramBuilder';
import ScheduleScreen from '../screens/admin/Schedule';
import StaffOnLeaveScreen from '../screens/admin/StaffOnLeave';
import TherapistsScreen from '../screens/admin/Therapist';
import TherapistAvailabilityScreen
  from '../screens/admin/TherapistAvailability';
import TherapistScheduleScreen from '../screens/admin/TherapistScheduleScreen';
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
import ChildFeedbackScreen from '../screens/child/Feedback';
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

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator initialRouteName="AdminDashboard" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestsScreen} />
      <Stack.Screen name="Therapist" component={TherapistsScreen} />
      <Stack.Screen name="Children" component={ChildrenScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="BatchManagment" component={BatchManagementScreen} />
      <Stack.Screen name="BroadcastManagement" component={BroadcastManagementScreen} />
      <Stack.Screen name="ComplainManagement" component={ComplainManagementScreen} />
      <Stack.Screen name="FeeManagement" component={FeeManagementScreen} />
      <Stack.Screen name="AddNewPackage" component={AddNewPackageScreen} />
      <Stack.Screen name="InvoiceManagement" component={InvoiceManagementScreen} />
      <Stack.Screen name="CreateNewInvoice" component={CreateNewInvoiceScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="TherapistAvailability" component={TherapistAvailabilityScreen} />
      <Stack.Screen name="BatchSchedule" component={BatchScheduleScreen} />
      <Stack.Screen name="BatchScheduleCreate" component={BatchScheduleCreateScreen} />
      <Stack.Screen name="StaffOnLeave" component={StaffOnLeaveScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChildMessages" component={MessagingScreen} />
      <Stack.Screen name="ChatDetails" component={ChatDetailsScreen} />
      <Stack.Screen name="ChildProfile" component={ChildProfileScreen} />
      <Stack.Screen name="BatchSessionPostpone" component={BatchSessionPostponeScreen} />
      <Stack.Screen name="BatchAdditionalClass" component={BatchAdditionalClassScreen} />
      <Stack.Screen name="TherapistSchedule" component={TherapistScheduleScreen} />
      <Stack.Screen name="ChildSchedule" component={ChildScheduleScreen} />
      <Stack.Screen name="ChildCustomAppointment" component={ChildCustomAppointmentScreen} />

      <Stack.Screen name="ProgramBuilder" component={ProgramBuilderScreen} />
    </Stack.Navigator>
  );
}

function TherapistStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TherapistDashboard" component={TherapistDashboard} />
      <Stack.Screen name="AssignedChildren" component={AssignedChildrenScreen} />
      <Stack.Screen name="FeedbackManagement" component={FeedbackManagementScreen} />
      <Stack.Screen name="AddFeedback" component={AddFeedbackScreen} />
      <Stack.Screen name="AttendanceTracking" component={AttendanceTrackingScreen} />
      <Stack.Screen name="WeeklyVideo" component={WeeklyVideoScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="QuarterlyReports" component={QuarterlyReportsScreen} />
      <Stack.Screen name="ProgressTracking" component={ProgressTrackingScreen} />
      <Stack.Screen name="ChildMessages" component={MessagingScreen} />
      <Stack.Screen name="ChatDetails" component={ChatDetailsScreen} />
      <Stack.Screen name="ChildProfile" component={ChildProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
    </Stack.Navigator>
  );
}

function ChildStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChildDashboard" component={ChildDashboard} />
      <Stack.Screen name="ChildFeedback" component={ChildFeedbackScreen} />
      <Stack.Screen name="CreateFeedback" component={ChildAddFeedbackScreen} />
      <Stack.Screen name="ChildAttendance" component={AttendanceScreen} />
      <Stack.Screen name="ChildVideo" component={ChildVideoScreen} />
      <Stack.Screen name="ChildMessages" component={MessagingScreen} />
      <Stack.Screen name="ChatDetails" component={ChatDetailsScreen} />
      <Stack.Screen name="ChildReport" component={ReportScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="ChildProfile" component={ChildProfileScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { token, userRole, isLoading } = useContext(AuthContext);
  const normalizedRole = userRole?.toString().trim();
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!token
        ? <AuthStack />
        : normalizedRole === "Admin"
        ? <AdminStack />
        : normalizedRole === "Therapist"
        ? <TherapistStack />
        : normalizedRole === "Child"
        ? <ChildStack />
        : <AuthStack />}
    </NavigationContainer>
  );
}
