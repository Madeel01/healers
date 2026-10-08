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
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import {
  addInvoicePaymentApi,
  getInvoicesApi,
  updateInvoiceStatusApi,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { sendInvoiceBroadcast } from '../../utils/invoiceBroadcast';

const PAGE_LIMIT = 5;

const STATUS_OPTIONS = [
  "All Statuses",
  "Paid",
  "Pending",
  "Partially Paid",
  "Overdue",
  "Cancelled",
  "Draft",
];

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Card",
  "Online",
  "Cheque",
  "Other",
];

const EMPTY_STATS = {
  totalRevenue: 0,
  outstanding: 0,
  collected: 0,
  outstandingCount: 0,
};

const formatCurrency = (value) =>
  `PKR ${
    Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }`;

const formatInvoiceDate = (value) => {
  if (!value) return "—";
  const datePart = typeof value === "string" ? value.slice(0, 10) : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? new Date(`${datePart}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getStatusTheme = (status) => {
  switch (status) {
    case "Paid":
      return {
        bg: "#ECFDF5",
        border: "#A7F3D0",
        color: "#047857",
        icon: "check-circle",
      };

    case "Partially Paid":
      return {
        bg: "#FFF7ED",
        border: "#FED7AA",
        color: "#C2410C",
        icon: "clock",
      };

    case "Overdue":
      return {
        bg: "#FEF2F2",
        border: "#FCA5A5",
        color: "#B91C1C",
        icon: "alert-triangle",
      };

    case "Pending":
      return {
        bg: "#FFFBEB",
        border: "#FDE68A",
        color: "#B45309",
        icon: "clock",
      };

    case "Cancelled":
      return {
        bg: "#F1F5F9",
        border: "#CBD5E1",
        color: "#64748B",
        icon: "x-circle",
      };

    default:
      return {
        bg: "#F1F5F9",
        border: "#CBD5E1",
        color: "#475569",
        icon: "file-text",
      };
  }
};

const MetricCard = ({
  title,
  value,
  icon,
  color,
  background,
  subtitle,
}) => (
  <View style={styles.metricCard}>
    <View style={styles.metricTop}>
      <View style={styles.metricText}>
        <Text style={styles.metricLabel}>{title}</Text>
        <Text
          style={[styles.metricValue, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCurrency(value)}
        </Text>
      </View>

      <View
        style={[
          styles.metricIcon,
          { backgroundColor: background },
        ]}
      >
        <Feather name={icon} size={21} color={color} />
      </View>
    </View>

    {!!subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
  </View>
);

export default function InvoiceManagementScreen({
  navigation,
}) {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [paymentStatus, setPaymentStatus] = useState("Partially Paid");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const loadingMoreRef = useRef(false);
  const scrollTriggeredRef = useRef(false);
  const requestIdRef = useRef(0);
  const listBusyRef = useRef(false);
  const paginationRef = useRef({
    page: 1,
    hasMore: false,
  });

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
      search = debouncedSearch,
      status = selectedStatus,
    } = {}) => {
      if (append) {
        if (
          listBusyRef.current
          || loadingMoreRef.current
          || !paginationRef.current.hasMore
        ) {
          return;
        }

        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        listBusyRef.current = true;
        paginationRef.current = { page: 1, hasMore: false };
        scrollTriggeredRef.current = false;
        setHasMore(false);

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }

      const requestId = ++requestIdRef.current;

      try {
        const params = {
          page: pageNumber,
          limit: PAGE_LIMIT,
        };

        if (search) {
          params.search = search;
        }

        if (status !== "All Statuses") {
          params.status = status;
        }

        const response = await getInvoicesApi(params);
        const result = response?.data?.success
          ? response.data
          : response;

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!result?.success) {
          throw new Error(
            result?.message || "Unable to load invoices.",
          );
        }

        const newInvoices = Array.isArray(result.data)
          ? result.data
          : [];
;
        const pagination = result.pagination || {};

        if (append) {
          setInvoices((previous) => {
            const existing = new Set(
              previous.map((item) => String(item._id)),
            );

            const unique = newInvoices.filter(
              (item) => !existing.has(String(item._id)),
            );

            return [...previous, ...unique];
          });
        } else {
          setInvoices(newInvoices);
        }

        const nextPage = Number(
          pagination.page || pageNumber,
        );

        const more = Boolean(pagination.hasMore);

        paginationRef.current = {
          page: nextPage,
          hasMore: more,
        };

        setPage(nextPage);
        setHasMore(more);

        if (result.stats) {
          setStats({
            totalRevenue: Number(
              result.stats.totalRevenue || 0,
            ),
            outstanding: Number(
              result.stats.outstanding || 0,
            ),
            collected: Number(
              result.stats.collected || 0,
            ),
            outstandingCount: Number(
              result.stats.outstandingCount || 0,
            ),
          });
        } else if (!append) {
          setStats(EMPTY_STATS);
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

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
        if (requestId === requestIdRef.current && append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else if (requestId === requestIdRef.current) {
          listBusyRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [debouncedSearch, selectedStatus],
  );

  useFocusEffect(
    useCallback(() => {
      paginationRef.current = {
        page: 1,
        hasMore: false,
      };
      scrollTriggeredRef.current = false;

      loadingMoreRef.current = false;
      listBusyRef.current = false;
      setHasMore(false);

      loadInvoices({
        pageNumber: 1,
      });

      return () => {
        requestIdRef.current += 1;
        loadingMoreRef.current = false;
        listBusyRef.current = false;
        scrollTriggeredRef.current = false;
      };
    }, [loadInvoices]),
  );

  const handleRefresh = () => {
    if (listBusyRef.current || loadingMoreRef.current) {
      return;
    }

    loadInvoices({
      pageNumber: 1,
      refresh: true,
    });
  };

  const handleLoadMore = () => {
    if (
      !scrollTriggeredRef.current
      || loading
      || refreshing
      || loadingMore
      || listBusyRef.current
      || loadingMoreRef.current
      || !paginationRef.current.hasMore
    ) {
      return;
    }

    scrollTriggeredRef.current = false;
    loadInvoices({
      pageNumber: paginationRef.current.page + 1,
      append: true,
    });
  };

  const handleSelectStatus = (status) => {
    setFilterModalVisible(false);

    if (status === selectedStatus) return;

    requestIdRef.current += 1;
    scrollTriggeredRef.current = false;
    loadingMoreRef.current = false;
    listBusyRef.current = false;
    paginationRef.current = { page: 1, hasMore: false };
    setLoadingMore(false);
    setInvoices([]);
    setHasMore(false);
    setPage(1);
    setSelectedStatus(status);
  };

  const handleViewInvoice = (invoice) => {
    navigation.navigate("InvoiceView", {
      invoiceId: invoice._id,
    });
  };

  const handleCreateInvoice = () => {
    navigation.navigate("CreateNewInvoice");
  };

  const handleRemind = (invoice) => {
    Alert.alert(
      "Payment Reminder",
      `Reminder for ${invoice.invoiceNumber}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
        },
      ],
    );
  };

  const handleEditPayment = (invoice) => {
    if (["Draft", "Cancelled"].includes(invoice.status)) {
      Alert.alert(
        "Unavailable",
        "Payments cannot be recorded for draft or cancelled invoices.",
      );
      return;
    }

    const balance = roundMoney(invoice.balanceDue || 0);

    if (balance <= 0) {
      Alert.alert(
        "Already Paid",
        "This invoice has no outstanding balance.",
      );
      return;
    }

    setSelectedInvoice(invoice);
    setPaymentStatus("Partially Paid");
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPaymentNote("");
    setPaymentModalVisible(true);
  };

  const handlePaymentStatusChange = (status) => {
    setPaymentStatus(status);

    if (status === "Paid") {
      setPaymentAmount(
        roundMoney(
          selectedInvoice?.balanceDue || 0,
        ).toFixed(2),
      );
    } else {
      setPaymentAmount("");
    }
  };

  const closePaymentModal = () => {
    if (savingPayment) return;

    setPaymentModalVisible(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    setPaymentNote("");
  };

  const handleSavePayment = async () => {
    if (!selectedInvoice || savingPayment) return;

    const balance = roundMoney(
      selectedInvoice.balanceDue || 0,
    );

    const amount = paymentStatus === "Paid"
      ? balance
      : Number(paymentAmount);

    if (
      !Number.isFinite(amount)
      || amount <= 0
      || !Number.isInteger(
        Math.round(amount * 100)
          - amount * 100 + 0.0000001,
      )
    ) {
      if (
        !Number.isFinite(amount)
        || amount <= 0
        || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
      ) {
        Alert.alert(
          "Invalid Amount",
          "Enter a valid amount with up to two decimal places.",
        );
        return;
      }
    }

    if (amount > balance) {
      Alert.alert(
        "Invalid Amount",
        "Payment cannot exceed the outstanding balance.",
      );
      return;
    }

    if (
      paymentStatus === "Partially Paid"
      && amount >= balance
    ) {
      Alert.alert(
        "Invalid Amount",
        "Partial payment must be less than the remaining balance.",
      );
      return;
    }

    const payload = {
      amount: roundMoney(amount),
      paymentMethod,
      note: paymentNote.trim()
        || (paymentStatus === "Paid"
          ? "Full balance payment"
          : "Partial payment"),
    };

    try {
      setSavingPayment(true);

      const response = await addInvoicePaymentApi(
        selectedInvoice._id,
        payload,
      );

      const result = response?.data?.success
        ? response.data
        : response;

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to record payment.",
        );
      }

      setPaymentModalVisible(false);
      setSelectedInvoice(null);
      setPaymentAmount("");
      setPaymentNote("");

      await loadInvoices({
        pageNumber: 1,
      });

      Alert.alert(
        "Success",
        "Payment recorded successfully.",
      );
    } catch (error) {
      Alert.alert(
        "Payment Failed",
        error?.response?.data?.message
          || error?.message
          || "Unable to save payment.",
      );
    } finally {
      setSavingPayment(false);
    }
  };

  const collectedPercentage = stats.totalRevenue > 0
    ? Math.min(
      Math.max(
        (stats.collected / stats.totalRevenue) * 100,
        0,
      ),
      100,
    )
    : 0;

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

      <MetricCard
        title="TOTAL REVENUE"
        value={stats.totalRevenue}
        icon="bar-chart-2"
        color={colors.primary}
        background="#EBF3F9"
        subtitle="Total active invoice amount"
      />

      <MetricCard
        title="TOTAL OUTSTANDING"
        value={stats.outstanding}
        icon="alert-circle"
        color="#BA1A1A"
        background="#FEF2F2"
        subtitle={`${stats.outstandingCount} unpaid ${
          stats.outstandingCount === 1
            ? "invoice"
            : "invoices"
        }`}
      />

      <MetricCard
        title="TOTAL COLLECTED"
        value={stats.collected}
        icon="check-circle"
        color="#006B58"
        background="#ECFDF5"
        subtitle={`${
          Math.round(
            collectedPercentage,
          )
        }% of total revenue collected`}
      />

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            Collection Progress
          </Text>
          <Text style={styles.progressPercent}>
            {collectedPercentage.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${collectedPercentage}%` },
            ]}
          />
        </View>

        <View style={styles.progressLegend}>
          <Text style={styles.progressCollected}>
            Collected
          </Text>
          <Text style={styles.progressOutstanding}>
            Outstanding
          </Text>
        </View>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.searchBarContainer}>
          <Feather
            name="search"
            size={18}
            color="#94A3B8"
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

        <TouchableOpacity
          style={styles.dropdownFilter}
          onPress={() => setFilterModalVisible(true)}
        >
          <View style={styles.filterLeft}>
            <Feather
              name="filter"
              size={17}
              color="#64748B"
            />

            <Text style={styles.dropdownFilterText}>
              {selectedStatus}
            </Text>
          </View>

          <Feather
            name="chevron-down"
            size={18}
            color="#64748B"
          />
        </TouchableOpacity>
      </View>

      {!loading && invoices.length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>
            Invoices
          </Text>

          <Text style={styles.resultCount}>
            {invoices.length} loaded
          </Text>
        </View>
      )}
    </View>
  );

  const handleUpdateDraftStatus = (invoice) => {
    if (invoice.status !== "Draft" || updatingStatusId) {
      return;
    }

    Alert.alert(
      "Update Invoice Status",
      `Change invoice ${invoice.invoiceNumber} from Draft to Pending and notify the child?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Update",
          onPress: async () => {
            try {
              setUpdatingStatusId(invoice._id);

              const response = await updateInvoiceStatusApi(
                invoice._id,
                "Pending",
              );

              const result = response?.data?.success
                ? response.data
                : response;

              if (!result?.success) {
                throw new Error(
                  result?.message || "Unable to update invoice status.",
                );
              }

              const updatedInvoice = result.data;

              let notificationSent = false;

              try {
                await sendInvoiceBroadcast({
                  ...invoice,
                  ...updatedInvoice,
                  childId: updatedInvoice?.childId || invoice.childId,
                });

                notificationSent = true;
              } catch (broadcastError) {
                console.error(
                  "Invoice broadcast error:",
                  broadcastError?.response?.data
                    || broadcastError?.message,
                );
              }

              await loadInvoices({
                pageNumber: 1,
              });

              Alert.alert(
                "Success",
                notificationSent
                  ? "Invoice activated and notification sent successfully."
                  : "Invoice activated, but notification could not be sent.",
              );
            } catch (error) {
              Alert.alert(
                "Error",
                error?.response?.data?.message
                  || error?.message
                  || "Unable to update invoice status.",
              );
            } finally {
              setUpdatingStatusId(null);
            }
          },
        },
      ],
    );
  };

  const renderInvoice = ({ item }) => {
    const theme = getStatusTheme(item.status);

    const childName = item.childId?.fullName
      || item.childName
      || "Unknown Child";

    const parentName = item.parentId?.fullName
      || item.parentName
      || "Parent/Guardian";

    const total = Number(item.totalAmount || 0);
    const paid = Number(item.paidAmount || 0);
    const balance = Number(item.balanceDue || 0);

    const percentage = total > 0
      ? Math.min(Math.max((paid / total) * 100, 0), 100)
      : 0;

    const canPay = balance > 0
      && !["Draft", "Cancelled"].includes(item.status);

    return (
      <View style={styles.invoiceCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleViewInvoice(item)}
        >
          <View style={styles.invoiceHeaderRow}>
            <View
              style={[
                styles.invoiceIconContainer,
                { backgroundColor: theme.bg },
              ]}
            >
              <Feather
                name={theme.icon}
                size={18}
                color={theme.color}
              />
            </View>

            <View style={styles.invoiceTextContainer}>
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
                Child: {childName}
              </Text>

              <Text style={styles.invoiceNumber}>
                {item.invoiceNumber}
              </Text>
            </View>

            <Feather
              name="chevron-right"
              size={20}
              color="#94A3B8"
            />
          </View>

          <View style={styles.invoiceDatesRow}>
            <View style={styles.invoiceDateBlock}>
              <Text style={styles.invoiceDateLabel}>Invoice Date</Text>
              <View style={styles.invoiceDateValueRow}>
                <Feather name="calendar" size={13} color="#64748B" />
                <Text style={styles.invoiceDateValue}>
                  {formatInvoiceDate(item.invoiceDate)}
                </Text>
              </View>
            </View>
            <View style={styles.invoiceDateBlock}>
              <Text style={styles.invoiceDateLabel}>Due Date</Text>
              <View style={styles.invoiceDateValueRow}>
                <Feather name="calendar" size={13} color={item.status === "Overdue" ? "#B91C1C" : "#64748B"} />
                <Text style={[styles.invoiceDateValue, item.status === "Overdue" && styles.overdueDateValue]}>
                  {formatInvoiceDate(item.dueDate)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.amountStatusRow}>
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>
                INVOICE AMOUNT
              </Text>

              <Text style={styles.amountValue}>
                {formatCurrency(total)}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: theme.color },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.balanceBox}>
            <View style={styles.balanceInfoRow}>
              <Text style={styles.balanceInfoLabel}>
                Collected
              </Text>

              <Text style={styles.collectedValue}>
                {formatCurrency(paid)}
              </Text>
            </View>

            <View style={styles.balanceInfoRow}>
              <Text style={styles.balanceInfoLabel}>
                Outstanding
              </Text>

              <Text style={styles.balanceInfoValue}>
                {formatCurrency(balance)}
              </Text>
            </View>

            <View style={styles.cardProgressTrack}>
              <View
                style={[
                  styles.cardProgressFill,
                  { width: `${percentage}%` },
                ]}
              />
            </View>

            <Text style={styles.cardProgressText}>
              {Math.round(percentage)}% Paid
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => handleViewInvoice(item)}
          >
            <Feather
              name="eye"
              size={17}
              color="#475569"
            />
          </TouchableOpacity>

          {item.status === "Draft" && (
            <TouchableOpacity
              style={[
                styles.editPaymentBtn,
                updatingStatusId === item._id && {
                  opacity: 0.6,
                },
              ]}
              disabled={!!updatingStatusId}
              onPress={() => handleUpdateDraftStatus(item)}
            >
              {updatingStatusId === item._id
                ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                )
                : (
                  <>
                    <Feather
                      name="edit-3"
                      size={15}
                      color="#FFFFFF"
                    />

                    <Text style={styles.editPaymentText}>
                      Update Status
                    </Text>
                  </>
                )}
            </TouchableOpacity>
          )}

          {canPay && (
            <TouchableOpacity
              style={styles.editPaymentBtn}
              onPress={() => handleEditPayment(item)}
            >
              <Feather
                name="credit-card"
                size={15}
                color="#FFFFFF"
              />

              <Text style={styles.editPaymentText}>
                Update Payment
              </Text>
            </TouchableOpacity>
          )}

          {canPay && (
            <TouchableOpacity
              style={styles.remindBtn}
              onPress={() => handleRemind(item)}
            >
              <Feather
                name="mail"
                size={16}
                color="#BA1A1A"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
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

        <Text style={styles.emptyDescription}>
          {debouncedSearch
              || selectedStatus !== "All Statuses"
            ? "Try changing your search or filter."
            : "Create your first invoice to get started."}
        </Text>

        {!debouncedSearch
          && selectedStatus === "All Statuses" && (
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={handleCreateInvoice}
          >
            <Feather
              name="plus"
              size={16}
              color="#FFFFFF"
            />

            <Text style={styles.emptyCreateText}>
              Create Invoice
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator
            size="small"
            color={colors.primary}
          />

          <Text style={styles.footerLoaderText}>
            Loading more...
          </Text>
        </View>
      );
    }

    if (!hasMore && invoices.length > 0) {
      return (
        <Text style={styles.endText}>
          No more invoices
        </Text>
      );
    }

    return <View style={styles.footerSpacing} />;
  };

  const renderFilterModal = () => (
    <Modal
      visible={filterModalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Filter by Status
            </Text>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setFilterModalVisible(false)}
            >
              <Feather
                name="x"
                size={20}
                color="#64748B"
              />
            </TouchableOpacity>
          </View>

          {STATUS_OPTIONS.map((status) => {
            const selected = selectedStatus === status;

            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.modalOption,
                  selected && styles.modalOptionSelected,
                ]}
                onPress={() => handleSelectStatus(status)}
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
                  <View style={styles.checkCircle}>
                    <Feather
                      name="check"
                      size={14}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );

  const renderPaymentModal = () => {
    const total = Number(
      selectedInvoice?.totalAmount || 0,
    );

    const collected = Number(
      selectedInvoice?.paidAmount || 0,
    );

    const balance = Number(
      selectedInvoice?.balanceDue || 0,
    );

    const amount = paymentStatus === "Paid"
      ? balance
      : Number(paymentAmount || 0);

    const remainingAfterPayment = roundMoney(
      Math.max(balance - amount, 0),
    );

    return (
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePaymentModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.paymentModalContent}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.paymentScrollContent}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    Update Payment
                  </Text>

                  <Text style={styles.paymentInvoiceNumber}>
                    {selectedInvoice?.invoiceNumber}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={closePaymentModal}
                  disabled={savingPayment}
                >
                  <Feather
                    name="x"
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.paymentSummary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Invoice Total
                  </Text>

                  <Text style={styles.summaryValue}>
                    {formatCurrency(total)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Already Collected
                  </Text>

                  <Text style={styles.summaryCollected}>
                    {formatCurrency(collected)}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Outstanding Balance
                  </Text>

                  <Text style={styles.summaryOutstanding}>
                    {formatCurrency(balance)}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>
                Payment Status
              </Text>

              <View style={styles.paymentStatusRow}>
                {["Partially Paid", "Paid"].map((status) => {
                  const selected = paymentStatus === status;

                  return (
                    <TouchableOpacity
                      key={status}
                      disabled={savingPayment}
                      style={[
                        styles.paymentStatusOption,
                        selected
                        && styles.paymentStatusOptionActive,
                      ]}
                      onPress={() => handlePaymentStatusChange(status)}
                    >
                      <Feather
                        name={status === "Paid"
                          ? "check-circle"
                          : "clock"}
                        size={16}
                        color={selected ? "#FFFFFF" : "#64748B"}
                      />

                      <Text
                        style={[
                          styles.paymentStatusText,
                          selected
                          && styles.paymentStatusTextActive,
                        ]}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                Payment Amount
              </Text>

              <View
                style={[
                  styles.paymentInputContainer,
                  paymentStatus === "Paid"
                  && styles.disabledInput,
                ]}
              >
                <Text style={styles.currencyPrefix}>
                  PKR
                </Text>

                <TextInput
                  style={styles.paymentInput}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  placeholder="Enter amount"
                  placeholderTextColor="#94A3B8"
                  editable={paymentStatus !== "Paid"
                    && !savingPayment}
                />
              </View>

              {paymentStatus === "Paid" && (
                <Text style={styles.inputHint}>
                  Full remaining balance will be collected.
                </Text>
              )}

              <View style={styles.remainingPreview}>
                <Text style={styles.remainingLabel}>
                  Balance After Payment
                </Text>

                <Text style={styles.remainingValue}>
                  {formatCurrency(remainingAfterPayment)}
                </Text>
              </View>

              <Text style={styles.inputLabel}>
                Payment Method
              </Text>

              <View style={styles.paymentMethodGrid}>
                {PAYMENT_METHODS.map((method) => {
                  const selected = paymentMethod === method;

                  return (
                    <TouchableOpacity
                      key={method}
                      disabled={savingPayment}
                      style={[
                        styles.methodOption,
                        selected && styles.methodOptionActive,
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.methodText,
                          selected && styles.methodTextActive,
                        ]}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                Payment Note (Optional)
              </Text>

              <TextInput
                style={styles.noteInput}
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholder="Add payment note..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                editable={!savingPayment}
              />

              <TouchableOpacity
                style={[
                  styles.savePaymentBtn,
                  savingPayment && styles.disabledButton,
                ]}
                onPress={handleSavePayment}
                disabled={savingPayment}
              >
                {savingPayment ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Feather
                      name="check"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text style={styles.savePaymentText}>
                      Save Payment
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelPaymentBtn}
                onPress={closePaymentModal}
                disabled={savingPayment}
              >
                <Text style={styles.cancelPaymentText}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
        onScrollBeginDrag={() => { scrollTriggeredRef.current = true; }}
        onMomentumScrollBegin={() => { scrollTriggeredRef.current = true; }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.15}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />

      {renderFilterModal()}
      {renderPaymentModal()}

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
    lineHeight: 34,
    marginBottom: 5,
  },

  introDescription: {
    fontSize: 15,
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
  },

  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
  },

  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  metricText: {
    flex: 1,
    marginRight: 12,
  },

  metricLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  metricValue: {
    fontSize: 27,
    fontFamily: fonts.bold,
    lineHeight: 38,
  },

  metricIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  metricSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
    marginTop: 8,
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  progressTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  progressPercent: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#006B58",
  },

  progressTrack: {
    height: 9,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#059669",
    borderRadius: 10,
  },

  progressLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  progressCollected: {
    fontSize: 12,
    color: "#059669",
    fontFamily: fonts.regular,
  },

  progressOutstanding: {
    fontSize: 12,
    color: "#BA1A1A",
    fontFamily: fonts.regular,
  },

  filterSection: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 10,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },

  dropdownFilter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },

  filterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dropdownFilterText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
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
    color: "#181C1E",
  },

  childSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  invoiceNumber: {
    marginTop: 4,
    fontSize: 11,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  invoiceDatesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  invoiceDateBlock: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },
  invoiceDateLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginBottom: 6,
  },
  invoiceDateValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  invoiceDateValue: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    flexShrink: 1,
  },
  overdueDateValue: {
    color: "#B91C1C",
  },

  amountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },

  amountBlock: {
    flex: 1,
  },

  amountLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  amountValue: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: "#00497B",
  },

  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  statusBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },

  balanceBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },

  balanceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  balanceInfoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  collectedValue: {
    fontSize: 13,
    color: "#059669",
    fontFamily: fonts.semiBold,
  },

  balanceInfoValue: {
    fontSize: 13,
    color: "#BA1A1A",
    fontFamily: fonts.semiBold,
  },

  cardProgressTrack: {
    height: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    overflow: "hidden",
  },

  cardProgressFill: {
    height: "100%",
    backgroundColor: "#059669",
  },

  cardProgressText: {
    fontSize: 11,
    color: "#64748B",
    fontFamily: fonts.regular,
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  editPaymentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 38,
    gap: 7,
  },

  editPaymentText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  remindBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  modalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    elevation: 5,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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

  paymentModalContent: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
  },

  paymentScrollContent: {
    padding: 20,
    paddingBottom: 24,
  },

  paymentInvoiceNumber: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
    marginTop: 4,
  },

  paymentSummary: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 15,
    gap: 12,
    marginBottom: 20,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
    flex: 1,
  },

  summaryValue: {
    fontSize: 13,
    color: "#0F172A",
    fontFamily: fonts.semiBold,
  },

  summaryCollected: {
    fontSize: 13,
    color: "#059669",
    fontFamily: fonts.semiBold,
  },

  summaryOutstanding: {
    fontSize: 15,
    color: "#BA1A1A",
    fontFamily: fonts.bold,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },

  inputLabel: {
    fontSize: 13,
    color: "#334155",
    fontFamily: fonts.semiBold,
    marginBottom: 9,
  },

  paymentStatusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  paymentStatusOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    paddingVertical: 13,
  },

  paymentStatusOptionActive: {
    backgroundColor: colors.primary,
  },

  paymentStatusText: {
    fontSize: 12,
    color: "#475569",
    fontFamily: fonts.semiBold,
  },

  paymentStatusTextActive: {
    color: "#FFFFFF",
  },

  paymentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },

  disabledInput: {
    backgroundColor: "#F8FAFC",
  },

  currencyPrefix: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: fonts.semiBold,
    marginRight: 10,
  },

  paymentInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    fontFamily: fonts.semiBold,
    paddingVertical: 0,
  },

  inputHint: {
    fontSize: 12,
    color: "#059669",
    fontFamily: fonts.regular,
    marginBottom: 12,
  },

  remainingPreview: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 20,
  },

  remainingLabel: {
    fontSize: 12,
    color: "#475569",
    fontFamily: fonts.regular,
    flex: 1,
  },

  remainingValue: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fonts.bold,
  },

  paymentMethodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },

  methodOption: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  methodOptionActive: {
    borderColor: colors.primary,
    backgroundColor: "#EBF3F9",
  },

  methodText: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  methodTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    height: 75,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
    marginBottom: 20,
  },

  savePaymentBtn: {
    backgroundColor: colors.primary,
    borderRadius: 11,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  savePaymentText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },

  cancelPaymentBtn: {
    paddingVertical: 15,
    alignItems: "center",
  },

  cancelPaymentText: {
    fontSize: 13,
    color: "#64748B",
    fontFamily: fonts.semiBold,
  },
});
