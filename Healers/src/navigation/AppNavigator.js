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
import BroadcastManagementScreen from '../screens/admin/BroadcastManagement';
import ComplainManagementScreen from '../screens/admin/ComplainManagement';
import CreateNewInvoiceScreen from '../screens/admin/CreateNewInvoice';
import FeedbackScreen from '../screens/admin/Feedback';
import FeeManagementScreen from '../screens/admin/FeeManagement';
import InvoiceDetailScreen from '../screens/admin/InvoiceDetailScreen';
import InvoiceManagementScreen from '../screens/admin/InvoiceManagement';
import LeaveRequestsScreen from '../screens/admin/LeaveRequest';
import TherapistsScreen from '../screens/admin/Therapist';
import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import WelcomeScreen from '../screens/auth/Welcome';
import ChildDashboard from '../screens/child/ChildDashboard';
import AddFeedbackScreen from '../screens/therapist/AddFeedback';
import AssignedChildrenScreen from '../screens/therapist/AssignedChildren';
import AttendanceTrackingScreen from '../screens/therapist/AttendanceTracking';
import FeedbackManagementScreen from '../screens/therapist/FeedbackManagement';
import LeaveRequestScreen from '../screens/therapist/LeaveRequest';
import ProgramBuilderScreen from '../screens/therapist/ProgramBuilder';
import ProgressTrackingScreen from '../screens/therapist/ProgressTracking';
import QuarterlyReportsScreen from '../screens/therapist/QuarterlyReports';
import TherapistDashboard from '../screens/therapist/TherapistDashboard';

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
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="BroadcastManagement" component={BroadcastManagementScreen} />
      <Stack.Screen name="ComplainManagement" component={ComplainManagementScreen} />
      <Stack.Screen name="FeeManagement" component={FeeManagementScreen} />
      <Stack.Screen name="AddNewPackage" component={AddNewPackageScreen} />
      <Stack.Screen name="InvoiceManagement" component={InvoiceManagementScreen} />
      <Stack.Screen name="CreateNewInvoice" component={CreateNewInvoiceScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
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
      <Stack.Screen name="ProgramBuilder" component={ProgramBuilderScreen} />
      {/* <Stack.Screen name="WeeklyVideo" component={WeeklyVideoScreen} /> */}
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="QuarterlyReports" component={QuarterlyReportsScreen} />
      <Stack.Screen name="ProgressTracking" component={ProgressTrackingScreen} />
    </Stack.Navigator>
  );
}

function ChildStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChildDashboard" component={ChildDashboard} />
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
