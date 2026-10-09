import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  forgotPasswordApi,
  resetPasswordApi,
  verifyResetOtpApi,
} from '../../api/authService';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

  const normalizedEmail = email.trim().toLowerCase();

  // STEP 1: REQUEST OTP
  const handleRequestOtp = async () => {
    if (!normalizedEmail) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      await forgotPasswordApi(normalizedEmail);

      Keyboard.dismiss();
      setOtp("");
      setStep(2);

      Alert.alert(
        "Check Email",
        "If your email is registered, a 6-digit code has been sent."
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          error.message ||
          "Unable to send verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: VERIFY OTP
  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp.trim())) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const response = await verifyResetOtpApi(
        normalizedEmail,
        otp.trim()
      );

      if (!response?.resetToken) {
        throw new Error("Reset token was not received.");
      }

      setResetToken(response.resetToken);
      Keyboard.dismiss();
      setStep(3);
    } catch (error) {
      Alert.alert(
        "Verification Failed",
        error.response?.data?.message ||
          error.message ||
          "Invalid or expired OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: RESET PASSWORD
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert(
        "Error",
        "Please fill in both password fields."
      );
      return;
    }

    if (!passwordRegex.test(newPassword)) {
      Alert.alert(
        "Invalid Password",
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, and one special character."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (!resetToken) {
      Alert.alert(
        "Session Expired",
        "Please verify your OTP again."
      );
      setStep(2);
      return;
    }

    setLoading(true);

    try {
      await resetPasswordApi(resetToken, newPassword);

      Keyboard.dismiss();

      Alert.alert(
        "Success",
        "Password changed successfully.",
        [
          {
            text: "Login",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          error.message ||
          "Password reset failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === 1
      ? "Forgot Password"
      : step === 2
      ? "Verify OTP"
      : "Create New Password";

  const handleContinue =
    step === 1
      ? handleRequestOtp
      : step === 2
      ? handleVerifyOtp
      : handleResetPassword;

  const passwordRequirements = [
    {
      label: "At least 8 characters",
      valid: newPassword.length >= 8,
    },
    {
      label: "One uppercase letter (A-Z)",
      valid: /[A-Z]/.test(newPassword),
    },
    {
      label: "One lowercase letter (a-z)",
      valid: /[a-z]/.test(newPassword),
    },
    {
      label: "One special character (!@#$...)",
      valid: /[^A-Za-z0-9]/.test(newPassword),
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={commonStyles.container}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        <Image
          source={require("../../asstes/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <Text style={styles.title}>{title}</Text>

        {step === 1 && (
          <>
            <Text style={styles.description}>
              Enter your registered email address.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="done"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={Keyboard.dismiss}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.description}>
              Enter the 6-digit code sent to {normalizedEmail}.
              The code expires in 5 minutes.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="6-digit OTP"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(text) =>
                setOtp(text.replace(/\D/g, ""))
              }
              returnKeyType="done"
            />

            <TouchableOpacity
              onPress={handleRequestOtp}
              disabled={loading}
              style={styles.button3}
              activeOpacity={0.7}
            >
              <Text style={styles.link}>Resend Code</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.description}>
              Create a strong password for your account.
            </Text>

            {/* NEW PASSWORD */}
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="New password"
                placeholderTextColor="#6B7280"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="next"
              />

              <TouchableOpacity
                onPress={() =>
                  setShowNewPassword((previous) => !previous)
                }
                activeOpacity={0.7}
                accessibilityLabel={
                  showNewPassword
                    ? "Hide new password"
                    : "Show new password"
                }
              >
                <MaterialIcons
                  name={
                    showNewPassword
                      ? "visibility"
                      : "visibility-off"
                  }
                  size={22}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* PASSWORD REQUIREMENTS */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>
                Password must contain:
              </Text>

              {passwordRequirements.map((item, index) => (
                <View
                  key={index}
                  style={styles.requirementRow}
                >
                  <MaterialIcons
                    name={
                      item.valid
                        ? "check-circle"
                        : "radio-button-unchecked"
                    }
                    size={16}
                    color={
                      item.valid ? "#16A34A" : "#9CA3AF"
                    }
                  />

                  <Text
                    style={[
                      styles.requirementText,
                      item.valid && styles.requirementValid,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* CONFIRM PASSWORD */}
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm password"
                placeholderTextColor="#6B7280"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowConfirmPassword(
                    (previous) => !previous
                  )
                }
                activeOpacity={0.7}
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                <MaterialIcons
                  name={
                    showConfirmPassword
                      ? "visibility"
                      : "visibility-off"
                  }
                  size={22}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* PASSWORD MATCH STATUS */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchRow}>
                <MaterialIcons
                  name={
                    newPassword === confirmPassword
                      ? "check-circle"
                      : "cancel"
                  }
                  size={16}
                  color={
                    newPassword === confirmPassword
                      ? "#16A34A"
                      : "#DC2626"
                  }
                />

                <Text
                  style={[
                    styles.matchText,
                    {
                      color:
                        newPassword === confirmPassword
                          ? "#16A34A"
                          : "#DC2626",
                    },
                  ]}
                >
                  {newPassword === confirmPassword
                    ? "Passwords match"
                    : "Passwords do not match"}
                </Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {step === 1
                ? "Send Code"
                : step === 2
                ? "Verify Code"
                : "Change Password"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button2}
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate("Login");
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.link}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.primary,
    textAlign: "center",
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#717781",
    textAlign: "center",
    marginBottom: 16,
  },

  input: {
    backgroundColor: "#eeecec",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    color: "#1E293B",
    width: "100%",
    marginBottom: 8,
    fontFamily: fonts.regular,
  },

  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eeecec",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    width: "100%",
    marginBottom: 12,
  },

  passwordInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#1E293B",
    paddingRight: 10,
    height: "100%",
  },

  requirementsContainer: {
    width: "100%",
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  requirementsTitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#414750",
    marginBottom: 8,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },

  requirementText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#9CA3AF",
  },

  requirementValid: {
    color: "#16A34A",
  },

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    marginBottom: 8,
  },

  matchText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#1669A9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    width: "100%",
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: fonts.semiBold,
    lineHeight: 24,
  },

  button2: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#1669A9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    width: "100%",
  },

  button3: {
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },

  link: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
    lineHeight: 24,
  },
});
