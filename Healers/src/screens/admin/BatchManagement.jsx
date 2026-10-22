import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import {
  createBatch,
  deleteBatch,
  getBatches,
  getServices,
  updateBatch,
} from '../../api/admin/api';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

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
const getBatchSpecialities = (speciality) => Array.isArray(speciality) ? speciality : speciality ? [speciality] : [];
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
  const [services, setServices] = useState([]);

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
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [isSpecialityModalOpen, setIsSpecialityModalOpen] = useState(false);
  useEffect(() => {
    const servicesData = async () => {
      try {
        const res = await getServices({ search: "" });

        const activeServices = res.data.filter(
          (service) => service.isActive === true,
        );

        setServices(activeServices);
      } catch (error) {
        console.log(error);
      }
    };

    servicesData();
  }, []);
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
  }, [selectedSpeciality]);
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchBatches();
    });

    return unsubscribe;
  }, [navigation]);

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
      speciality: services.filter((s) => batchSpecialities.includes(s.id)),
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
    // if (!form.fee || parseInt(form.fee, 10) <= 0) {
    //   Alert.alert("Missing info", "Please enter a valid batch fee.");
    //   return false;
    // }
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
  const formatDate = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

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
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const previousMonth = new Date(prev.year, prev.month - 1, 1);

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
      const nextMonth = new Date(prev.year, prev.month + 1, 1);

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
    const dateStr = formatDate(calendarCursor.year, calendarCursor.month, day);

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
      dateModalField === "dateTo"
      && form.dateFrom
      && selectedDate < new Date(form.dateFrom + "T00:00:00")
    ) {
      Alert.alert("Invalid date", "Date To cannot be before Date From.");
      return;
    }

    setForm((p) => ({
      ...p,
      [dateModalField]: dateStr,
    }));

    setIsDateModalOpen(false);
  };

  return (
    <View style={[commonStyles.container, { paddingTop: hp(20) }]}>
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
          <Feather name="sliders" size={fontSize(20)} color="#0B4A6F" />
        </TouchableOpacity>
      </View>
      {loading
        ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )
        : (
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
            {batches.length === 0
              ? (
                <View style={styles.emptyState}>
                  <Feather name="layers" size={32} color="#94A3B8" />
                  <Text style={styles.emptyStateText}>No batches yet</Text>
                  <Text style={styles.emptyStateSubText}>
                    Tap the + button to create your first batch.
                  </Text>
                </View>
              )
              : (
                batches
                  .filter((batch) =>
                    batch.batchName
                      ?.toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map((batch) => {
                    const batchSpecialities = getBatchSpecialities(
                      batch.speciality,
                    );
                    const specs = services.filter((s) => batchSpecialities.includes(s.id));
                    return (
                      <TouchableOpacity
                        key={batch._id}
                        style={styles.batchCard}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedBatch(batch);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <View style={styles.batchCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.batchName}>{batch.batchName}</Text>
                          </View>
                          <View style={styles.cardActionsRow}>
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => openEditModal(batch)}
                            >
                              <Feather name="edit-2" size={fontSize(16)} color="#0B4A6F" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => handleDelete(batch)}
                            >
                              <Feather name="trash-2" size={fontSize(16)} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View>
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

                        <View style={styles.batchInfoRow}>
                          {
                            /* <View style={styles.batchInfoItem}>
                                                <Feather name="calendar" size={14} color="#64748B" />
                                                <Text style={styles.batchInfoText}>
                                                    {MONTHS[(batch.month || 1) - 1]}
                                                </Text>
                                            </View> */
                          }
                          <View style={styles.batchInfoItem}>
                            <Feather name="clock" size={fontSize(14)} color="#64748B" />
                            <Text style={styles.batchInfoText}>
                              {batch.dateFrom
                                ? batch.dateFrom.substring(0, 10)
                                : "-"}
                              {" - "}
                              {batch.dateTo ? batch.dateTo.substring(0, 10) : "-"}
                            </Text>
                          </View>
                          <View style={styles.batchInfoItem}>
                            <Feather name="users" size={fontSize(14)} color="#64748B" />
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
                      </TouchableOpacity>
                    );
                  })
              )}
          </ScrollView>
        )}

      <TouchableOpacity
        style={[styles.fab]}
        onPress={openCreateModal}
      >
        <Feather name="plus" size={fontSize(26)} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create / Edit Batch Modal */}
      <Modal
        visible={isFormModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFormModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={{ flex: 1 }}
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
                  onChangeText={(text) => setForm((p) => ({ ...p, batchName: text }))}
                />

                <Text style={styles.fieldLabel}>Speciality</Text>
                <TouchableOpacity
                  style={styles.dropdownSelector}
                  onPress={() => setIsSpecialityModalOpen(true)}
                >
                  <Text
                    style={form.speciality.length
                      ? styles.dropdownValueText
                      : styles.multiSelectPlaceholder}
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
                    style={form.dateFrom
                      ? styles.dropdownValueText
                      : styles.multiSelectPlaceholder}
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
                    style={form.dateTo
                      ? styles.dropdownValueText
                      : styles.multiSelectPlaceholder}
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
                    }))}
                />
                {
                  /* <Text style={styles.fieldLabel}>Batch Fee</Text>
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
                /> */
                }
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
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                    <Text style={styles.sendBroadcastText}>
                      {editingBatchId ? "Update" : "Create"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
              {services.map((spec) => {
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
                      {isSelected && <Feather name="check" size={12} color="#FFF" />}
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

                  const isBeforeDateFrom = dateModalField === "dateTo"
                    && form.dateFrom
                    && selectedDate < new Date(form.dateFrom + "T00:00:00");
                  return (
                    <TouchableOpacity
                      key={dateStr}
                      disabled={isPastDate || isBeforeDateFrom}
                      style={[
                        styles.calendarDayCell,
                        isSelected && styles.calendarDayCellSelected,
                        (isPastDate || isBeforeDateFrom)
                        && styles.calendarDayDisabled,
                      ]}
                      onPress={() => handleSelectDate(day)}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                          (isPastDate || isBeforeDateFrom)
                          && styles.calendarDayTextDisabled,
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
              {services.map((spec) => {
                const selected = tempSpeciality.includes(spec.id);

                return (
                  <TouchableOpacity
                    key={spec.id}
                    style={styles.checkboxRow}
                    onPress={() => {
                      setTempSpeciality((prev) =>
                        selected
                          ? prev.filter((id) => id !== spec.id)
                          : [...prev, spec.id]
                      );
                    }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.checkboxActive,
                      ]}
                    >
                      {selected && <Feather name="check" size={12} color="#FFF" />}
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
      <Modal
        visible={isDetailModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDetailModalOpen(false)}
      >
        <View
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setIsDetailModalOpen(false)}
        >
          <View
            activeOpacity={1}
            style={[styles.bottomSheetContainer, { paddingBottom: insets.bottom + 10 }]}
          >
            {/* Top Drag Indicator Line */}
            <View style={styles.dragHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Batch Details</Text>
              <TouchableOpacity onPress={() => setIsDetailModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedBatch && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 420 }}
              >
                <Text style={styles.detailBatchTitle}>
                  {selectedBatch.batchName}
                </Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Fee</Text>
                  <Text style={styles.detailValue}>
                    {selectedBatch.fee || "0"} PKR
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Max Capacity</Text>
                  <Text style={styles.detailValue}>
                    {selectedBatch.maxChild || "0"} Children
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>
                    {selectedBatch.dateFrom
                      ? selectedBatch.dateFrom.substring(0, 10)
                      : "-"} to {selectedBatch.dateTo
                      ? selectedBatch.dateTo.substring(0, 10)
                      : "-"}
                  </Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Children</Text>
                  <Text style={styles.detailValue}>
                    {selectedBatch.childrenIds?.length || 0} / {selectedBatch.maxChild || 0}
                  </Text>
                </View>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Speciality</Text>
                  <View style={styles.selectedTagsContainer}>
                    {services
                      .filter((s) =>
                        getBatchSpecialities(selectedBatch.speciality).includes(
                          s.id,
                        )
                      )
                      .map((spec) => (
                        <View
                          key={spec.id}
                          style={[
                            styles.tagBadge,
                            { backgroundColor: spec.bg },
                          ]}
                        >
                          <Text
                            style={[styles.tagBadgeText, { color: spec.color }]}
                          >
                            {spec.label}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Assigned Therapists</Text>
                  {selectedBatch.therapistIds?.length > 0
                    ? (
                      <View style={styles.selectedTagsContainer}>
                        {selectedBatch.therapistIds.map((t) => (
                          <View key={t._id || t} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>
                              {t.fullName || "Therapist"}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )
                    : (
                      <Text style={styles.detailValueSub}>
                        No therapist assigned yet.
                      </Text>
                    )}
                </View>
              </ScrollView>
            )}

            <View style={styles.detailActionsRow}>
              <TouchableOpacity
                style={[
                  styles.addChildrenBtn,
                  selectedBatch?.childrenIds?.length >= selectedBatch?.maxChild && { opacity: 0.5 },
                ]}
                onPress={() => {
                  const count = selectedBatch?.childrenIds?.length || 0;

                  if (count >= selectedBatch?.maxChild) {
                    Alert.alert("Batch full", `This batch already has ${count} of ${selectedBatch.maxChild} children.`);
                    return;
                  }

                  setIsDetailModalOpen(false);
                  navigation.navigate("BatchSchedule", {
                    batchId: selectedBatch?._id,
                    openAddChildren: true,
                  });
                }}
              >
                <Feather
                  name="user-plus"
                  size={fontSize(16)}
                  color="#FFFFFF"
                  style={{ marginRight: wp(6) }}
                />
                <Text style={styles.addChildrenBtnText}>Add Children</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scheduleBtn}
                onPress={() => {
                  setIsDetailModalOpen(false);
                  navigation.navigate("BatchSchedule", {
                    batchId: selectedBatch?._id,
                  });
                }}
              >
                <Feather
                  name={"calendar"}
                  size={fontSize(16)}
                  color="#0B4A6F"
                  style={{ marginRight: wp(6) }}
                />
                <Text style={styles.scheduleBtnText}>View Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: hp(20),
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
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#334155",
    marginTop: 8,
  },
  emptyStateSubText: {
    fontSize: fontSize(12),
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
    marginBottom: hp(10),
    gap: wp(10),
  },
  batchName: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginBottom: 6,
  },
  specBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: hp(20),
  },
  specBadge: {
    alignSelf: "flex-start",
    borderRadius: wp(20),
    paddingHorizontal: wp(8),
    paddingVertical: hp(3),
  },
  specBadgeText: {
    fontSize: fontSize(10),
    fontFamily: fonts.semiBold,
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: wp(32),
    height: hp(32),
    borderRadius: wp(10),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  batchInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp(10),
    justifyContent: "space-between",
    marginBottom: hp(10),
  },
  batchInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  batchInfoText: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    lineHeight: 18,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
    width: wp(56),
    height: hp(56),
    borderRadius: wp(15),
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
    fontSize: fontSize(12),
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
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(54),
  },
  dropdownValueText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0B4A6F",
  },
  multiSelectPlaceholder: {
    fontSize: fontSize(14),
    color: "#94A3B8",
    fontFamily: fonts.medium,
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
    borderRadius: wp(20),
    paddingHorizontal: wp(10),
    paddingVertical: hp(3),
    gap: 6,
  },
  tagBadgeText: {
    fontSize: fontSize(12),
    fontFamily: fonts.medium,
    color: "#0B4A6F",
    lineHeight:18
  },

  formInput: {
    backgroundColor: "#F1F5F9",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(54),
    fontSize: fontSize(14),
    color: colors.blackFont,
    marginBottom: 16,
    fontFamily: fonts.medium,
  },

  bottomActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  saveDraftBtn: {
    flex: 1,
    height: hp(48),
    borderRadius: wp(12),
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveDraftText: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 24,
  },
  sendBroadcastBtn: {
    flex: 1.3,
    height: hp(48),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBroadcastText: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
    lineHeight: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: wp(20),
  },
  modalContentCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(20),
    padding: wp(20),
    elevation: 5,
  },
  formModalCard: {
    width: "100%",
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(20),
    padding: wp(20),
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(20),
  },
  modalTitle: {
    fontSize: fontSize(18),
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 26,
  },
  modalOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: hp(12),
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: "#F0F9FF",
  },
  modalOptionText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#334155",
    lineHeight: 24,
  },
  modalOptionTextSelected: {
    color: "#0B4A6F",
    fontFamily: fonts.semiBold,
  },
  checkboxActive: {
    backgroundColor: "#0B4A6F",
    borderColor: "#0B4A6F",
  },
  checkboxLabel: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#334155",
    lineHeight: 24,
  },
  confirmBtn: {
    backgroundColor: "#0B4A6F",
    borderRadius: wp(12),
    paddingVertical: wp(12),
    alignItems: "center",
    marginTop: 16,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    lineHeight: 24,
  },

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  calendarNavBtn: {
    width: wp(32),
    height: hp(32),
    borderRadius: wp(10),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarHeaderText: {
    fontSize: fontSize(14),
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
    fontSize: fontSize(12),
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
    fontSize: fontSize(14),
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
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: hp(56),
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: fontSize(14),
    color: "#0F172A",
    fontFamily: fonts.medium,
  },

  filterIconButton: {
    width: wp(56),
    height: hp(56),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: hp(10),
  },

  checkbox: {
    width: wp(20),
    height: hp(20),
    borderRadius: wp(6),
    borderWidth: 2,
    borderColor: "#CBD5E1",
    marginRight: wp(12),
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
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: wp(24),
    borderTopRightRadius: wp(24),
    paddingHorizontal: wp(20),
    paddingTop: hp(12),
    paddingBottom: hp(28),
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  dragHandle: {
    width: wp(40),
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  detailBatchTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 14,
  },
  detailLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  detailValue: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  detailValueSub: {
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  detailActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: hp(16),
    paddingTop: hp(12),
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  addChildrenBtn: {
    flex: 1,
    height: hp(46),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  addChildrenBtnText: {
    fontSize: fontSize(14),
    fontFamily: fonts.medium,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  scheduleBtn: {
    flex: 1,
    height: hp(46),
    borderRadius: wp(12),
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleBtnText: {
    fontSize: fontSize(14),
    fontFamily: fonts.medium,
    color: colors.primary,
    lineHeight: 18,
  },
});
