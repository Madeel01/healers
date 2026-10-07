import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

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

export default function AllPackagesScreen({ navigation }) {
  const { height } = useWindowDimensions();

  const PAGE_LIMIT = height < 800 ? 3 : 5;
  const [packages, setPackages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMoreRef = useRef(false);

  const fetchPackages = useCallback(
    async (
      pageNumber = 1,
      loadMore = false,
      showInitialLoader = true,
    ) => {
      try {
        if (loadMore) {
          if (loadingMoreRef.current) {
            return;
          }

          loadingMoreRef.current = true;
          setLoadingMore(true);
        } else if (showInitialLoader) {
          setLoading(true);
        }

        const response = await getAllPackages(
          pageNumber,
          PAGE_LIMIT,
        );

        if (response?.success) {
          const newPackages = response.data || [];
          setTotal(response.total);
          if (pageNumber === 1) {
            setPackages(newPackages);
          } else {
            setPackages((prev) => {
              const existingIds = new Set(
                prev.map((item) => String(item._id)),
              );

              const uniquePackages = newPackages.filter(
                (item) => !existingIds.has(String(item._id)),
              );

              return [
                ...prev,
                ...uniquePackages,
              ];
            });
          }

          setPage(pageNumber);
          setHasMore(Boolean(response.hasMore));
        }
      } catch (error) {
        console.error(
          "fetchPackages:",
          error,
        );

        Alert.alert(
          "Error",
          error.response?.data?.message
            || "Failed to load packages.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [PAGE_LIMIT],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener(
      "focus",
      () => {
        setPage(1);
        setHasMore(true);

        fetchPackages(
          1,
          false,
          true,
        );
      },
    );

    return unsubscribe;
  }, [
    navigation,
    fetchPackages,
  ]);

  const handleRefresh = useCallback(() => {
    if (refreshing || loadingMoreRef.current) {
      return;
    }

    setRefreshing(true);
    setPage(1);
    setHasMore(true);

    fetchPackages(
      1,
      false,
      false,
    );
  }, [
    refreshing,
    fetchPackages,
  ]);

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMoreRef.current || !hasMore) {
      return;
    }

    fetchPackages(page + 1, true, false);
  }, [loading, refreshing, hasMore, page, fetchPackages]);

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
              const response = await deletePackage(
                packageId,
              );
              if (response?.success) {
                setPackages((prev) =>
                  prev.filter(
                    (item) => item._id !== packageId,
                  )
                );

                Alert.alert(
                  "Success",
                  "Package deleted successfully.",
                );
              }
            } catch (error) {
              console.error(
                "deletePackage:",
                error,
              );

              Alert.alert(
                "Error",
                error.response?.data?.message
                  || "Failed to delete package.",
              );
            }
          },
        },
      ],
    );
  };

  const formatPrice = (price) => {
    return `PKR ${
      Number(
        price || 0,
      ).toLocaleString()
    }`;
  };

  const getPackageType = (type) => {
    if (type === "per-month") {
      return "Monthly";
    }

    if (type === "batch") {
      return "Batch";
    }

    if (!type) {
      return "-";
    }

    return type
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const renderPackage = ({ item }) => {
    return (
      <View style={styles.packageCard}>
        <View style={styles.packageTopRow}>
          <View style={styles.packageIcon}>
            <Feather
              name={item.type === "batch"
                ? "users"
                : "user"}
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

        {item.description
          ? (
            <>
              <View style={styles.divider} />

              <View style={styles.descriptionSection}>
                <Text style={styles.infoLabel}>
                  Description
                </Text>

                <Text
                  style={styles.descriptionText}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
              </View>
            </>
          )
          : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.8}
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
              color={colors.primary}
            />

            <Text style={styles.editButtonText}>
              Edit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            activeOpacity={0.8}
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

            <Text style={styles.deleteButtonText}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    return (
      <>
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
              {total}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate(
              "AddNewPackage",
            )}
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
      </>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return null;
    }

    return (
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
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate(
              "AddNewPackage",
            )}
        >
          <Text style={styles.emptyButtonText}>
            Create Package
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) {
      return <View style={styles.footerSpace} />;
    }

    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator
          size="small"
          color={colors.primary}
        />

        <Text style={styles.loadMoreText}>
          Loading more packages...
        </Text>
      </View>
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
        headerTitle="Back to Fee Management"
      />

      {loading && packages.length === 0
        ? (
          <View style={styles.initialLoadingWrapper}>
            {renderHeader()}

            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />

              <Text style={styles.loadingText}>
                Loading packages...
              </Text>
            </View>
          </View>
        )
        : (
          <FlatList
            data={packages}
            keyExtractor={(item) => String(item._id)}
            renderItem={renderPackage}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.25}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          />
        )}

      <BottomBar activeTab="" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  initialLoadingWrapper: {
    flex: 1,
    paddingHorizontal: 16,
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
    flex: 1,
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
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

  separator: {
    height: 12,
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

  descriptionSection: {
    width: "100%",
  },

  descriptionText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.blackFont,
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

  loadMoreContainer: {
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  loadMoreText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.blackFont,
  },

  footerSpace: {
    height: 15,
  },
});
