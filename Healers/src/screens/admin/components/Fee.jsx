import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';

import { getInvoiceDashboardSummaryApi } from '../../../api/admin/api';
import {
  colors,
  fonts,
} from '../../../styles/theme';

const INITIAL_SUMMARY = {
  overdueFees: {
    amount: 0,
    childrenCount: 0,
    invoiceCount: 0,
  },
  unpaidFees: {
    amount: 0,
    childrenCount: 0,
    invoiceCount: 0,
  },
  totalRevenue: {
    amount: 0,
    paymentCount: 0,
    fiscalYear: new Date().getFullYear(),
  },
};

const formatMoney = (amount) => {
  return Number(amount || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export default function Fee({ customstyles }) {
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await getInvoiceDashboardSummaryApi();

      if (!response?.success) {
        throw new Error(
          response?.message || "Unable to load financial summary.",
        );
      }

      setSummary({
        overdueFees: {
          ...INITIAL_SUMMARY.overdueFees,
          ...response.data?.overdueFees,
        },
        unpaidFees: {
          ...INITIAL_SUMMARY.unpaidFees,
          ...response.data?.unpaidFees,
        },
        totalRevenue: {
          ...INITIAL_SUMMARY.totalRevenue,
          ...response.data?.totalRevenue,
        },
      });
    } catch (err) {
      console.log(
        "Financial summary error:",
        err?.response?.data || err?.message,
      );

      setError(
        err?.response?.data?.message
          || err?.message
          || "Unable to load financial summary.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  const financialCards = [
    {
      key: "overdue",
      title: "Overdue Fees",
      amount: summary.overdueFees.amount,
      subtitle: `${summary.overdueFees.childrenCount} Children pending`,
      icon: "event-busy",
      iconColor: "#DC2626",
      iconBg: "#FFDAD6",
      borderColor: "#E84545",
      subtitleColor: "#BA1A1A",
    },
    {
      key: "unpaid",
      title: "Unpaid Fees",
      amount: summary.unpaidFees.amount,
      subtitle: `${summary.unpaidFees.invoiceCount} invoices due within 7 days`,
      icon: "assignment-late",
      iconColor: "#F58B2A",
      iconBg: "rgba(245,139,42,.1)",
      borderColor: "#F58B2A",
      subtitleColor: "#D97706",
    },
    {
      key: "revenue",
      title: "Total Revenue",
      amount: summary.totalRevenue.amount,
      subtitle: `Fiscal Year ${summary.totalRevenue.fiscalYear}`,
      icon: "account-balance-wallet",
      iconColor: "#4CB99F",
      iconBg: "rgba(76,185,159,.1)",
      borderColor: "#4CB99F",
      subtitleColor: "#059669",
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={[customstyles?.sectionTitle, styles.sectionTitle]}>
          Financial Summary
        </Text>

        <TouchableOpacity
          style={styles.refreshButton}
          disabled={loading || refreshing}
          onPress={() => loadSummary(true)}
        >
          {refreshing
            ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            )
            : (
              <MaterialIcons
                name="refresh"
                size={22}
                color={colors.primary}
              />
            )}
        </TouchableOpacity>
      </View>

      {loading
        ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />
            <Text style={styles.loadingText}>
              Loading financial summary...
            </Text>
          </View>
        )
        : (
          <>
            {!!error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>

                <TouchableOpacity
                  onPress={() => loadSummary(true)}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {financialCards.map((card) => (
              <View
                key={card.key}
                style={styles.financialCard}
              >
                <View
                  style={[
                    styles.cardBorder,
                    {
                      backgroundColor: card.borderColor,
                    },
                  ]}
                />

                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.financeIconWrapper,
                      {
                        backgroundColor: card.iconBg,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={card.icon}
                      size={20}
                      color={card.iconColor}
                    />
                  </View>

                  <Text style={styles.financeLabel}>
                    {card.title}
                  </Text>
                </View>

                <Text style={styles.financeAmount}>
                  PKR {formatMoney(card.amount)}
                </Text>

                <Text
                  style={[
                    styles.financeSubText,
                    {
                      color: card.subtitleColor,
                    },
                  ]}
                >
                  {card.subtitle}
                </Text>
              </View>
            ))}
          </>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  sectionTitle: {
    marginBottom: 0,
  },

  refreshButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingContainer: {
    paddingVertical: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  errorContainer: {
    backgroundColor: "#FFF1F2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#BA1A1A",
    fontFamily: fonts.regular,
  },

  retryText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  financialCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#414750",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    position: "relative",
  },

  cardBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 5,
    height: "130%",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  financeIconWrapper: {
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  financeLabel: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  financeAmount: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 32,
    letterSpacing: -0.5,
  },

  financeSubText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    marginTop: 2,
  },
});
