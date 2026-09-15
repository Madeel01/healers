import React, { useState } from 'react';

import * as LocalAuthentication from 'expo-local-authentication';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { registerUser } from '../../api/authService';
import {
  colors,
  fonts,
} from '../../styles/theme';

const generateUUID = () => "bio-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [fullName, setFullName] = useState("Adeel");
  const [email, setEmail] = useState("madeel@callhub.cc");
  const [phone, setPhone] = useState("03049338244");
  const [password, setPassword] = useState("test@123");
  const [confirmPassword, setConfirmPassword] = useState("test@123");
  const [enableBiometrics, setEnableBiometrics] = useState(false); // Toggle biometric enrollment
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const onBackToLogin = () => {
    navigation.navigate("Login");
  };

  const handleRegister = async () => {
    if (!fullName || (!email && !phone) || !password) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match.");
      return;
    }

    if (!agreeTerms) {
      Alert.alert("Terms Agreement", "Please accept the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      let biometricKey = null;

      if (enableBiometrics) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: "Scan fingerprint/Face ID to enable biometric login",
            fallbackLabel: "Cancel",
          });

          if (authResult.success) {
            biometricKey = generateUUID();
          } else {
            Alert.alert("Notice", "Biometric setup cancelled. Continuing registration without biometrics.");
          }
        } else {
          Alert.alert("Notice", "Biometrics not available or not configured on this device.");
        }
      }

      const payload = {
        fullName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        agreeTerms,
        role: "Child",
        biometricKey,
      };

      const result = await registerUser(payload);

      if (biometricKey) {
        await AsyncStorage.setItem("deviceBiometricKey", biometricKey);
      }

      Alert.alert("Success", "Account registered successfully!");

      navigation.navigate("Login");
    } catch (error) {
      console.log("e", error.response?.data);
      const errorMessage = error.response?.data?.message || "Something went wrong. Please try again.";
      Alert.alert("Registration Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBackToLogin}
        activeOpacity={0.7}
      >
        <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
        <Text style={styles.backButtonText}>Back to Login</Text>
      </TouchableOpacity>

      <View style={styles.cardContainer}>
        <Text style={styles.title}>Join our Community</Text>
        <Text style={styles.subtitle}>
          Create your account to access personalized growth tools.
        </Text>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="Jane Doe"
              placeholderTextColor="#6B7280"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="mail-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="jane@example.com"
              placeholderTextColor="#6B7280"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="phone" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="(555) 000-0000"
              placeholderTextColor="#6B7280"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#6B7280"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <Octicons name="shield-check" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#6B7280"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setEnableBiometrics(!enableBiometrics)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, enableBiometrics && styles.checkboxActive]}>
            {enableBiometrics && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>Enable Biometric Login</Text>
        </TouchableOpacity>

        {/* Terms Checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreeTerms(!agreeTerms)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
            {agreeTerms && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I agree to the <Text style={styles.linkText}>Terms and Conditions</Text> and{" "}
            <Text style={styles.linkText}>Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Text style={styles.registerButtonText}>Register Account</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={onBackToLogin} activeOpacity={0.7}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F7FB",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#414750",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#414750",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F4F7",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#1E293B",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: "#0B4A6F",
    borderColor: "#0B4A6F",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#475569",
    lineHeight: 20,
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.regular,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    height: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: fonts.regular,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#414750",
  },
  signInText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
  },
});
