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

import {
  commonStyles,
  fonts,
} from '../../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SlideTwo({ onNext, onSkip, step, totalSteps, onDotPress }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={commonStyles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBgCard}>
        <Image
          source={require("../../../asstes/slide2_bg.png")}
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
        <Image
          source={require("../../../asstes/slide2.png")}
          style={styles.graphicImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.content}>
        <View style={styles.badgeTag}>
          <Text style={styles.badgeText}>Real-time Analytics</Text>
        </View>

        <Text style={styles.title}>
          Track Every <Text style={styles.titleHighlight}>Therapy Journey</Text>
        </Text>

        <Text style={styles.subtitle}>
          Stay informed with real-time progress reports and session highlights. Watch growth happen with detailed data
          visualizations tailored for you.
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
      <View style={styles.footerBgCard}>
        <Image
          source={require("../../../asstes/slide2_bg2.png")}
          style={styles.bgImage}
          resizeMode="cover"
        />
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: "#35A391" }]}
        onPress={onNext}
      >
        <Text style={styles.primaryButtonText}>Continue Journey →</Text>
      </TouchableOpacity>

  
      <Text style={styles.stepsText}>{`Step ${step} of ${totalSteps}`}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
 
  headerBgCard: {
    position: "absolute",
    left: 30,
    right: 0,
    zIndex: 0,
  },
  footerBgCard: {
    position: "absolute",
    left: 30,
    bottom: 0,
  },

  scrollContent: {
    flexGrow: 1,
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
  skipTextWrapper:{
    height:25,
  },
  skipText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#334155",
  },
  graphicsCard: {
    height: 330,
    justifyContent: "center",
    alignItems: "center",
  },
  graphicImage: {
    width: "100%",
  },
  content: {
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
  badgeTag: {
    backgroundColor: "#8BF6D9",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  badgeText: {
    color: "#0B4A6F",
    fontWeight: "600",
    fontSize: 13,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#181C1E",
    marginVertical: 16,
    textAlign: "center",
  },
  titleHighlight: {
    color: "#4CB99F",
  },
  subtitle: {
    fontSize: 16,
    color: "#414750",
    fontFamily: fonts.regular,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
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
    backgroundColor: "#4CB99F",
  },
  primaryButton: {
    width: SCREEN_WIDTH - 40,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: "auto",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  stepsText: {
    marginTop: 30,
    textAlign: "center",
    fontSize: 14,
    color: "#94A3B8",
    fontFamily: fonts.semiBold,
    backgroundColor:'#f7fafd',
    paddingVertical:24,
  },
});
