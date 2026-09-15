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

import {
  colors,
  commonStyles,
  fonts,
} from '../../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SlideThree({ onNext, onSkip, step, totalSteps, onDotPress }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBgCard}>
        <Image
          source={require("../../../asstes/slide2_bg3.png")}
          style={styles.bgImage}
          resizeMode="cover"
        />
      </View>
      <View style={[styles.header, { paddingTop: 10 }]}>
        <View style={styles.imageHeader}>
          <Image
            source={require("../../../asstes/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.headerBrand}>HEALERS INSTITUTION</Text>
        </View>

        <TouchableOpacity style={styles.skipTextWrapper} onPress={onNext} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.graphicsCard}>
        <View style={[styles.avatarWrapper, { zIndex: 3 }]}>
          <Image
            source={require("../../../asstes/admin.png")}
            style={styles.avatarSmall}
          />
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Admin</Text>
          </View>
        </View>

        <View style={[styles.avatarWrapper, styles.childAvatarWrapper, { zIndex: 2 }]}>
          <View style={styles.messageChip}>
            <Text style={styles.chatIconText}>
              <MaterialIcons name="message" size={24} color="#006b58" />
            </Text>
            <View style={styles.chipBar} />
          </View>
         
          <Image
            source={require("../../../asstes/child.png")}
            style={styles.avatarLarge}
          />
          <View style={[styles.roleBadge, styles.childRoleBadge]}>
            <Text style={[styles.roleText, styles.childRoleText]}>The Child</Text>
          </View>
        </View>

        <View style={[styles.avatarWrapper, { zIndex: 1 }]}>

          <View style={[styles.messageChip, styles.analyticsChip]}>
            <Text style={styles.chatIconText}>
              <MaterialIcons name="bar-chart" size={24} color="#006b58" />
            </Text>
            <View style={styles.chipBar} />
          </View>
          <Image
            source={require("../../../asstes/therapist.png")}
            style={styles.avatarSmall}
          />
          <View style={[styles.roleBadge, styles.therapistBadge]}>
            <Text style={[styles.roleText, styles.therapistRoleText]}>Therapist</Text>
          </View>
        </View>

        <View style={styles.footerBgCard}>
          <Image
            source={require("../../../asstes/slide2_bg4.png")}
            style={styles.footerBgImage}
            resizeMode="cover"
          />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Stay Connected</Text>

        <Text style={styles.subtitle}>
          Seamless communication between families and care teams. 
        </Text>
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onDotPress(index)}
            style={[styles.dot, step === index + 1 && styles.activeDot]}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  headerBgCard: {
    position: "absolute",
    left: -70,
    right: 0,
    zIndex: 0,
    top: -60,
  },
  footerBgCard: {
    position: "absolute",
    right: -30,
    bottom: -100,
  },
  bgImage: {
    opacity: 0.8,
  },
  footerBgImage: {
    opacity: 0.6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  imageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  headerBrand: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#0B4A6F",
  },
  skipTextWrapper: {
    height: 25,
  },
  skipText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#334155",
  },
  graphicsCard: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    width: "100%",
  },
  backgroundGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(210, 245, 248, 0.45)",
    zIndex: 0,
  },
  avatarWrapper: {
    alignItems: "center",
    position: "relative",
    marginBottom: 14,
  },
  childAvatarWrapper: {
    marginVertical: 16,
  },
  avatarSmall: {
    width: 88,
    height: 88,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#0F3A4B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarLarge: {
    width: 128,
    height: 128,
    borderRadius: 200,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#0F3A4B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  roleBadge: {
    backgroundColor: "rgba(0, 80, 134, .1)",
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 7,
    zIndex: 2,
  },
  childRoleBadge: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    marginTop: 6,
  },
  therapistBadge: {
    backgroundColor: "rgba(0,107,88,.1)",
  },
  roleText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  childRoleText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  therapistRoleText: {
    color: "#006B58",
  },
  messageChip: {
    position: "absolute",
    top: -35,
    right: -20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: -1,
  },
  analyticsChip: {
    top: -35,
    left: -35,
    width:80
  },

  chartIconBox: {
    backgroundColor: "#0B4A6F",
    borderRadius: 6,
    padding: 4,
    marginRight: 8,
  },
  chatIconText: {
    fontSize: 10,
    color: "#FFF",
  },
  chartIconText: {
    fontSize: 10,
    color: "#FFF",
  },
  chipBar: {
    width: 28,
    height: 6,
    backgroundColor: "#BCE3DC",
    borderRadius: 3,
  },
  content: {
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 14,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#414750",
    fontFamily: fonts.regular,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 3,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
