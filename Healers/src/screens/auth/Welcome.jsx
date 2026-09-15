import React from 'react';

import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

import {
  colors,
  fonts,
} from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
 const onCreateAccount = () => {
    navigation.navigate("Register");
  };
   const onLogin = () => {
    navigation.navigate("Login");
  };
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Image
          source={require("../../asstes/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.headerBrand}>HEALERS INSTITUTION</Text>
      </View>

      <View style={styles.heroCardContainer}>
        <Image
          source={require("../../asstes/welcome_hero.jpeg")}
          style={styles.heroImage}
          resizeMode="cover"
        />

        <View style={styles.progressChip}>
          <View style={styles.progressIconBox}>
            <View style={styles.progressBox}>
              <MaterialIcons name="favorite-border" size={14} color="#0D7A5F" />
            </View>
            <Text style={styles.progressChipTitle}>Progress</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={styles.progressBarFill} />
          </View>
        </View>

        <View style={styles.certifiedChip}>
          <View style={styles.certifiedIconBox}>
            <MaterialIcons name="verified" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.certifiedTextContainer}>
            <Text style={styles.certifiedTitle}>Certified Care</Text>
            <Text style={styles.certifiedSubtitle}>Expert therapeutic staff</Text>
          </View>
        </View>
      </View>

      <View style={styles.badgeTag}>
        <MaterialIcons name="auto-awesome" size={14} color="#D97706" style={{ marginRight: 6 }} />
        <Text style={styles.badgeText}>A Passion for Holistic Healing</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          Welcome to {"\n"}
          <Text style={styles.titleHighlight}>Healers</Text>
          {"\n"}Institution
        </Text>

        <Text style={styles.subtitle}>
          Supporting children with compassion, expert care, and personalized therapy.
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onCreateAccount}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F3F9FC",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  headerBrand: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#0B4A6F",
    letterSpacing: 0.5,
  },
  heroCardContainer: {
    width: "100%",
    height: 290,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    marginBottom: 20,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },

  progressChip: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    width: 120,
  },
  progressIconBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  progressBox:{
    backgroundColor:"rgba(0,107,88,.1)",
    padding:8,
    paddingBottom:16,
    borderRadius:8
    
  },
  progressChipTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    width: "70%",
    height: "100%",
    backgroundColor: "#006B58",
    borderRadius: 3,
  },

  certifiedChip: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 30,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    padding: 16,
    borderRadius: 16,
    gap: 16,
    width:240,
  },
  certifiedIconBox: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  certifiedTextContainer: {
    flex: 1,
  },
  certifiedTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight:16
  },
  certifiedSubtitle: {
    fontSize: 12,
    color: "#414750",
    fontFamily: fonts.regular,
  },

  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(139,246,217,.2)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: {
    color: "#00725E",
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },

  content: {
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 40,
    marginBottom: 12,
  },
  titleHighlight: {
    color: "#006B58",
  },
  subtitle: {
    fontSize: 16,
    color: "#414750",
    fontFamily: fonts.regular,
    lineHeight: 28,
  },

  actionContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1669A9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
