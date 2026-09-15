import React from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function FeeManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const feeStructures = [
    { id: "1", name: "Behavioral Therapy", price: "PKR 3,500/session" },
    { id: "2", name: "Speech Therapy", price: "PKR 3,000/session" },
    { id: "3", name: "Occupational Therapy", price: "PKR 4,200/session" },
  ];

  return (
    <SafeAreaView style={[styles.container, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        headerTitle={"Back to dashboard"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Fee Management</Text>
        <Text style={styles.pageDescription}>
          Monitor fee structures, track recurring payments, and manage therapist commissions for your healthcare
          facility.
        </Text>

        <TouchableOpacity style={styles.configureBtn} 
        onPress={()=>navigation.navigate('AddNewPackage')}>
          <Feather name="plus-circle" size={18} color="#FFFFFF" style={styles.configureBtnIcon} />
          <Text style={styles.configureBtnText}>Configure Fees</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconSquareBlue}>
              <Feather name="video" size={18} color={colors.primary} />
            </View>
            <Text style={styles.greenBadgeText}>+4% vs last mo</Text>
          </View>
          <Text style={styles.cardLabel}>Active Plans</Text>
          <Text style={styles.cardValueLarge}>60 Total</Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>42 Monthly</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>18 Per-Session</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconSquareGreen}>
              <Feather name="trending-up" size={18} color="#006B58" />
            </View>
            <Text style={styles.greenBadgeText}>On Track</Text>
          </View>
          <Text style={styles.cardLabel}>Projected Revenue</Text>
          <Text style={styles.cardValueLarge}>PKR 1.2M</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: "70%" }]} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconSquareOrange}>
              <MaterialCommunityIcons name="clipboard-text-clock-outline" size={18} color="#7A3E00" />
            </View>
            <Text style={styles.orangeBadgeText}>High Priority</Text>
          </View>
          <Text style={styles.cardLabel}>Pending Clearances</Text>
          <Text style={styles.cardValueLarge}>PKR 85,500</Text>
          <View style={styles.infoRow}>
            <Feather name="info" size={13} color={colors.blackFont} />
            <Text style={styles.infoText}>12 Invoices awaiting approval</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fee Structures</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.feeListCard}>
          {feeStructures.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.feeItem,
                index < feeStructures.length - 1 && styles.feeItemBorder,
              ]}
            >
              <View style={styles.feeItemContent}>
                <Text style={styles.feeName}>{item.name}</Text>
                <Text style={styles.feePrice}>{item.price}</Text>
              </View>
              <TouchableOpacity style={styles.editBtn}>
                <Feather name="edit-2" size={16} color="#C1C7D2" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addPackageBtn}>
            <Text style={styles.addPackageText}>Add New Package</Text>
          </TouchableOpacity>
        </View>

        <ImageBackground
          source={require("../../asstes/fee_bg.png")}
          style={styles.bannerImage}
          imageStyle={styles.bannerImageStyle}
        >
          <LinearGradient
            colors={["rgba(0, 80, 134, 0.8)", "rgba(0, 80, 134, 0)"]}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.bannerOverlay}
          >
            <Text style={styles.bannerTitle}>Financial Analysis</Text>
            <Text style={styles.bannerSubtitle}>
              Download Q3 revenue report and commission breakdown.
            </Text>
          </LinearGradient>
        </ImageBackground>
      </ScrollView>

      <BottomBar
        activeTab={""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  pageTitle: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    lineHeight: 32,
    color: "#181C1E",
    marginTop: 12,
    marginBottom: 5,
  },
  pageDescription: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 22,
    color: colors.blackFont,
    marginBottom: 16,
  },

  configureBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  configureBtnIcon: {
    marginRight: 8,
  },
  configureBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconSquareBlue: {
    width: 44,
    padding: 12,
    paddingBottom: 18,
    borderRadius: 8,
    backgroundColor: "rgba(0,80,134,.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconSquareGreen: {
    width: 44,
    padding: 12,
    paddingBottom: 18,
    borderRadius: 8,
    backgroundColor: "rgba(139,246,217,.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconSquareOrange: {
    width: 44,
    padding: 12,
    paddingBottom: 18,
    borderRadius: 8,
    backgroundColor: "rgba(157,82,0,.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  greenBadgeText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#006B58",
  },
  orangeBadgeText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#BA1A1A",
  },
  cardLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    marginBottom: 4,
    color: colors.blackFont,
  },
  cardValueLarge: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    marginBottom: 12,
    lineHeight: 32,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    backgroundColor: "#F1F4F7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 16,
  },

  progressTrack: {
    height: 8,
    backgroundColor: "#F1F4F7",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#006B58",
    borderRadius: 4,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    color: "#181C1E",
    fontFamily: fonts.semiBold,
    lineHeight: 32,
  },
  viewAllText: {
    fontSize: 16,
    color: colors.primary,
    fontFamily: fonts.regular,
    lineHeight: 25,
  },
  feeListCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 5,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  feeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  feeItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  feeItemContent: {
    flex: 1,
  },
  feeName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: "#181C1E",
  },
  feePrice: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
    color: colors.blackFont,
  },
  editBtn: {
    padding: 6,
  },
  addPackageBtn: {
    backgroundColor: "#F1F4F7",
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  addPackageText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 24,
    color: colors.primary,
  },

  bannerImage: {
    height: 190,
    borderRadius: 16,
    overflow: "hidden",
  },
  bannerImageStyle: {
    borderRadius: 16,
  },
  bannerOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: "rgba(256,256,256,.8)",
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
});
