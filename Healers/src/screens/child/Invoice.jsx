import React, {
  useCallback,
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import { getMyInvoicesApi } from '../../api/child/api';
import ChildBottomBar from '../../components/ChildBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';

const PAGE_LIMIT = 5;

const STATUSES = [
  "All Statuses",
  "Pending",
  "Partially Paid",
  "Paid",
  "Overdue",
];

const money = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

const formatDate = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const statusColor = (status) => {
  switch (status) {
    case "Paid":
      return "#059669";
    case "Overdue":
      return "#DC2626";
    case "Pending":
      return "#D97706";
    case "Partially Paid":
      return "#EA580C";
    default:
      return "#64748B";
  }
};

export default function ChildInvoicesScreen({ navigation }) {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({
    totalBilled: 0,
    totalPaid: 0,
    totalDue: 0,
  });

  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const paginationRef = useRef({
    page: 1,
    hasMore: false,
  });

  const busyRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadInvoices = useCallback(
    async (pageNumber = 1, append = false, refresh = false) => {
      if (busyRef.current) return;

      if (append && !paginationRef.current.hasMore) return;

      busyRef.current = true;

      if (append) {
        setLoadingMore(true);
      } else if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const requestId = ++requestIdRef.current;

      try {
        const result = await getMyInvoicesApi({
          page: pageNumber,
          limit: PAGE_LIMIT,
          status: selectedStatus,
        });

        if (requestId !== requestIdRef.current) return;

        if (!result?.success) {
          throw new Error(result?.message || "Unable to load invoices");
        }

        const items = result.data || [];

        setInvoices((previous) => {
          if (!append) return items;

          const ids = new Set(
            previous.map((item) => String(item._id)),
          );

          return [
            ...previous,
            ...items.filter(
              (item) => !ids.has(String(item._id)),
            ),
          ];
        });

        paginationRef.current = {
          page: result.pagination?.page || pageNumber,
          hasMore: Boolean(result.pagination?.hasMore),
        };

        if (result.stats) {
          setStats(result.stats);
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;

        Alert.alert(
          "Error",
          error?.response?.data?.message
            || error.message
            || "Failed to load invoices",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          busyRef.current = false;
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [selectedStatus],
  );

  useFocusEffect(
    useCallback(() => {
      paginationRef.current = {
        page: 1,
        hasMore: false,
      };

      busyRef.current = false;
      loadInvoices(1);

      return () => {
        requestIdRef.current += 1;
        busyRef.current = false;
      };
    }, [loadInvoices]),
  );

  const handleLoadMore = () => {
    if (
      loading
      || refreshing
      || loadingMore
      || busyRef.current
      || !paginationRef.current.hasMore
    ) {
      return;
    }

    loadInvoices(paginationRef.current.page + 1, true);
  };

  const handleRefresh = () => {
    if (busyRef.current) return;

    paginationRef.current = {
      page: 1,
      hasMore: false,
    };

    loadInvoices(1, false, true);
  };

  const handleViewInvoice = (invoice) => {
    navigation.navigate("InvoiceView", {
      invoiceId: invoice._id,
    });
  };

  const renderInvoice = ({ item }) => {
    const color = statusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.invoiceCard}
        activeOpacity={0.8}
        onPress={() => handleViewInvoice(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.invoiceIcon}>
            <Feather
              name="file-text"
              size={20}
              color={colors.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.invoiceNumber}>
              {item.invoiceNumber}
            </Text>
            <Text style={styles.dateText}>
              Issued: {formatDate(item.invoiceDate)}
            </Text>
          </View>

          <Feather
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </View>

        <View style={styles.dateRow}>
          <View>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>
              {formatDate(item.dueDate)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${color}15` },
            ]}
          >
            <Text style={[styles.statusText, { color }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.amountRow}>
          <View>
            <Text style={styles.label}>Total Amount</Text>
            <Text style={styles.amount}>
              {money(item.totalAmount)}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.label}>Balance Due</Text>
            <Text style={[styles.amount, { color: "#DC2626" }]}>
              {money(item.balanceDue)}
            </Text>
          </View>
        </View>

        <View style={styles.viewRow}>
          <Feather name="eye" size={15} color={colors.primary} />
          <Text style={styles.viewText}>View Invoice</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      <Text style={styles.title}>Billing & Invoices</Text>
      <Text style={styles.subtitle}>
        View your invoices, payments and outstanding balances.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TOTAL OUTSTANDING</Text>
        <Text style={styles.summaryAmount}>
          {money(stats.totalDue)}
        </Text>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summarySmallLabel}>Total Billed</Text>
            <Text style={styles.summarySmallValue}>
              {money(stats.totalBilled)}
            </Text>
          </View>

          <View>
            <Text style={styles.summarySmallLabel}>Total Paid</Text>
            <Text style={[styles.summarySmallValue, { color: "#059669" }]}>
              {money(stats.totalPaid)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Invoices</Text>

      <FlatList
        data={STATUSES}
        horizontal
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedStatus === item && styles.activeChip,
            ]}
            onPress={() => {
              if (selectedStatus === item) return;

              requestIdRef.current += 1;
              busyRef.current = false;
              paginationRef.current = {
                page: 1,
                hasMore: false,
              };
              setInvoices([]);
              setSelectedStatus(item);
            }}
          >
            <Text
              style={[
                styles.filterText,
                selectedStatus === item && styles.activeFilterText,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TopBar
        navigation={navigation}
        headerTitle="Billing & Invoices"
      />

      <FlatList
        data={invoices}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderInvoice}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading
              ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />
              )
              : (
                <>
                  <Feather
                    name="file-text"
                    size={35}
                    color="#94A3B8"
                  />
                  <Text style={styles.emptyText}>
                    No invoices found
                  </Text>
                </>
              )}
          </View>
        }
        ListFooterComponent={loadingMore
          ? (
            <ActivityIndicator
              style={{ marginVertical: 20 }}
              color={colors.primary}
            />
          )
          : null}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <ChildBottomBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 5,
    marginBottom: 20,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#DBEAFE",
    fontFamily: fonts.semiBold,
  },
  summaryAmount: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    marginTop: 8,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginVertical: 17,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summarySmallLabel: {
    fontSize: 12,
    color: "#DBEAFE",
    fontFamily: fonts.regular,
  },
  summarySmallValue: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: 14,
  },
  filterList: {
    marginBottom: 18,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#64748B",
  },
  activeFilterText: {
    color: "#FFFFFF",
  },
  invoiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  invoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceNumber: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  dateText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 4,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    marginBottom: 5,
  },
  value: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#334155",
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  amount: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 16,
  },
  viewText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: "#64748B",
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
