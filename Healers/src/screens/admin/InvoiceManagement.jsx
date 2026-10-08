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
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import { getInvoicesApi } from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const STATUS_OPTIONS = [
  "All Statuses",
  "Paid",
  "Pending",
  "Partially Paid",
  "Overdue",
  "Cancelled",
  "Draft",
];

const PAGE_LIMIT = 5;

const formatCurrency = (value) => {
  return `PKR ${
    Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }`;
};

const getStatusTheme = (status) => {
  switch (status) {
    case "Paid":
      return {
        backgroundColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        color: "#047857",
        icon: "check-circle",
        iconBg: "#ECFDF5",
        iconColor: "#047857",
      };

    case "Overdue":
      return {
        backgroundColor: "#FEF2F2",
        borderColor: "#FCA5A5",
        color: "#B91C1C",
        icon: "alert-triangle",
        iconBg: "#FEF2F2",
        iconColor: "#C53030",
      };

    case "Partially Paid":
      return {
        backgroundColor: "#FFF7ED",
        borderColor: "#FED7AA",
        color: "#C2410C",
        icon: "clock",
        iconBg: "#FFF7ED",
        iconColor: "#C2410C",
      };

    case "Pending":
      return {
        backgroundColor: "#FFFBEB",
        borderColor: "#FDE68A",
        color: "#B45309",
        icon: "clock",
        iconBg: "#FFFBEB",
        iconColor: "#B45309",
      };

    case "Cancelled":
      return {
        backgroundColor: "#F8FAFC",
        borderColor: "#CBD5E1",
        color: "#64748B",
        icon: "x-circle",
        iconBg: "#F1F5F9",
        iconColor: "#64748B",
      };

    case "Draft":
      return {
        backgroundColor: "#F8FAFC",
        borderColor: "#CBD5E1",
        color: "#475569",
        icon: "file",
        iconBg: "#F1F5F9",
        iconColor: "#475569",
      };

    default:
      return {
        backgroundColor: "#F8FAFC",
        borderColor: "#E2E8F0",
        color: "#475569",
        icon: "file-text",
        iconBg: "#EBF3F9",
        iconColor: "#0B4A6F",
      };
  }
};

