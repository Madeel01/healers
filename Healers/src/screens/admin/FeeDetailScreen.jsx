import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput,
    ScrollView,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import { getFeeDetailsApi } from '../../api/admin/api';
import { colors, commonStyles, fonts } from '../../styles/theme';
import { fontSize, hp, wp } from '../../utils/responsive';
import { sendInvoiceBroadcast } from '../../utils/invoiceBroadcast';

const LIMIT = 10;

const META = {
    overdue: {
        title: "Overdue Fees",
        color: "#DC2626",
        bg: "#FEF2F2",
        icon: "alert-triangle",
        empty: "No overdue invoices.",
    },
    unpaid: {
        title: "Unpaid Fees",
        color: "#F58B2A",
        bg: "#FFF7ED",
        icon: "clock",
        empty: "No unpaid invoices.",
    },
    revenue: {
        title: "Total Revenue",
        color: "#059669",
        bg: "#ECFDF5",
        icon: "trending-up",
        empty: "No payments received this year.",
    },
};

const money = (v) =>
    `PKR ${Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

const dateText = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function FeeDetailScreen({ navigation, route }) {
    const type = route.params?.type || "overdue";
    const meta = META[type] || META.overdue;

    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [remindingId, setRemindingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [search, setSearch] = useState("");
    const [year, setYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([]);
    const requestId = useRef(0);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchQuery.trim()), 500);
        return () => clearTimeout(t);
    }, [searchQuery]);
    const sendReminder = (item) => {
        if (remindingId) return;
        Alert.alert(
            "Send Reminder",
            `Send a payment reminder for ${item.invoiceNumber} to the child?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Send",
                    onPress: async () => {
                        try {
                            setRemindingId(item._id);
                            await sendInvoiceBroadcast({ ...item, childId: item.childId });
                            Alert.alert("Sent", "Reminder sent successfully.");
                        } catch (e) {
                            Alert.alert(
                                "Error",
                                e?.response?.data?.message || e?.message || "Could not send the reminder.",
                            );
                        } finally {
                            setRemindingId(null);
                        }
                    },
                },
            ],
        );
    };

    const load = useCallback(
        async ({ pageNumber = 1, append = false, refresh = false } = {}) => {
            const id = ++requestId.current;
            if (append) setLoadingMore(true);
            else if (refresh) setRefreshing(true);
            else setLoading(true);

            try {
                const params = { type, page: pageNumber, limit: LIMIT };
                if (search) params.search = search;
                if (type === "revenue") params.year = year;

                const res = await getFeeDetailsApi(params);
                if (id !== requestId.current) return;
                if (!res?.success) throw new Error(res?.message || "Unable to load.");

                const rows = res.data || [];
                setItems((prev) => {
                    if (!append) return rows;
                    const seen = new Set(prev.map((i) => String(i._id)));
                    return [...prev, ...rows.filter((r) => !seen.has(String(r._id)))];
                });
                setSummary(res.summary || null);
                if (res.summary?.years) setYears(res.summary.years);
                setPage(res.pagination?.page || pageNumber);
                setHasMore(Boolean(res.pagination?.hasMore));
            } catch (e) {
                if (id !== requestId.current) return;
                Alert.alert("Error", e?.response?.data?.message || e?.message || "Unable to load.");
            } finally {
                if (id === requestId.current) {
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [type, search, year],
    );

    useFocusEffect(
        useCallback(() => {
            load({ pageNumber: 1 });
        }, [load]),
    );

    const openInvoice = (id) => navigation.navigate("InvoiceView", { invoiceId: id });

    const renderHeader = () => (
        <View>

            <View style={[styles.summaryCard, { borderLeftColor: meta.color }]}>
                <View style={[styles.summaryIcon, { backgroundColor: meta.bg }]}>
                    <Feather name={meta.icon} size={fontSize(22)} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>
                        {type === "revenue" ? `FISCAL YEAR ${summary?.fiscalYear || new Date().getFullYear()}` : "TOTAL OUTSTANDING"}
                    </Text>
                    <Text style={[styles.summaryAmount, { color: meta.color }]} numberOfLines={1} adjustsFontSizeToFit>
                        {money(summary?.amount)}
                    </Text>
                    <Text style={styles.summarySub}>
                        {type === "revenue"
                            ? `${summary?.count || 0} payments received`
                            : `${summary?.count || 0} invoices · ${summary?.childrenCount || 0} children`}
                    </Text>
                </View>
            </View>
            {type === "revenue" && years.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: hp(12) }}>
                    {years.map((y) => (
                        <TouchableOpacity
                            key={y}
                            style={[styles.yearChip, year === y && styles.yearChipActive]}
                            onPress={() => setYear(y)}
                        >
                            <Text style={[styles.yearText, year === y && styles.yearTextActive]}>{y}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <View style={styles.searchBox}>
                <Feather name="search" size={fontSize(18)} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search child or invoice no..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                />
                {!!searchQuery && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={10}>
                        <Feather name="x" size={fontSize(18)} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>
            {items.length > 0 && (
                <Text style={styles.listHeading}>
                    {type === "revenue" ? "Payments" : "Invoices"}
                </Text>
            )}
        </View>
    );

    const renderItem = ({ item }) => {
        // ----- payment row (revenue) -----
        if (type === "revenue") {
            return (
                <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.8}
                    onPress={() => openInvoice(item.invoiceId)}
                >
                    <View style={styles.rowTop}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name} numberOfLines={1}>{item.childName}</Text>
                            <Text style={styles.sub}>{item.invoiceNumber}</Text>
                        </View>
                        <Text style={[styles.amount, { color: "#059669" }]}>+{money(item.amount)}</Text>
                    </View>
                    <View style={styles.rowBottom}>
                        <View style={styles.pill}>
                            <Feather name="credit-card" size={fontSize(12)} color="#64748B" />
                            <Text style={styles.pillText}>{item.paymentMethod || "Cash"}</Text>
                        </View>
                        <Text style={styles.sub}>{dateText(item.paidAt)}</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        // ----- invoice row (overdue / unpaid) -----
        const total = Number(item.totalAmount || 0);
        const paid = Number(item.paidAmount || 0);
        const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
        const late = item.daysOverdue > 0;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => openInvoice(item._id)}
            >
                <View style={styles.rowTop}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.name} numberOfLines={1}>{item.childName}</Text>
                        <Text style={styles.sub} numberOfLines={1}>
                            {item.parentName ? `${item.parentName} · ` : ""}{item.invoiceNumber}
                        </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.sub}>Balance</Text>
                        <Text style={[styles.amount, { color: meta.color }]}>{money(item.balanceDue)}</Text>
                    </View>
                </View>

                <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                </View>
                <View style={styles.rowBetween}>
                    <Text style={styles.sub}>{money(paid)} paid of {money(total)}</Text>
                    <Text style={styles.sub}>{Math.round(pct)}%</Text>
                </View>

                <View style={styles.rowBottom}>
                    <View style={[styles.pill, late && { backgroundColor: "#FEF2F2" }]}>
                        <Feather name="calendar" size={fontSize(12)} color={late ? "#B91C1C" : "#64748B"} />
                        <Text style={[styles.pillText, late && { color: "#B91C1C" }]}>
                            Due {dateText(item.dueDate)}
                        </Text>
                    </View>

                    <View style={styles.rightGroup}>
                        {late ? (
                            <Text style={styles.lateText}>
                                {item.daysOverdue} {item.daysOverdue === 1 ? "day" : "days"} late
                            </Text>
                        ) : (
                            <Text style={styles.sub}>{item.status}</Text>
                        )}

                        <TouchableOpacity
                            style={styles.bellBtn}
                            disabled={!!remindingId}
                            onPress={() => sendReminder(item)}
                            hitSlop={8}
                        >
                            {remindingId === item._id ? (
                                <ActivityIndicator size="small" color="#BA1A1A" />
                            ) : (
                                <Feather name="bell" size={fontSize(16)} color="#BA1A1A" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () =>
        loading ? (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        ) : (
            <View style={styles.center}>
                <Feather name="check-circle" size={fontSize(36)} color="#94A3B8" />
                <Text style={styles.emptyText}>
                    {search ? "No results match your search." : meta.empty}
                </Text>
            </View>
        );

    return (
        <View style={[styles.container, commonStyles.container]}>
            <FlatList
                data={items}
                keyExtractor={(i) => String(i._id)}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader()}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                    ) : !hasMore && items.length > 0 ? (
                        <Text style={styles.endText}>No more records</Text>
                    ) : null
                }
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                onEndReachedThreshold={0.3}
                onEndReached={() => {
                    if (hasMore && !loading && !refreshing && !loadingMore) {
                        load({ pageNumber: page + 1, append: true });
                    }
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load({ pageNumber: 1, refresh: true })}
                        colors={[colors.primary]}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { paddingHorizontal: wp(16), paddingTop: hp(12), paddingBottom: hp(30), flexGrow: 1 },

    titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: hp(14) },
    backBtn: {
        width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF",
        alignItems: "center", justifyContent: "center",
    },
    screenTitle: { fontSize: fontSize(20), fontFamily: fonts.semiBold, color: "#0F172A", lineHeight: 28 },

    summaryCard: {
        flexDirection: "row", alignItems: "center", gap: 14,
        backgroundColor: "#FFFFFF", borderRadius: wp(18), padding: wp(18),
        borderLeftWidth: 5, marginBottom: hp(16), elevation: 1,
    },
    summaryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    summaryLabel: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#64748B", letterSpacing: 0.5 },
    summaryAmount: { fontSize: fontSize(24), fontFamily: fonts.bold, lineHeight: 34, marginTop: 2 },
    summarySub: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B" },

    listHeading: { fontSize: fontSize(16), fontFamily: fonts.semiBold, color: "#0F172A", marginBottom: hp(10) },

    card: {
        backgroundColor: "#FFFFFF", borderRadius: wp(16), padding: wp(14),
        marginBottom: hp(10), borderWidth: 1, borderColor: "#F1F5F9", elevation: 1,
    },
    rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    rowBottom: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        marginTop: hp(10), paddingTop: hp(10), borderTopWidth: 1, borderTopColor: "#F1F5F9",
    },
    rightGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
    bellBtn: {
        width: 34, height: 34, borderRadius: 10, backgroundColor: "#FEF2F2",
        alignItems: "center", justifyContent: "center",
    },
    name: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#181C1E" },
    sub: { fontSize: fontSize(11), fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
    amount: { fontSize: fontSize(15), fontFamily: fonts.bold },

    track: { height: 6, backgroundColor: "#FEE2E2", borderRadius: 10, overflow: "hidden", marginTop: hp(12) },
    fill: { height: "100%", backgroundColor: "#059669" },

    pill: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    },
    pillText: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#64748B", lineHeight: 16 },
    lateText: { fontSize: fontSize(11), fontFamily: fonts.semiBold, color: "#B91C1C" },

    center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
    emptyText: { fontSize: fontSize(14), fontFamily: fonts.regular, color: "#64748B" },
    endText: { textAlign: "center", paddingVertical: 18, fontSize: fontSize(12), color: "#94A3B8", fontFamily: fonts.regular },
    searchBox: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#FFFFFF", borderRadius: wp(12), paddingHorizontal: wp(14),
        height: 46, marginBottom: hp(14), borderWidth: 1, borderColor: "#F1F5F9",
    },
    searchInput: { flex: 1, fontSize: fontSize(14), color: "#0F172A", fontFamily: fonts.regular, paddingVertical: 0 },
    yearChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8,
    },
    yearChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    yearText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, color: "#64748B", lineHeight: 18 },
    yearTextActive: { color: "#FFFFFF" },
});