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

import {
  colors,
  commonStyles,
  fonts,
} from '../../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export default function SlideOne({ onNext, onSkip, step, totalSteps, onDotPress }) {
  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.imageCard}>
        <Image
          source={require("../../../asstes/onboarding.png")}
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      <View style={styles.content}>
        <View style={styles.subTextContainer}>
          <View style={styles.dashLine} />
          <Text style={styles.subText}>GROWTH JOURNEY</Text>
        </View>

        <Text style={styles.title}>
          Helping Every <Text style={styles.titleHighlight}>Child</Text> Grow
        </Text>

        <Text style={styles.subtitle}>
          Empowering children to reach their full potential through personalized therapy tailored to their unique needs
          and strengths.
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
        <Text style={styles.primaryButtonText}>Get Started →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onSkip}>
        <Text style={styles.secondaryButtonText}>Already have an account?</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  imageCard: {
    height: 370,
    borderRadius: 24,
    marginBottom: 20,
    overflow: "hidden",
    width: "100%",
    paddingHorizontal: 20,
  },
  image: {
    width: "100%",
  },
  content: {
    paddingHorizontal: 20,
  },
  subTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dashLine: {
    width: 30,
    height: 2,
    backgroundColor: colors.primary,
    marginRight: 8,
    borderRadius: 1,
  },
  subText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#181C1E",
    marginVertical: 16,
  },
  titleHighlight: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: "#414750",
    fontFamily: fonts.regular,
    lineHeight: 24,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    // marginBottom: 24,
    paddingHorizontal: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
    marginRight: 6,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: colors.primary || colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justify: "center",
    marginHorizontal: "auto",
    marginTop: 24,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: "auto",
    marginTop: 24,
  },
  secondaryButtonText: {
    color: colors.primary || colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
