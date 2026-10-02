import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";

import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";

import { colors, commonStyles, fonts } from "../../styles/theme";
import { getAllPackages,deletePackage,createPackage,updatePackagegetPackageById } from "../../api/admin/api";


export default function AllPackagesScreen({ navigation }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPackages = useCallback(async () => {
    try {
      const response = await getAllPackages();

      if (response.data?.success) {
        setPackages(response.data.data || []);
      }
    } catch (error) {
      console.error("fetchPackages:", error);

      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to load packages."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("focus", fetchPackages);

    return unsubscribe;
  }, [navigation, fetchPackages]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPackages();
  };

  const handleDeletePackage = (packageId, packageName) => {
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
              const response = await deletePackage(packageId)

              if (response.data?.success) {
                setPackages((prev) =>
                  prev.filter((item) => item._id !== packageId)
                );

                Alert.alert(
                  "Success",
                  "Package deleted successfully."
                );
              }
            } catch (error) {
              console.error("deletePackage:", error);

              Alert.alert(
                "Error",
                error.response?.data?.message ||
                  "Failed to delete package."
              );
            }
          },
        },
      ]
    );
  };

  const formatPrice = (price) => {
    return `PKR ${Number(price || 0).toLocaleString()}`;
  };

  const getPackageType = (type) => {
    if (type === "per-session") {
      return "Per Session";
    }

    if (type === "batch") {
      return "Batch";
    }

    return type;
  };

  return (
    <SafeAreaView
      style={[styles.container, commonStyles.container]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Back to Fee Management"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>
              All Packages
            </Text>

            <Text style={styles.pageDescription}>
              View and manage all fee packages.
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {packages.length}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            navigation.navigate("AddNewPackage")
          }
        >
          <Feather
            name="plus-circle"
            size={18}
            color="#FFFFFF"
          />

          <Text style={styles.addButtonText}>
            Add New Package
          </Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text style={styles.loadingText}>
              Loading packages...
            </Text>
          </View>
        ) : packages.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather
                name="package"
                size={30}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No Packages Found
            </Text>

            <Text style={styles.emptyDescription}>
              You haven't created any fee packages yet.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() =>
                navigation.navigate("AddNewPackage")
              }
            >
              <Text style={styles.emptyButtonText}>
                Create Package
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.packageList}>
            {packages.map((item) => (
              <View
                key={item._id}
                style={styles.packageCard}
              >
                <View style={styles.packageTopRow}>
                  <View style={styles.packageIcon}>
                    <Feather
                      name={
                        item.type === "batch"
                          ? "users"
                          : "user"
                      }
                      size={19}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.packageMain}>
                    <Text
                      style={styles.packageName}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>

                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {getPackageType(item.type)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.packagePrice}>
                    {formatPrice(item.price)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoSection}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      Speciality
                    </Text>

                    <Text
                      style={styles.infoValue}
                      numberOfLines={2}
                    >
                      {item.specialities?.join(", ") || "-"}
                    </Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      Duration
                    </Text>

                    <Text style={styles.infoValue}>
                      {item.sessionMinutes || 60} min
                    </Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>
                      Sessions
                    </Text>

                    <Text style={styles.infoValue}>
                      {item.sessions || 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() =>
                      navigation.navigate(
                        "AddNewPackage",
                        {
                          packageId: item._id,
                          mode: "edit",
                        }
                      )
                    }
                  >
                    <Feather
                      name="edit-2"
                      size={16}
                      color={colors.primary}
                    />

                    <Text style={styles.editButtonText}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() =>
                      handleDeletePackage(
                        item._id,
                        item.name
                      )
                    }
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color="#BA1A1A"
                    />

                    <Text style={styles.deleteButtonText}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
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
    paddingBottom: 30,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 16,
  },

  headerContent: {
    flex: 1,
  },

  pageTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  pageDescription: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  countBadge: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,80,134,0.10)",
  },

  countText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: colors.primary,
    marginBottom: 18,
  },

  addButtonText: {
    marginLeft: 8,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  loadingContainer: {
    paddingVertical: 70,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 25,
    paddingVertical: 45,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,80,134,0.08)",
  },

  emptyTitle: {
    marginTop: 15,
    fontSize: 19,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  emptyDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  emptyButtonText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  packageList: {
    gap: 12,
  },

  packageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 1,
  },

  packageTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  packageIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,80,134,0.08)",
  },

  packageMain: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  packageName: {
    fontSize: 17,
    lineHeight: 23,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  typeBadge: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F1F4F7",
  },

  typeBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  packagePrice: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 15,
  },

  infoSection: {
    flexDirection: "row",
    gap: 12,
  },

  infoItem: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: "#8A94A3",
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  actions: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },

  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#D8E4ED",
  },

  editButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#FFF3F3",
  },

  deleteButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#BA1A1A",
  },
});