import React, { useState,useEffect } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';
import { therapistUsers } from '../../api/admin/api';
import { specialities } from '../../utils/specialities';

const initialCategories = [
  { id: "Speech", label: "Speech", color: "#C2410C", bg: "#FFEDD5" },
  { id: "Occupational", label: "Occupational", color: "#065F46", bg: "#6EE7B7" },
  { id: "Behavior", label: "Behavior", color: "#991B1B", bg: "#FCA5A5" },
  { id: "Physical", label: "Physical", color: "#854D0E", bg: "#FDE047" },
];

const PALETTE_COLORS = [
  "#E6F4EA",
  "#059669",
  "#FFEDD5",
  "#C2410C",
  "#FCA5A5",
  "#991B1B",
  "#FDE047",
  "#854D0E",
  "#0B4A6F",
  "#3B82F6",
  "#DB2777",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#64748B",
  "#000000",
];

const initialTherapists = [
  {
    id: "1",
    name: "Dr. Sarah Chen",
    specialty: "Speech",
    category: "Speech",
    avatar: "https://i.pravatar.cc/150?img=47",
    specialtyBg: "#E6F4EA",
    specialtyColor: "#059669",
    currentLoad: 12,
    maxLoad: 15,
    email: "sarah.chen@example.com",
    phone: "+1 555-0192",
    address: "123 Medical Plaza",
    schedule: "Mon-Fri (9AM-5PM)",
  },
  {
    id: "2",
    name: "Marcus Thorne",
    specialty: "Occupational",
    category: "Occupational",
    avatar: "https://i.pravatar.cc/150?img=60",
    specialtyBg: "#FFF7ED",
    specialtyColor: "#C2410C",
    currentLoad: 14,
    maxLoad: 15,
    email: "marcus.t@example.com",
    phone: "+1 555-0193",
    address: "456 Health St",
    schedule: "Tue-Sat (8AM-4PM)",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    specialty: "Behavior",
    category: "Behavior",
    avatar: "https://i.pravatar.cc/150?img=32",
    specialtyBg: "#E6F4EA",
    specialtyColor: "#059669",
    currentLoad: 8,
    maxLoad: 15,
    email: "elena.r@example.com",
    phone: "+1 555-0194",
    address: "789 Care Ave",
    schedule: "Mon-Thu (10AM-6PM)",
  },
  {
    id: "4",
    name: "James Wilson",
    specialty: "Physical",
    category: "Physical",
    avatar: "https://i.pravatar.cc/150?img=13",
    specialtyBg: "#FFF7ED",
    specialtyColor: "#C2410C",
    currentLoad: 11,
    maxLoad: 15,
    email: "james.w@example.com",
    phone: "+1 555-0195",
    address: "321 Wellness Blvd",
    schedule: "Mon-Fri (8AM-4PM)",
  },
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function TherapistsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // const [therapists, setTherapists] = useState(initialTherapists);
  const [therapists, setTherapists] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecilites, setSelectedSpecilites] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [activeBottomTab, setActiveBottomTab] = useState("Therapists");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const [selectedDays, setSelectedDays] = useState(["Mon", "Fri"]);
  const [startTime, setStartTime] = useState("09:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");

  const [newTherapist, setNewTherapist] = useState({
    name: "",
    specialty: "",
    specialtyBg: "#E6F4EA",
    specialtyColor: "#059669",
    schedule: "",
    email: "",
    phone: "",
    address: "",
  });

  const handleFilterClick = (catId) => {
    setSelectedFilter(catId);
  };

  const handleDeleteTherapist = (id) => {
    setTherapists((prev) => prev.filter((item) => item.id !== id));
    setActiveMenuId(null);
  };

  const toggleDaySelection = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const applyScheduleFromCalendar = () => {
    const dayStr = selectedDays.length > 0 ? selectedDays.join(", ") : "Mon-Fri";
    const formattedSchedule = `${dayStr} (${startTime} - ${endTime})`;
    setNewTherapist({ ...newTherapist, schedule: formattedSchedule });
    setIsCalendarModalOpen(false);
  };

  const handleCreateTherapist = () => {
    if (!newTherapist.name || !newTherapist.specialty) return;

    const createdItem = {
      id: Date.now().toString(),
      name: newTherapist.name,
      specialty: newTherapist.specialty,
      category: newTherapist.specialty,
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 50)}`,
      specialtyBg: newTherapist.specialtyBg || "#E6F4EA",
      specialtyColor: newTherapist.specialtyColor || "#059669",
      currentLoad: 0,
      maxLoad: 15,
      email: newTherapist.email,
      phone: newTherapist.phone,
      address: newTherapist.address,
      schedule: newTherapist.schedule || "Mon-Fri (9AM-5PM)",
    };

    setTherapists((prev) => [createdItem, ...prev]);
    setIsAddModalOpen(false);
    setNewTherapist({
      name: "",
      specialty: "",
      specialtyBg: "#E6F4EA",
      specialtyColor: "#059669",
      schedule: "",
      email: "",
      phone: "",
      address: "",
    });
  };

  const filteredTherapists = therapists.filter((item) => {
    const matchesCategory = selectedFilter === "All" || item.category === selectedFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
      || item.specialty.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });
  const fetchTherapistData = async () => {
    try {
      const response = await therapistUsers();
      const therapistsData = response?.data || [];
      setSelectedSpecilites(response?.specialties || []);

      const formattedTherapists = therapistsData.map((therapist) => {
        const therapistSpecialties = (therapist.specialties || []).map((specId) => {
          const matched = specialities.find((item) => item.id === specId);
          return {
            id: specId,
            label: matched?.label || specId,
            bg: matched?.bg || "#E6F4EA",
            color: matched?.color || "#059669",
          };
        });

        return {
          id: therapist._id,
          name: therapist.fullName,
          specialties: therapistSpecialties,
          avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 50)}`,
          currentLoad: therapist.assignedChildren || 0,
          maxLoad: therapist.maxChildren || 0,
          email: therapist.email || "",
          phone: therapist.phone || "",
          address: "",
          schedule: "",
        };
      });

      setTherapists(formattedTherapists);
    } catch (error) {
      console.log("Failed to fetch therapists:", error);
    }
  };

  useEffect(() => {
    fetchTherapistData();
  }, []);
  

  return (
    <SafeAreaView style={[styles.mainContainer, { paddingTop: insets.top }]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Manage Therapist"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerTitleContainer}>
          <Text style={styles.pageTitle}>Manage Therapists</Text>
          <Text style={styles.pageSubTitle}>
            Oversee your Therapist team and balance their caseloads.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search therapists..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={() => setIsFilterModalOpen(true)}
          >
            <Feather name="sliders" size={20} color="#0B4A6F" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabWrap}>
          {selectedSpecilites.map((cat) => {
            const isActive = selectedFilter === cat;
            const specility = specialities.find((item)=> item.id === cat);
            return (
              <View
                key={specility.id}
                style={[
                  styles.tabChip,
                  { backgroundColor: specility.bg },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    { color: specility.color },
                  ]}
                >
                  {specility.label}
                </Text>
              </View>
            );
          })}
        </View>

        {therapists.map((therapist) => {
          const loadPercentage = `${(therapist.currentLoad / therapist.maxLoad) * 100}%`;
          const isMenuOpen = activeMenuId === therapist.id;

          return (
            <View key={therapist.id} style={styles.therapistCard}>
              <View style={styles.cardHeaderRow}>
                <Image
                  source={{ uri: therapist.avatar }}
                  style={styles.therapistAvatar}
                />
                <View style={styles.therapistInfo}>
                  <Text style={styles.therapistName}>{therapist.name}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {therapist.specialties && therapist.specialties.length > 0 ? (
                      therapist.specialties.map((spec) => (
                        <View
                          key={spec.id}
                          style={[
                            styles.specialtyBadge,
                            { backgroundColor: spec.bg },
                          ]}
                        >
                          <Text style={[styles.specialtyText, { color: spec.color }]}>
                            {spec.label}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={[styles.specialtyBadge, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.specialtyText, { color: '#64748B' }]}>N/A</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ position: "relative" }}>
                  <TouchableOpacity
                    style={styles.moreOptionsButton}
                    onPress={() => setActiveMenuId(isMenuOpen ? null : therapist.id)}
                  >
                    <Feather name="more-vertical" size={20} color="#94A3B8" />
                  </TouchableOpacity>

                  {isMenuOpen && (
                    <View style={styles.dropdownMenu}>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => setActiveMenuId(null)}
                      >
                        <Feather name="edit-2" size={15} color="#334155" />
                        <Text style={styles.menuItemText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.menuItem, styles.deleteMenuItem]}
                        onPress={() => handleDeleteTherapist(therapist.id)}
                      >
                        <Feather name="trash-2" size={15} color="#EF4444" />
                        <Text style={[styles.menuItemText, styles.deleteText]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.loadRow}>
                <Text style={styles.loadLabel}>Current Load</Text>
                <Text style={styles.loadValue}>
                  {therapist.currentLoad}/{therapist.maxLoad} <Text style={styles.loadSubText}>Childs</Text>
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={[colors.primary, "#87CEEB"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBar, { width: loadPercentage }]}
                />
              </View>

              <View style={styles.cardActionsRow}>
                <TouchableOpacity style={styles.scheduleButton}>
                  <Text style={styles.scheduleButtonText}>View Schedule</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mailButton}>
                  <Feather name="mail" size={20} color="#0B4A6F" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addTherapistButton}
          onPress={() => setIsAddModalOpen(true)}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addTherapistText}>Add New Therapist</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isFilterModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Specialty</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterModalWrap}>
              {/* "All" Option */}
              <TouchableOpacity
                style={[
                  styles.filterModalChip,
                  { backgroundColor: "#0B4A6F" },
                  selectedFilter === "All" && styles.activeModalChip,
                ]}
                onPress={() => {
                  setSelectedFilter("All");
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.filterModalChipTextAll}>All Types</Text>
              </TouchableOpacity>

              {/* Other Specialty Categories */}
              {specialities.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterModalChip,
                    { backgroundColor: cat.bg },
                    selectedFilter === cat.id && styles.activeModalChip,
                  ]}
                  onPress={() => {
                    setSelectedFilter(cat.id);
                    setIsFilterModalOpen(false);
                  }}
                >
                  <Text style={[styles.filterChipText, { color: cat.color }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Therapist</Text>
                <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                  <Feather name="x" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Name */}
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Dr. Sarah Chen"
                placeholderTextColor="#94A3B8"
                value={newTherapist.name}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, name: t })}
              />

              {/* Type / Specialty */}
              <Text style={styles.fieldLabel}>Type / Specialty</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Speech / Occupational / Behavior"
                placeholderTextColor="#94A3B8"
                value={newTherapist.specialty}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, specialty: t })}
              />

              {/* Color Picker: Specialty Badge Background */}
              <Text style={styles.fieldLabel}>Select Badge Background Color</Text>
              <View style={styles.colorPaletteGrid}>
                {PALETTE_COLORS.map((colorHex) => {
                  const isSelected = newTherapist.specialtyBg === colorHex;
                  return (
                    <TouchableOpacity
                      key={`bg-${colorHex}`}
                      style={[
                        styles.colorPaletteSwatch,
                        { backgroundColor: colorHex },
                        isSelected && styles.activeColorSwatch,
                      ]}
                      onPress={() => setNewTherapist({ ...newTherapist, specialtyBg: colorHex })}
                    >
                      {isSelected && (
                        <Feather
                          name="check"
                          size={16}
                          color={colorHex === "#000000" || colorHex === "#0B4A6F" ? "#FFF" : "#000"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Schedule Field - Opens Calendar Modal */}
              <Text style={styles.fieldLabel}>Schedule</Text>
              <TouchableOpacity
                style={styles.calendarInputContainer}
                onPress={() => setIsCalendarModalOpen(true)}
              >
                <Text
                  style={[
                    styles.calendarInputText,
                    !newTherapist.schedule && { color: "#94A3B8" },
                  ]}
                >
                  {newTherapist.schedule || "Tap to select working schedule..."}
                </Text>
                <Feather name="calendar" size={20} color="#0B4A6F" />
              </TouchableOpacity>

              {/* Email */}
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.formInput}
                placeholder="therapist@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                value={newTherapist.email}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, email: t })}
              />

              {/* Phone */}
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+1 555-0000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newTherapist.phone}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, phone: t })}
              />

              {/* Address */}
              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Clinic Address"
                placeholderTextColor="#94A3B8"
                value={newTherapist.address}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, address: t })}
              />

              <TouchableOpacity
                style={styles.saveTherapistButton}
                onPress={handleCreateTherapist}
              >
                <Text style={styles.saveTherapistText}>Save Therapist</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isCalendarModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsCalendarModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCalendarModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Schedule</Text>
              <TouchableOpacity onPress={() => setIsCalendarModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Working Days</Text>
            <View style={styles.daySelectorRow}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayChip,
                      isSelected && styles.dayChipSelected,
                    ]}
                    onPress={() => toggleDaySelection(day)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        isSelected && styles.dayChipTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start Time</Text>
                <TextInput
                  style={styles.formInput}
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End Time</Text>
                <TextInput
                  style={styles.formInput}
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyScheduleBtn}
              onPress={applyScheduleFromCalendar}
            >
              <Text style={styles.applyScheduleBtnText}>Confirm Schedule</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <BottomBar
        activeTab={"Therapist"}
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
  },
  headerTitleContainer: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#181C1E",
    marginBottom: 6,
    lineHeight: 36,
  },
  pageSubTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 20,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  searchInputContainer: {
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

  tabWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 24,
  },
  filterChip: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tabChip: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 24,
  },
  tabChipText: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  filterChipText: {
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  activeChipText: {
    color: "#0B4A6F",
  },
  activeChipShadow: {
    borderWidth: 0,
    borderColor: "#0B4A6F",
  },

  therapistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  therapistAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 14,
  },
  therapistInfo: {
    flex: 1,
    alignItems: "flex-start",
  },
  therapistName: {
    fontSize: 22,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    lineHeight: 26,
    marginBottom: 5,
  },
  specialtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 12,
    fontWeight: "600",
  },
  moreOptionsButton: {
    padding: 6,
  },

  dropdownMenu: {
    position: "absolute",
    right: 0,
    top: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 6,
    width: 110,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 999,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteMenuItem: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  deleteText: {
    color: "#EF4444",
  },

  loadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  loadLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  loadValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B4A6F",
  },
  loadSubText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B4A6F",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 18,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#0B4A6F",
    borderRadius: 4,
  },

  cardActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  scheduleButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
  },
  mailButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  addTherapistButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 10,
    alignSelf: "center",
    elevation: 4,
    shadowColor: "#0B4A6F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    gap: 6,
  },
  addTherapistText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  filterModalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 20,
  },
  filterModalChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  filterModalChipTextAll: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  activeModalChip: {
    borderWidth: 2,
    borderColor: "#0F172A",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    marginTop: 14,
  },
  formInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: "#0F172A",
  },

  colorPaletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 4,
  },
  colorPaletteSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  activeColorSwatch: {
    borderWidth: 3,
    borderColor: "#0B4A6F",
  },

  calendarInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  calendarInputText: {
    fontSize: 14,
    color: "#0F172A",
  },
  saveTherapistButton: {
    backgroundColor: "#0B4A6F",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  saveTherapistText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  calendarModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    alignSelf: "center",
    width: "90%",
    marginBottom: "auto",
    marginTop: "auto",
  },
  daySelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipSelected: {
    backgroundColor: "#0B4A6F",
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  dayChipTextSelected: {
    color: "#FFFFFF",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  applyScheduleBtn: {
    backgroundColor: "#0B4A6F",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  applyScheduleBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
