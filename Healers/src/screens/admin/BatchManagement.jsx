import React, { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";

import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, fonts } from "../../styles/theme";
import {
    createBatch,
    deleteBatch,
    getBatches,
    updateBatch,
} from "../../api/admin/api";
import { therapistSpecialities } from "../../utils/specialities";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
const getBatchSpecialities = (speciality) =>
    Array.isArray(speciality)
        ? speciality
        : speciality
            ? [speciality]
            : [];
const emptyForm = {
    batchName: "",
    speciality: [],
    dateFrom: "",
    dateTo: "",
    maxChild: "",
    fee: "",
};

export default function BatchManagementScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [activeBottomTab, setActiveBottomTab] = useState("");

    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSpeciality, setSelectedSpeciality] = useState([]);
    const [tempSpeciality, setTempSpeciality] = useState([]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [dateModalField, setDateModalField] = useState("dateFrom");
    const today = new Date();
    const [calendarCursor, setCalendarCursor] = useState({
        year: today.getFullYear(),
        month: today.getMonth(),
    });

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingBatchId, setEditingBatchId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const [isSpecialityModalOpen, setIsSpecialityModalOpen] = useState(false);

    const fetchBatches = useCallback(
        async (isRefresh = false) => {
            try {
                if (isRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                const res = await getBatches({
                    page: 1,
                    limit: 50,
                    speciality: selectedSpeciality.join(","),
                });
                if (res.success) {
                    setBatches(res.data || []);
                }
            } catch (err) {
                console.log("Fetch batches error:", err);
                Alert.alert("Error", "Failed to load batches.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [selectedSpeciality],
    );

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    const openCreateModal = () => {
        setEditingBatchId(null);
        setForm(emptyForm);
        setIsFormModalOpen(true);
    };

    const openEditModal = (batch) => {
        setEditingBatchId(batch._id);
        const batchSpecialities = getBatchSpecialities(batch.speciality);

        setForm({
            batchName: batch.batchName || "",
            speciality: therapistSpecialities.filter((s) =>
                batchSpecialities.includes(s.id),
            ),
            dateFrom: batch.dateFrom ? batch.dateFrom.substring(0, 10) : "",
            dateTo: batch.dateTo ? batch.dateTo.substring(0, 10) : "",
            maxChild: batch.maxChild ? String(batch.maxChild) : "",
            fee: batch.fee ? String(batch.fee) : "",
        });
        setIsFormModalOpen(true);
    };

    const toggleSpecialitySelection = (spec) => {
        setForm((prev) => {
            const exists = prev.speciality.some((s) => s.id === spec.id);
            return {
                ...prev,
                speciality: exists
                    ? prev.speciality.filter((s) => s.id !== spec.id)
                    : [...prev.speciality, spec],
            };
        });
    };

    const validateForm = () => {
        if (!form.batchName.trim()) {
            Alert.alert("Missing info", "Please enter a batch name.");
            return false;
        }
        if (!form.speciality.length) {
            Alert.alert("Missing info", "Please select at least one speciality.");
            return false;
        }
        if (!form.dateFrom || !/^\d{4}-\d{2}-\d{2}$/.test(form.dateFrom)) {
            Alert.alert(
                "Missing info",
                "Please enter a valid date from (YYYY-MM-DD).",
            );
            return false;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(form.dateFrom) < today) {
            Alert.alert("Invalid date", "Date From must be today or later.");
            return false;
        }
        if (new Date(form.dateTo) < new Date(form.dateFrom)) {
            Alert.alert("Invalid dates", "Date To cannot be before Date From.");
            return false;
        }
        if (!form.maxChild || parseInt(form.maxChild, 10) <= 0) {
            Alert.alert("Missing info", "Please enter a valid max children count.");
            return false;
        }
        if (!form.fee || parseInt(form.fee, 10) <= 0) {
            Alert.alert("Missing info", "Please enter a valid batch fee.");
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        const payload = {
            batchName: form.batchName.trim(),
            speciality: form.speciality.map((s) => s.id),
            dateFrom: form.dateFrom,
            dateTo: form.dateTo,
            maxChild: parseInt(form.maxChild, 10),
            fee: parseInt(form.fee, 10),
        };

        setSaving(true);
        try {
            const res = editingBatchId
                ? await updateBatch(editingBatchId, payload)
                : await createBatch(payload);

            if (res.success) {
                setIsFormModalOpen(false);
                fetchBatches();
            } else {
                Alert.alert("Error", res.message || "Something went wrong.");
            }
        } catch (err) {
            console.log("Save batch error:", err);
            Alert.alert("Error", "Failed to save batch.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (batch) => {
        Alert.alert(
            "Delete Batch",
            `Are you sure you want to delete "${batch.batchName}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await deleteBatch(batch._id);
                            if (res.success) {
                                setBatches((prev) => prev.filter((b) => b._id !== batch._id));
                            } else {
                                Alert.alert("Error", res.message || "Failed to delete batch.");
                            }
                        } catch (err) {
                            console.log("Delete batch error:", err);
                            Alert.alert("Error", "Failed to delete batch.");
                        }
                    },
                },
            ],
        );
    };

    const pad2 = (n) => String(n).padStart(2, "0");
    const formatDate = (year, month, day) =>
        `${year}-${pad2(month + 1)}-${pad2(day)}`;


    const openDateModal = (field) => {
        const selectedDate = form[field]
            ? new Date(form[field] + "T00:00:00")
            : new Date();

        setDateModalField(field);

        setCalendarCursor({
            year: selectedDate.getFullYear(),
            month: selectedDate.getMonth(),
        });

        setIsDateModalOpen(true);
    };

    const goToPrevMonth = () => {
        setCalendarCursor((prev) => {
            const today = new Date();
            const currentMonth = new Date(
                today.getFullYear(),
                today.getMonth(),
                1,
            );

            const previousMonth = new Date(
                prev.year,
                prev.month - 1,
                1,
            );

            if (previousMonth < currentMonth) {
                return prev;
            }

            return {
                year: previousMonth.getFullYear(),
                month: previousMonth.getMonth(),
            };
        });
    };

    const goToNextMonth = () => {
        setCalendarCursor((prev) => {
            const nextMonth = new Date(
                prev.year,
                prev.month + 1,
                1,
            );

            return {
                year: nextMonth.getFullYear(),
                month: nextMonth.getMonth(),
            };
        });
    };

    const getCalendarGrid = (year, month) => {
        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells = [];

        for (let i = 0; i < firstDayIndex; i++) {
            cells.push(null);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            cells.push(d);
        }

        return cells;
    };

    const handleSelectDate = (day) => {
        const dateStr = formatDate(
            calendarCursor.year,
            calendarCursor.month,
            day,
        );

        const selectedDate = new Date(
            calendarCursor.year,
            calendarCursor.month,
            day,
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
        return;
        }

        if (
            dateModalField === "dateTo" &&
            form.dateFrom &&
            selectedDate < new Date(form.dateFrom + "T00:00:00")
        ) {
            Alert.alert(
                "Invalid date",
                "Date To cannot be before Date From.",
            );
            return;
        }

        setForm((p) => ({
            ...p,
            [dateModalField]: dateStr,
        }));

        setIsDateModalOpen(false);
    };

    return (
        <SafeAreaView style={styles.mainContainer}>
            <TopBar
                navigation={navigation}
                isNotificationOpen={isNotificationOpen}
                onToggleNotification={setIsNotificationOpen}
                headerTitle={"Batch Management"}
            />
            <View style={styles.searchRow}>
                <View style={styles.searchInputContainerMain}>
                    <Feather
                        name="search"
                        size={20}
                        color="#94A3B8"
                        style={styles.searchIcon}
                    />

                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search batches..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <TouchableOpacity
                    style={styles.filterIconButton}
                    onPress={() => {
                        setTempSpeciality(selectedSpeciality);
                        setIsFilterModalOpen(true);
                    }}
                >
                    <Feather name="sliders" size={20} color="#0B4A6F" />
                </TouchableOpacity>
            </View>
            {loading ? (
                <View style={styles.centerFill}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchBatches(true)}
                            colors={[colors.primary]}
                        />
                    }
                >
                    {batches.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="layers" size={32} color="#94A3B8" />
                            <Text style={styles.emptyStateText}>No batches yet</Text>
                            <Text style={styles.emptyStateSubText}>
                                Tap the + button to create your first batch.
                            </Text>
                        </View>
                    ) : (
                        batches
                            .filter((batch) =>
                                batch.batchName
                                    ?.toLowerCase()
                                    .includes(searchQuery.toLowerCase()),
                            )
                            .map((batch) => {
                                const batchSpecialities = getBatchSpecialities(batch.speciality);
                                const specs = therapistSpecialities.filter((s) =>
                                    batchSpecialities.includes(s.id),
                                );
                                return (
                                    <View key={batch._id} style={styles.batchCard}>
                                        <View style={styles.batchCardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.batchName}>{batch.batchName}</Text>
                                                {specs.length > 0 && (
                                                    <View style={styles.specBadgeRow}>
                                                        {specs.map((spec) => (
                                                            <View
                                                                key={spec.id}
                                                                style={[
                                                                    styles.specBadge,
                                                                    { backgroundColor: spec.bg },
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.specBadgeText,
                                                                        { color: spec.color },
                                                                    ]}
                                                                >
                                                                    {spec.label}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.cardActionsRow}>
                                                <TouchableOpacity
                                                    style={styles.iconBtn}
                                                    onPress={() => openEditModal(batch)}
                                                >
                                                    <Feather name="edit-2" size={16} color="#0B4A6F" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.iconBtn}
                                                    onPress={() => handleDelete(batch)}
                                                >
                                                    <Feather name="trash-2" size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View style={styles.batchInfoRow}>
                                            {/* <View style={styles.batchInfoItem}>
                                                <Feather name="calendar" size={14} color="#64748B" />
                                                <Text style={styles.batchInfoText}>
                                                    {MONTHS[(batch.month || 1) - 1]}
                                                </Text>
                                            </View> */}
                                            <View style={styles.batchInfoItem}>
                                                <Feather name="clock" size={14} color="#64748B" />
                                                <Text style={styles.batchInfoText}>
                                                    {batch.dateFrom
                                                        ? batch.dateFrom.substring(0, 10)
                                                        : "-"}
                                                    {" - "}
                                                    {batch.dateTo ? batch.dateTo.substring(0, 10) : "-"}
                                                </Text>
                                            </View>
                                            <View style={styles.batchInfoItem}>
                                                <Feather name="users" size={14} color="#64748B" />
                                                <Text style={styles.batchInfoText}>
                                                    Max {batch.maxChild}
                                                </Text>
                                            </View>
                                        </View>

                                        {batch.therapistIds?.length > 0 && (
                                            <View style={styles.selectedTagsContainer}>
                                                {batch.therapistIds.map((t) => (
                                                    <View key={t._id || t} style={styles.tagBadge}>
                                                        <Text style={styles.tagBadgeText}>
                                                            {t.fullName || "Therapist"}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                    )}
                </ScrollView>
            )}

            <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 90 }]} onPress={openCreateModal}>
                <Feather name="plus" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Create / Edit Batch Modal */}
            <Modal
                visible={isFormModalOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setIsFormModalOpen(false)}
            >
                <View
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsFormModalOpen(false)}
                >
                    <View activeOpacity={1} style={styles.formModalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingBatchId ? "Edit Batch" : "Create Batch"}
                            </Text>
                            <TouchableOpacity onPress={() => setIsFormModalOpen(false)}>
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: 480 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.fieldLabel}>Batch Name</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g. Morning Speech Batch"
                                placeholderTextColor="#94A3B8"
                                value={form.batchName}
                                onChangeText={(text) =>
                                    setForm((p) => ({ ...p, batchName: text }))
                                }
                            />

                            <Text style={styles.fieldLabel}>Speciality</Text>
                            <TouchableOpacity
                                style={styles.dropdownSelector}
                                onPress={() => setIsSpecialityModalOpen(true)}
                            >
                                <Text
                                    style={
                                        form.speciality.length
                                            ? styles.dropdownValueText
                                            : styles.multiSelectPlaceholder
                                    }
                                >
                                    {form.speciality.length
                                        ? `${form.speciality.length} speciality(ies) selected`
                                        : "Select speciality"}
                                </Text>
                                <Feather name="chevron-down" size={18} color="#64748B" />
                            </TouchableOpacity>

                            {form.speciality.length > 0 && (
                                <View style={styles.selectedTagsContainer}>
                                    {form.speciality.map((spec) => (
                                        <View
                                            key={spec.id}
                                            style={[styles.tagBadge, { backgroundColor: spec.bg }]}
                                        >
                                            <Text
                                                style={[styles.tagBadgeText, { color: spec.color }]}
                                            >
                                                {spec.label}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => toggleSpecialitySelection(spec)}
                                            >
                                                <Feather name="x" size={12} color={spec.color} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={{ height: 16 }} />

                            <Text style={styles.fieldLabel}>Date From</Text>
                            <TouchableOpacity
                                style={styles.dropdownSelector}
                                onPress={() => openDateModal("dateFrom")}
                            >
                                <Text
                                    style={
                                        form.dateFrom
                                            ? styles.dropdownValueText
                                            : styles.multiSelectPlaceholder
                                    }
                                >
                                    {form.dateFrom || "Select date"}
                                </Text>
                                <Feather name="calendar" size={18} color="#64748B" />
                            </TouchableOpacity>

                            <View style={{ height: 16 }} />

                            <Text style={styles.fieldLabel}>Date To</Text>
                            <TouchableOpacity
                                style={styles.dropdownSelector}
                                onPress={() => openDateModal("dateTo")}
                            >
                                <Text
                                    style={
                                        form.dateTo
                                            ? styles.dropdownValueText
                                            : styles.multiSelectPlaceholder
                                    }
                                >
                                    {form.dateTo || "Select date"}
                                </Text>
                                <Feather name="calendar" size={18} color="#64748B" />
                            </TouchableOpacity>

                            <View style={{ height: 16 }} />

                            <Text style={styles.fieldLabel}>Max Children</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g. 10"
                                placeholderTextColor="#94A3B8"
                                keyboardType="number-pad"
                                value={form.maxChild}
                                onChangeText={(text) =>
                                    setForm((p) => ({
                                        ...p,
                                        maxChild: text.replace(/[^0-9]/g, ""),
                                    }))
                                }
                            />
                            <Text style={styles.fieldLabel}>Batch Fee</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g. 100"
                                placeholderTextColor="#94A3B8"
                                keyboardType="number-pad"
                                value={form.fee}
                                onChangeText={(text) =>
                                    setForm((p) => ({
                                        ...p,
                                        fee: text.replace(/[^0-9]/g, ""),
                                    }))
                                }
                            />
                        </ScrollView>

                        <View style={styles.bottomActionsRow}>
                            <TouchableOpacity
                                style={styles.saveDraftBtn}
                                onPress={() => setIsFormModalOpen(false)}
                            >
                                <Text style={styles.saveDraftText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.sendBroadcastBtn}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.sendBroadcastText}>
                                        {editingBatchId ? "Update" : "Create"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Speciality Multi-select Modal */}
            <Modal
                visible={isSpecialityModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsSpecialityModalOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsSpecialityModalOpen(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Speciality</Text>
                            <TouchableOpacity onPress={() => setIsSpecialityModalOpen(false)}>
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 320 }}>
                            {therapistSpecialities.map((spec) => {
                                const isSelected = form.speciality.some(
                                    (s) => s.id === spec.id,
                                );
                                return (
                                    <TouchableOpacity
                                        key={spec.id}
                                        style={styles.checkboxRow}
                                        onPress={() => toggleSpecialitySelection(spec)}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                isSelected && styles.checkboxActive,
                                            ]}
                                        >
                                            {isSelected && (
                                                <Feather name="check" size={12} color="#FFF" />
                                            )}
                                        </View>
                                        <Text style={styles.checkboxLabel}>{spec.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={() => setIsSpecialityModalOpen(false)}
                        >
                            <Text style={styles.confirmBtnText}>Done</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Date Picker Modal (shared by Date From / Date To) */}
            <Modal
                visible={isDateModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsDateModalOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsDateModalOpen(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
                        <View style={styles.calendarHeader}>
                            <TouchableOpacity
                                style={styles.calendarNavBtn}
                                onPress={goToPrevMonth}
                            >
                                <Feather name="chevron-left" size={20} color="#0B4A6F" />
                            </TouchableOpacity>

                            <Text style={styles.calendarHeaderText}>
                                {MONTHS[calendarCursor.month]} {calendarCursor.year}
                            </Text>

                            <TouchableOpacity
                                style={styles.calendarNavBtn}
                                onPress={goToNextMonth}
                            >
                                <Feather name="chevron-right" size={20} color="#0B4A6F" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.calendarWeekRow}>
                            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                <Text key={`${d}-${i}`} style={styles.calendarWeekDay}>
                                    {d}
                                </Text>
                            ))}
                        </View>

                        <View style={styles.calendarGrid}>
                            {getCalendarGrid(calendarCursor.year, calendarCursor.month).map(
                                (day, idx) => {
                                    if (day === null) {
                                        return (
                                            <View
                                                key={`empty-${idx}`}
                                                style={styles.calendarDayCell}
                                            />
                                        );
                                    }
                                    const dateStr = formatDate(
                                        calendarCursor.year,
                                        calendarCursor.month,
                                        day,
                                    );
                                    const isSelected = form[dateModalField] === dateStr;
                                    const selectedDate = new Date(
                                        calendarCursor.year,
                                        calendarCursor.month,
                                        day,
                                    );

                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const isPastDate = selectedDate < today;

                                    const isBeforeDateFrom =
                                        dateModalField === "dateTo" &&
                                        form.dateFrom &&
                                        selectedDate < new Date(form.dateFrom + "T00:00:00");
                                    return (
                                        <TouchableOpacity
                                            key={dateStr}
                                            disabled={isPastDate || isBeforeDateFrom}
                                            style={[
                                                styles.calendarDayCell,
                                                isSelected && styles.calendarDayCellSelected,
                                                (isPastDate || isBeforeDateFrom) && styles.calendarDayDisabled,
                                            ]}
                                            onPress={() => handleSelectDate(day)}
                                        >
                                            <Text
                                                style={[
                                                    styles.calendarDayText,
                                                    isSelected && styles.calendarDayTextSelected,
                                                    (isPastDate || isBeforeDateFrom) &&
                                                    styles.calendarDayTextDisabled,
                                                ]}
                                            >
                                                {day}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                },
                            )}
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            <Modal
                visible={isFilterModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsFilterModalOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsFilterModalOpen(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContentCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter by Speciality</Text>

                            <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                                <Feather name="x" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 320 }}>
                            {therapistSpecialities.map((spec) => {
                                const selected = tempSpeciality.includes(spec.id);

                                return (
                                    <TouchableOpacity
                                        key={spec.id}
                                        style={styles.checkboxRow}
                                        onPress={() => {
                                            setTempSpeciality((prev) =>
                                                selected
                                                    ? prev.filter((id) => id !== spec.id)
                                                    : [...prev, spec.id],
                                            );
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.checkbox,
                                                selected && styles.checkboxActive,
                                            ]}
                                        >
                                            {selected && (
                                                <Feather name="check" size={12} color="#FFF" />
                                            )}
                                        </View>

                                        <Text style={styles.checkboxLabel}>{spec.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={() => {
                                setSelectedSpeciality(tempSpeciality);
                                setIsFilterModalOpen(false);
                            }}
                        >
                            <Text style={styles.confirmBtnText}>Apply Filter</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <BottomBar
                activeTab={""}
                setActiveTab={setActiveBottomTab}
                onOpenNotifications={setIsNotificationOpen}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    centerFill: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        gap: 6,
    },
    emptyStateText: {
        fontSize: 15,
        fontFamily: fonts.semiBold,
        color: "#334155",
        marginTop: 8,
    },
    emptyStateSubText: {
        fontSize: 12,
        fontFamily: fonts.regular,
        color: "#94A3B8",
    },

    batchCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    batchCardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    batchName: {
        fontSize: 16,
        fontFamily: fonts.semiBold,
        color: "#0F172A",
        marginBottom: 6,
    },
    specBadgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    specBadge: {
        alignSelf: "flex-start",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    specBadgeText: {
        fontSize: 11,
        fontFamily: fonts.semiBold,
    },
    cardActionsRow: {
        flexDirection: "row",
        gap: 8,
    },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },

    batchInfoRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 14,
        marginBottom: 4,
    },
    batchInfoItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    batchInfoText: {
        fontSize: 12,
        fontFamily: fonts.regular,
        color: "#64748B",
    },

    fab: {
        position: "absolute",
        right: 20,
        bottom: 100,
        width: 56,
        height: 56,
        borderRadius: 15,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },

    fieldLabel: {
        fontSize: 12,
        fontFamily: fonts.regular,
        color: colors.blackFont,
        letterSpacing: 0.5,
        marginBottom: 5,
        lineHeight: 20,
    },

    dropdownSelector: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
    },
    dropdownValueText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#0B4A6F",
    },
    multiSelectPlaceholder: {
        fontSize: 14,
        color: "#94A3B8",
        fontWeight: "500",
    },
    selectedTagsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
    },
    tagBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E0F2FE",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 6,
    },
    tagBadgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#0B4A6F",
    },

    formInput: {
        backgroundColor: "#F1F5F9",
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        fontSize: 16,
        color: colors.blackFont,
        marginBottom: 16,
        fontFamily: fonts.regular,
    },

    bottomActionsRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
    },
    saveDraftBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    saveDraftText: {
        fontSize: 16,
        fontFamily: fonts.semiBold,
        color: colors.primary,
        lineHeight: 24,
    },
    sendBroadcastBtn: {
        flex: 1.3,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    sendBroadcastText: {
        fontSize: 16,
        fontFamily: fonts.semiBold,
        color: "#FFFFFF",
        lineHeight: 24,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContentCard: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        elevation: 5,
    },
    formModalCard: {
        width: "100%",
        maxHeight: "90%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 12,
    },
    modalOptionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    modalOptionSelected: {
        backgroundColor: "#F0F9FF",
    },
    modalOptionText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#334155",
    },
    modalOptionTextSelected: {
        color: "#0B4A6F",
        fontWeight: "700",
    },
    checkboxActive: {
        backgroundColor: "#0B4A6F",
        borderColor: "#0B4A6F",
    },
    checkboxLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#334155",
    },
    confirmBtn: {
        backgroundColor: "#0B4A6F",
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 16,
    },
    confirmBtnText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 14,
    },

    calendarHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    calendarNavBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
        alignItems: "center",
        justifyContent: "center",
    },
    calendarHeaderText: {
        fontSize: 15,
        fontFamily: fonts.semiBold,
        color: "#0F172A",
    },
    calendarWeekRow: {
        flexDirection: "row",
        marginBottom: 6,
    },
    calendarWeekDay: {
        flex: 1,
        textAlign: "center",
        fontSize: 12,
        fontFamily: fonts.semiBold,
        color: "#94A3B8",
    },
    calendarGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    calendarDayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    calendarDayCellSelected: {
        backgroundColor: "#0B4A6F",
        borderRadius: 999,
    },
    calendarDayText: {
        fontSize: 14,
        fontFamily: fonts.regular,
        color: "#334155",
    },
    calendarDayTextSelected: {
        color: "#FFFFFF",
        fontFamily: fonts.semiBold,
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
        paddingHorizontal: 16,
    },

    searchInputContainerMain: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#CBD5E1",
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
    },

    searchIcon: {
        marginRight: 10,
    },

    searchInput: {
        flex: 1,
        fontSize: 15,
        color: "#0F172A",
    },

    filterIconButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },

    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
    },

    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#CBD5E1",
        marginRight: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    disabledSelector: {
        opacity: 0.5,
    },
    calendarDayDisabled: {
        opacity: 0.35,
    },

    calendarDayTextDisabled: {
        color: "#CBD5E1",
    },
});
