import React, {
  useCallback,
  useState,
} from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import {
  deletePackage,
  getAllPackages,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const PAGE_LIMIT = 5;

export default function FeeManagementScreen({
  navigation,
}) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPackages = useCallback(async () => {
    try {
      const response = await getAllPackages(
        1,
        PAGE_LIMIT,
      );

      if (response?.success) {
        setPackages(response.data || []);
      }
    } catch (error) {
      console.error(
        "fetchPackages:",
        error?.response?.data || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Failed to load packages.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener(
      "focus",
      fetchPackages,
    );

    return unsubscribe;
  }, [navigation, fetchPackages]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPackages();
  };

  const handleDeletePackage = (
    packageId,
    packageName,
  ) => {
    Alert.alert(
      "Delete Package",
      `Are you sure you want to remove "${packageName}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await deletePackage(
                packageId,
              );

              if (response?.success) {
                setPackages((prev) =>
                  prev.filter(
                    (item) => item._id !== packageId,
                  )
                );

                // Load again so dashboard still
                // contains latest 5 after deletion.
                await fetchPackages();

                Alert.alert(
                  "Success",
                  response.message
                    || "Package deleted successfully.",
                );
              }
            } catch (error) {
              console.error(
                "handleDeletePackage:",
                error?.response?.data
                  || error?.message,
              );

              Alert.alert(
                "Error",
                error?.response?.data?.message
                  || "Failed to delete package.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Back to dashboard"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.pageTitle}>
          Fee Management
        </Text>

        <Text style={styles.pageDescription}>
          Monitor fee structures, track recurring payments, and manage therapist commissions for your healthcare
          facility.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconSquareBlue}>
              <Feather
                name="video"
                size={18}
                color={colors.primary}
              />
            </View>

            <Text style={styles.greenBadgeText}>
              +4% vs last mo
            </Text>
          </View>

          <Text style={styles.cardLabel}>
            Active Plans
          </Text>

          <Text style={styles.cardValueLarge}>
            60 Total
          </Text>

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                42 Monthly
              </Text>
            </View>

            <View style={styles.pill}>
              <Text style={styles.pillText}>
                18 Per-Session
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconSquareGreen}>
              <Feather
                name="trending-up"
                size={18}
                color="#006B58"
              />
            </View>

            <Text style={styles.greenBadgeText}>
              On Track
            </Text>
          </View>

          <Text style={styles.cardLabel}>
            Projected Revenue
          </Text>

          <Text style={styles.cardValueLarge}>
            PKR 1.2M
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: "70%",
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconSquareOrange}>
              <MaterialCommunityIcons
                name="clipboard-text-clock-outline"
                size={18}
                color="#7A3E00"
              />
            </View>

            <Text style={styles.orangeBadgeText}>
              High Priority
            </Text>
          </View>

          <Text style={styles.cardLabel}>
            Pending Clearances
          </Text>

          <Text style={styles.cardValueLarge}>
            PKR 85,500
          </Text>

          <View style={styles.infoRow}>
            <Feather
              name="info"
              size={13}
              color={colors.blackFont}
            />

            <Text style={styles.infoText}>
              12 Invoices awaiting approval
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Fee Structures
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate("AllPackages")}
          >
            <Text style={styles.viewAllText}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.feeListCard}>
          {loading
            ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text style={styles.loadingText}>
                  Loading packages...
                </Text>
              </View>
            )
            : packages.length === 0
            ? (
              <View style={styles.emptyContainer}>
                <Feather
                  name="package"
                  size={28}
                  color="#9CA3AF"
                />

                <Text style={styles.emptyTitle}>
                  No packages yet
                </Text>

                <Text style={styles.emptyText}>
                  Create your first fee package to get started.
                </Text>
              </View>
            )
            : (
              packages.map((item, index) => (
                <View
                  key={item._id}
                  style={[
                    styles.feeItem,
                    index < packages.length - 1
                    && styles.feeItemBorder,
                  ]}
                >
                  <View style={styles.feeItemContent}>
                    <Text style={styles.feeName}>
                      {item.name}
                    </Text>

                    <Text style={styles.feePrice}>
                      PKR {Number(item.price || 0).toLocaleString()}
                      {" • "}
                      {item.type
                        ?.replace(/-/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </Text>

                  
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() =>
                        navigation.navigate(
                          "AddNewPackage",
                          {
                            packageId: item._id,
                            mode: "edit",
                          },
                        )}
                    >
                      <Feather
                        name="edit-2"
                        size={16}
                        color="#7A8494"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() =>
                        handleDeletePackage(
                          item._id,
                          item.name,
                        )}
                    >
                      <Feather
                        name="trash-2"
                        size={16}
                        color="#BA1A1A"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

          <TouchableOpacity
            style={styles.addPackageBtn}
            onPress={() => navigation.navigate("AddNewPackage")}
          >
            <Text style={styles.addPackageText}>
              Add New Package
            </Text>
          </TouchableOpacity>
        </View>

        <ImageBackground
          source={require("../../asstes/fee_bg.png")}
          style={styles.bannerImage}
          imageStyle={styles.bannerImageStyle}
        >
          <LinearGradient
            colors={[
              "rgba(0, 80, 134, 0.8)",
              "rgba(0, 80, 134, 0)",
            ]}
            start={{
              x: 0.5,
              y: 1,
            }}
            end={{
              x: 0.5,
              y: 0,
            }}
            style={styles.bannerOverlay}
          >
            <Text style={styles.bannerTitle}>
              Financial Analysis
            </Text>

            <Text style={styles.bannerSubtitle}>
              Download Q3 revenue report and commission breakdown.
            </Text>
          </LinearGradient>
        </ImageBackground>
      </ScrollView>

      <BottomBar activeTab="" />
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

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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

  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  editBtn: {
    padding: 6,
  },

  deleteBtn: {
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

  loadingContainer: {
    paddingVertical: 35,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  emptyContainer: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  emptyText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.blackFont,
    fontFamily: fonts.regular,
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
    color: "rgba(255,255,255,.8)",
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
});
