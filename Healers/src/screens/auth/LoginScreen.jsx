import React, {
  useContext,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import {
  loginUser,
  loginWithBiometrics,
} from '../../api/authService';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  fonts,
} from '../../styles/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { login } = useContext(AuthContext);

  const [identifier, setIdentifier] = useState("therapist@gmail.com");
  // const [identifier, setIdentifier] = useState("madeel@callhub.cc");
  const [password, setPassword] = useState("test@123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = () => {
    navigation.navigate("Register");
  };

  const handleForgotPassword = () => {
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert("Validation Error", "Please enter your email/phone and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser(identifier.trim(), password);
      
      await login(response.token, response.user);
      Alert.alert("Success", "Logged in successfully!");
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Invalid credentials or connection issue.";
      Alert.alert("Login Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setLoading(true);
    try {
      const response = await loginWithBiometrics();

      await login(response.token, response.user);
      Alert.alert("Success", "Biometric Login Successful!");
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Biometric authentication failed.";
      Alert.alert("Authentication Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.footerBgCard}>
        <Image
          source={require("../../asstes/slide2_bg4.png")}
          style={styles.footerBgImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.header}>
        <Image
          source={require("../../asstes/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Continue your journey of healing and growth.
        </Text>
      </View>

      <View style={styles.cardContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email or Phone</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              value={identifier}
              onChangeText={setIdentifier}
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
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={showPassword ? "visibility" : "visibility-off"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>Remember Me</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.biometricSection}>
          <Text style={styles.biometricLabel}>Or use biometrics</Text>
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="fingerprint" size={32} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity onPress={handleCreateAccount} activeOpacity={0.7}>
          <Text style={styles.createAccountText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F7FB",
  },
  footerBgCard: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -50,
    alignItems: "center",
  },
  footerBgImage: {
    width: 400,
    height: 400,
    opacity: 0.2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#717781",
    textAlign: "center",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
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
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#414750",
  },
  forgotText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical:16,
    justify: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#1669A9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  biometricSection: {
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  biometricLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#717781",
    marginBottom: 12,
  },
  biometricButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E5E8EB",
    justifyContent: "center",
    alignItems: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  footerText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#414750",
  },
  createAccountText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    paddingLeft: 4,
  },
});