export default function InvoiceManagementScreen({
  navigation,
}) {
  const [invoices, setInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    outstanding: 0,
    collected: 0,
    outstandingCount: 0,
  });

  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadInvoices = useCallback(
    async ({
      pageNumber = 1,
      append = false,
      refresh = false,
    } = {}) => {
      if (append) {
        if (
          loadingMoreRef.current
          || !hasMore
        ) {
          return;
        }

        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = {
          page: pageNumber,
          limit: PAGE_LIMIT,
        };

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        if (
          selectedStatus !== "All Statuses"
        ) {
          params.status = selectedStatus;
        }

        const response = await getInvoicesApi(params);

        const result = response || response;

        if (!result?.success) {
          throw new Error(
            result?.message
              || "Unable to load invoices",
          );
        }

        const newInvoices = result?.data || [];

        const pagination = result?.pagination || {};

        if (append) {
          setInvoices((previous) => {
            const existingIds = new Set(
              previous.map((item) => String(item._id)),
            );

            const uniqueNewInvoices = newInvoices.filter(
              (item) =>
                !existingIds.has(
                  String(item._id),
                ),
            );

            return [
              ...previous,
              ...uniqueNewInvoices,
            ];
          });
        } else {
          setInvoices(newInvoices);
        }

        setPage(
          pagination.page
            || pageNumber,
        );

        setHasMore(
          Boolean(pagination.hasMore),
        );

        if (result?.stats) {
          setStats({
            totalRevenue: result.stats.totalRevenue || 0,

            outstanding: result.stats.outstanding || 0,

            collected: result.stats.collected || 0,

            outstandingCount: result.stats
              .outstandingCount || 0,
          });
        }
      } catch (error) {
        console.log(
          "loadInvoices error:",
          error?.response?.data
            || error?.message
            || error,
        );

        if (!append) {
          setInvoices([]);
        }

        Alert.alert(
          "Error",
          error?.response?.data?.message
            || error?.message
            || "Unable to load invoices.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [
      debouncedSearch,
      selectedStatus,
      hasMore,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      loadInvoices({
        pageNumber: 1,
      });
    }, [
      debouncedSearch,
      selectedStatus,
    ]),
  );

  const handleRefresh = useCallback(() => {
    setPage(1);

    loadInvoices({
      pageNumber: 1,
      refresh: true,
    });
  }, [loadInvoices]);

  const handleLoadMore = useCallback(() => {
    if (
      loading
      || refreshing
      || loadingMore
      || !hasMore
    ) {
      return;
    }

    loadInvoices({
      pageNumber: page + 1,
      append: true,
    });
  }, [
    loading,
    refreshing,
    loadingMore,
    hasMore,
    page,
    loadInvoices,
  ]);

  const handleSelectStatus = (status) => {
    setIsStatusModalVisible(false);

    if (status === selectedStatus) {
      return;
    }

    setInvoices([]);
    setPage(1);
    setHasMore(false);
    setSelectedStatus(status);
  };

  const handleViewInvoice = (item) => {
    navigation.navigate("InvoiceView", {
      invoiceId: item._id,
    });
  };

  const handleCreateInvoice = () => {
    navigation.navigate(
      "CreateNewInvoice",
    );
  };

  const handleRemind = (item) => {
    Alert.alert(
      "Send Reminder",
      `Send payment reminder for ${item.invoiceNumber}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send",
          onPress: () => {
            console.log(
              "Reminder invoice:",
              item._id,
            );
          },
        },
      ],
    );
  };

  const renderHeader = () => (
    <View>
      <Text style={styles.screenTitle}>
        Invoice Management
      </Text>

      <Text style={styles.introDescription}>
        Oversee billing, track collections, and manage child session payments.
      </Text>

      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.8}
        onPress={handleCreateInvoice}
      >
        <Feather
          name="plus"
          size={18}
          color="#FFFFFF"
        />

        <Text style={styles.createBtnText}>
          Create New Invoice
        </Text>
      </TouchableOpacity>

      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>
          TOTAL REVENUE
        </Text>

        <View style={styles.metricRow}>
          <Text
            style={styles.metricValuePrimary}
          >
            {formatCurrency(
              stats.totalRevenue,
            )}
          </Text>
        </View>
      </View>

      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>
          OUTSTANDING
        </Text>

        <View style={styles.metricRow}>
          <Text
            style={styles.metricValueDanger}
          >
            {formatCurrency(
              stats.outstanding,
            )}
          </Text>

          <Text style={styles.metricSubtext}>
            {stats.outstandingCount} {stats.outstandingCount === 1
              ? "Invoice"
              : "Invoices"}
          </Text>
        </View>
      </View>

      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>
          COLLECTED
        </Text>

        <View style={styles.metricRow}>
          <Text
            style={styles.metricValueSuccess}
          >
            {formatCurrency(
              stats.collected,
            )}
          </Text>

          {stats.totalRevenue > 0 && (
            <View
              style={styles.badgeSuccessLight}
            >
              <Text
                style={styles.badgeSuccessText}
              >
                {Math.round(
                  (stats.collected
                    / stats.totalRevenue)
                    * 100,
                )}
                %
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        <View
          style={styles.searchBarContainer}
        >
          <Feather
            name="search"
            size={18}
            color="#94A3B8"
            style={styles.searchIcon}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search invoice ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {!!searchQuery && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={10}
            >
              <Feather
                name="x"
                size={18}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.dropdownFilter}
            onPress={() =>
              setIsStatusModalVisible(
                true,
              )}
            activeOpacity={0.7}
          >
            <Text
              style={styles.dropdownFilterText}
              numberOfLines={1}
            >
              {selectedStatus}
            </Text>

            <Feather
              name="chevron-down"
              size={18}
              color="#64748B"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tuneButton}
            activeOpacity={0.7}
            onPress={() =>
              setIsStatusModalVisible(
                true,
              )}
          >
            <Feather
              name="sliders"
              size={18}
              color="#475569"
            />
          </TouchableOpacity>
        </View>
      </View>

      {!loading
        && invoices.length > 0 && (
        <View
          style={styles.resultHeader}
        >
          <Text
            style={styles.resultTitle}
          >
            Invoices
          </Text>

          <Text
            style={styles.resultCount}
          >
            {invoices.length} loaded
          </Text>
        </View>
      )}
    </View>
  );

  const renderInvoice = ({
    item,
  }) => {
    const statusTheme = getStatusTheme(item.status);

    const child = item.childId || {};

    const parent = item.parentId || {};

    const parentName = parent.fullName
      || item.parentName
      || "Parent/Guardian";

    const childName = child.fullName
      || item.childName
      || "Unknown Child";

    return (
      <View style={styles.invoiceCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleViewInvoice(item)}
        >
          <View
            style={styles.invoiceHeaderRow}
          >
            <View
              style={[
                styles.invoiceIconContainer,
                {
                  backgroundColor: statusTheme.iconBg,
                },
              ]}
            >
              <Feather
                name={statusTheme.icon}
                size={18}
                color={statusTheme.iconColor}
              />
            </View>

            <View
              style={styles.invoiceTextContainer}
            >
              <Text
                style={styles.parentName}
                numberOfLines={1}
              >
                {parentName}
              </Text>

              <Text
                style={styles.childSubtitle}
                numberOfLines={2}
              >
                Child: {childName} • {item.invoiceNumber}
              </Text>
            </View>

            <Feather
              name="chevron-right"
              size={20}
              color="#94A3B8"
            />
          </View>

          <View
            style={styles.amountStatusRow}
          >
            <View>
              <Text
                style={styles.amountLabel}
              >
                AMOUNT
              </Text>

              <Text
                style={styles.amountValue}
              >
                {formatCurrency(
                  item.totalAmount,
                )}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusTheme.backgroundColor,
                  borderColor: statusTheme.borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: statusTheme.color,
                  },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          {item.balanceDue > 0 && (
            <View
              style={styles.balanceInfoRow}
            >
              <Text
                style={styles.balanceInfoLabel}
              >
                Balance Due
              </Text>

              <Text
                style={styles.balanceInfoValue}
              >
                {formatCurrency(
                  item.balanceDue,
                )}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            activeOpacity={0.7}
            onPress={() => handleViewInvoice(item)}
          >
            <Feather
              name="eye"
              size={16}
              color="#475569"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconCircleBtn}
            activeOpacity={0.7}
            onPress={() => {
              console.log(
                "Download invoice:",
                item._id,
              );
            }}
          >
            <Feather
              name="download"
              size={16}
              color="#475569"
            />
          </TouchableOpacity>

          {[
            "Pending",
            "Partially Paid",
            "Overdue",
          ].includes(item.status) && (
            <TouchableOpacity
              style={styles.remindBtn}
              activeOpacity={0.8}
              onPress={() => handleRemind(item)}
            >
              <Feather
                name="mail"
                size={14}
                color="#FFFFFF"
              />

              <Text
                style={styles.remindBtnText}
              >
                Remind
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text
            style={styles.loadingText}
          >
            Loading invoices...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Feather
            name="file-text"
            size={32}
            color="#94A3B8"
          />
        </View>

        <Text style={styles.emptyTitle}>
          No invoices found
        </Text>

        <Text
          style={styles.emptyDescription}
        >
          {debouncedSearch
              || selectedStatus
                !== "All Statuses"
            ? "Try changing your search or filter."
            : "Create your first invoice to get started."}
        </Text>

        {!debouncedSearch
          && selectedStatus
            === "All Statuses"
          && (
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={handleCreateInvoice}
            >
              <Feather
                name="plus"
                size={16}
                color="#FFFFFF"
              />

              <Text
                style={styles.emptyCreateText}
              >
                Create Invoice
              </Text>
            </TouchableOpacity>
          )}
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) {
      return hasMore
        ? (
          <View
            style={styles.footerSpacing}
          />
        )
        : invoices.length > 0
        ? (
          <Text style={styles.endText}>
            No more invoices
          </Text>
        )
        : null;
    }

    return (
      <View
        style={styles.footerLoader}
      >
        <ActivityIndicator
          size="small"
          color={colors.primary}
        />

        <Text
          style={styles.footerLoaderText}
        >
          Loading more...
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
        headerTitle="Back to dashboard"
      />

      <FlatList
        data={invoices}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderInvoice}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />

      <Modal
        visible={isStatusModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsStatusModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setIsStatusModalVisible(
              false,
            )}
        >
          <View
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback>
              <View
                style={styles.modalContent}
              >
                <View
                  style={styles.modalHeader}
                >
                  <Text
                    style={styles.modalTitle}
                  >
                    Filter by Status
                  </Text>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() =>
                      setIsStatusModalVisible(
                        false,
                      )}
                  >
                    <Feather
                      name="x"
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {STATUS_OPTIONS.map(
                  (status) => {
                    const selected = selectedStatus
                      === status;

                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.modalOption,
                          selected
                          && styles.modalOptionSelected,
                        ]}
                        activeOpacity={0.7}
                        onPress={() =>
                          handleSelectStatus(
                            status,
                          )}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            selected
                            && styles.modalOptionTextSelected,
                          ]}
                        >
                          {status}
                        </Text>

                        {selected && (
                          <View
                            style={styles.checkCircle}
                          >
                            <Feather
                              name="check"
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BottomBar activeTab="Home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
    flexGrow: 1,
  },

  screenTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 36,
    marginBottom: 5,
  },

  introDescription: {
    fontSize: 16,
    color: colors.blackFont,
    lineHeight: 22,
    fontFamily: fonts.regular,
    marginBottom: 20,
  },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 20,
    gap: 8,
    alignSelf: "flex-start",
  },

  createBtnText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    lineHeight: 20,
  },

  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  metricLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    letterSpacing: 0.5,
    marginBottom: 8,
    lineHeight: 18,
  },

  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },

  metricValuePrimary: {
    fontSize: 30,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 40,
  },

  metricValueDanger: {
    fontSize: 30,
    fontFamily: fonts.bold,
    color: "#BA1A1A",
    lineHeight: 40,
  },

  metricValueSuccess: {
    fontSize: 30,
    fontFamily: fonts.bold,
    color: "#006B58",
    lineHeight: 40,
  },

  metricSubtext: {
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },

  badgeSuccessLight: {
    backgroundColor: "rgba(139,246,217,.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  badgeSuccessText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#00725E",
  },

  filterSection: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 10,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },

  filterRow: {
    flexDirection: "row",
    gap: 10,
  },

  dropdownFilter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },

  dropdownFilterText: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  tuneButton: {
    width: 46,
    height: 46,
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  resultTitle: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  resultCount: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  invoiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  invoiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  invoiceIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  invoiceTextContainer: {
    flex: 1,
    marginRight: 8,
  },

  parentName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
    color: "#181C1E",
  },

  childSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 17,
  },

  amountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  amountLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  amountValue: {
    marginTop: 2,
    fontSize: 17,
    fontFamily: fonts.semiBold,
    lineHeight: 22,
    color: "#00497B",
  },

  statusBadge: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  statusBadgeText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    lineHeight: 16,
  },

  balanceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },

  balanceInfoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  balanceInfoValue: {
    fontSize: 12,
    color: "#BA1A1A",
    fontFamily: fonts.semiBold,
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  remindBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BA1A1A",
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 38,
    gap: 6,
  },

  remindBtnText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#FFFFFF",
  },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 18,
    color: "#0F172A",
    fontFamily: fonts.semiBold,
    marginBottom: 6,
  },

  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    fontFamily: fonts.regular,
    textAlign: "center",
  },

  emptyCreateBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 7,
  },

  emptyCreateText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },

  footerLoader: {
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  footerLoaderText: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  footerSpacing: {
    height: 15,
  },

  endText: {
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  modalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 3,
  },

  modalOptionSelected: {
    backgroundColor: "#F0F7FB",
  },

  modalOptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#334155",
  },

  modalOptionTextSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
