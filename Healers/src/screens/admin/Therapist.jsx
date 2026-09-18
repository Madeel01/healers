import React, {
  useEffect,
  useState,
} from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  assignChildrenToTherapist,
  createTherapist,
  deleteTherapist,
  getUsersByRole,
  therapistUsers,
  updateTherapist,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';
import { therapistSpecialities } from '../../utils/specialities';
const AVATAR_COLORS = [
  "#0B4A6F", "#7C3AED", "#DC2626", "#059669",
  "#D97706", "#DB2777", "#2563EB", "#0891B2",
  "#65A30D", "#9333EA", "#EA580C", "#0D9488",
];
const getAvatarColor = (str = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};
export default function TherapistsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [therapists, setTherapists] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [activeBottomTab, setActiveBottomTab] = useState("Therapists");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedSpecilites, setSelectedSpecilites] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touchedChildIds, setTouchedChildIds] = useState([]);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [selectedDays, setSelectedDays] = useState(["Mon", "Fri"]);

  const [newTherapist, setNewTherapist] = useState({});
  const [editingTherapistId, setEditingTherapistId] = useState(null); 
  

  // ---- Assign Child modal state ----
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStep, setAssignStep] = useState(1);
  const [assignTherapistSearch, setAssignTherapistSearch] = useState("");
  const [assignChildSearch, setAssignChildSearch] = useState("");
  const [assignTherapistResults, setAssignTherapistResults] = useState([]);
  const [assignChildResults, setAssignChildResults] = useState([]);
  const [selectedAssignTherapist, setSelectedAssignTherapist] = useState(null);
  const [selectedChildIds, setSelectedChildIds] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [originalAssignedIds, setOriginalAssignedIds] = useState([]);

  const isEditMode = editingTherapistId !== null;

  const resetTherapistForm = () => {
    setNewTherapist({});
    setEditingTherapistId(null);
    setPassword("");
    setConfirmPassword("");
  };

  const openAddModal = () => {
    resetTherapistForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (therapist) => {
    setEditingTherapistId(therapist.id);
    setNewTherapist({
      name: therapist.name || "",
      specialty: therapist.specialties?.[0]?.id || therapist.specialty || "",
      maxChildren: String(therapist.maxLoad || 0),
      specialtyBg: therapist.specialties?.[0]?.bg || "",
      specialtyColor: therapist.specialties?.[0]?.color || "",
      schedule: therapist.schedule || "",
      email: therapist.email || "",
      phone: therapist.phone || "",
      address: therapist.address || "",
    });
    setActiveMenuId(null);
    setIsAddModalOpen(true);
  };

  const handleDeleteTherapist = (therapist) => {
    setActiveMenuId(null);
    Alert.alert(
      "Delete Therapist",
      `Remove ${therapist.name} from your team? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const previous = therapists;
            setTherapists((prev) => prev.filter((item) => item.id !== therapist.id));
            try {
              await deleteTherapist(therapist.id);
              fetchTherapistData();
            } catch (error) {
              console.log("Failed to delete therapist:", error);
              setTherapists(previous);
              Alert.alert("Error", "Could not delete this therapist. Please try again.");
            }
          },
        },
      ]
    );
  };

  const toggleDaySelection = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSaveTherapist = async () => {
    if (!newTherapist.name || !newTherapist.email || !newTherapist.phone || saving) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return;
    }

    if (!isEditMode) {
      if (!password || !confirmPassword) {
        Alert.alert("Error", "Please enter and confirm your password.");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Error", "Password and Confirm Password do not match.");
        return;
      }
    }

    setSaving(true);

    const matchedSpecialty = therapistSpecialities.find(
      (item) => item.id === newTherapist.specialty
    );

    const payload = {
      name: newTherapist.name,
      specialty: newTherapist.specialty,
      maxChildren: parseInt(newTherapist.maxChildren, 10) || 5,
      email: newTherapist.email,
      phone: newTherapist.phone,
      address: newTherapist.address,
      ...(!isEditMode && { password }),
    };

    try {
      if (isEditMode) {
        const response = await updateTherapist(editingTherapistId, payload);
        const updated = response?.data;

        setTherapists((prev) =>
          prev.map((item) =>
            item.id === editingTherapistId
              ? {
                  ...item,
                  name: updated?.name || payload.name,
                  email: updated?.email || payload.email,
                  phone: updated?.phone || payload.phone,
                  address: updated?.address || payload.address,
                  maxChildren: updated?.maxChildren || payload.maxChildren,
                  specialties: [
                    {
                      id: payload.specialty,
                    },
                  ],
                }
              : item
          )
        );
      } else {
        const response = await createTherapist(payload);
        const created = response?.data;

        const newItem = {
          id: created?.id || created?._id || Date.now().toString(),
          name: created?.name || payload.name,
          specialties: [
            {
              id: payload.specialty,
            },
          ],
          currentLoad: 0,
          maxLoad: created?.maxChildren || payload.maxChildren,
          email: created?.email || payload.email,
          phone: created?.phone || payload.phone,
          address: created?.address || payload.address,
        };

        setTherapists((prev) => [newItem, ...prev]);
      }
      fetchTherapistData();
      // Success - Modal close aur fields reset karein
      setIsAddModalOpen(false);
      resetTherapistForm();
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.log("Failed to save therapist:", error);
      Alert.alert(
        "Error",
        `Could not ${isEditMode ? "update" : "create"} this therapist. Please try again.`
      );
    } finally {
      setSaving(false);
    }
  };

  const fetchTherapistData = async (pageNum = 1, resetList = false, isRefresh = false) => {
    if (loading || (loadingMore && !resetList && !isRefresh)) return;

    if (isRefresh) {
      setRefreshing(true);
    } else if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await therapistUsers({
        page: pageNum,
        limit: 3,
        search: searchQuery,
        specialty: selectedFilter === "All" ? "" : selectedFilter,
      });

      const therapistsData = response?.data || [];
      setSelectedSpecilites(response?.specialties || []);
      setHasMore(response?.hasMore ?? therapistsData.length === 3);

      const formattedTherapists = therapistsData.map((therapist) => {
        const therapistSpecialties = (therapist.specialties || []).map((specId) => {
          const matched = therapistSpecialities.find((item) => item.id === specId);
          return {
            id: specId,
            label: matched?.label || "",
            bg: matched?.bg || '',
            color: matched?.color || '',
          };
        });

        return {
          id: therapist._id || therapist.id,
          name: therapist.fullName || therapist.name,
          specialties: therapistSpecialties,
          currentLoad: therapist.assignedChildren || therapist.currentLoad || 0,
          maxLoad: therapist.maxChildren || therapist.maxLoad || 0,
          email: therapist.email || '',
          phone: therapist.phone || '',
          address: therapist.address || '',
        };
      });

      setTherapists((prev) => (resetList || isRefresh ? formattedTherapists : [...prev, ...formattedTherapists]));
      setPage(pageNum);
    } catch (error) {
      console.log('Failed to fetch therapists:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    fetchTherapistData(1, true, true);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTherapistData(1, true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedFilter]);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;

    if (isCloseToBottom && hasMore && !loadingMore && !loading && !refreshing) {
      fetchTherapistData(page + 1, false);
    }
  };

  const openAssignModal = () => {
    setAssignStep(1);
    setAssignTherapistSearch("");
    setAssignChildSearch("");
    setSelectedAssignTherapist(null);
    setSelectedChildIds([]);
    setAssignTherapistResults([]);
    setAssignChildResults([]);
    setTouchedChildIds([]);
    setIsAssignModalOpen(true);
  };
  const closeAssignModal = () => {
    setAssignStep(1);
    setAssignTherapistSearch("");
    setAssignChildSearch("");
    setSelectedAssignTherapist(null);
    setSelectedChildIds([]);
    setAssignTherapistResults([]);
    setAssignChildResults([]);
    setTouchedChildIds([]);
    setIsAssignModalOpen(false);
  };

  const fetchAssignTherapists = async (search) => {
    setAssignTherapistResults([]);
    setAssignLoading(true);
    try {
      const response = await getUsersByRole({ role: "Therapist", search });
      setAssignTherapistResults(response?.data || []);
    } catch (error) {
      console.log("Failed to fetch therapists for assignment:", error);
      setAssignTherapistResults([]);
    } finally {
      setAssignLoading(false);
    }
  };

  const fetchAssignChildren = async (search) => {
    setAssignChildResults([]);
    setAssignLoading(true);
    try {
      const therapistId = selectedAssignTherapist?._id || selectedAssignTherapist?.id;
      const response = await getUsersByRole({ role: "Child", search, therapistId });
      const results = response?.data || [];
      setAssignChildResults(results);

      const assignedFromThisFetch = results.filter((c) => c.isAssigned).map((c) => c._id || c.id);

      // 1. Ensure clean and unique original IDs
      setOriginalAssignedIds((prev) => Array.from(new Set([...prev, ...assignedFromThisFetch])));

      // 2. Ensure clean unique selected Child IDs without duplications
      setSelectedChildIds((prev) => {
        const combined = [...prev, ...assignedFromThisFetch.filter((id) => !touchedChildIds.includes(id))];
        return Array.from(new Set(combined));
      });
    } catch (error) {
      console.log("Failed to fetch children for assignment:", error);
      setAssignChildResults([]);
    } finally {
      setAssignLoading(false);
    }
  };

  useEffect(() => {
    if (!isAssignModalOpen || assignStep !== 1) return;
    const t = setTimeout(() => fetchAssignTherapists(assignTherapistSearch), 350);
    return () => clearTimeout(t);
  }, [assignTherapistSearch, isAssignModalOpen, assignStep]);

  useEffect(() => {
    if (!isAssignModalOpen || assignStep !== 2) return;
    const t = setTimeout(() => fetchAssignChildren(assignChildSearch), 350);
    return () => clearTimeout(t);
  }, [assignChildSearch, isAssignModalOpen, assignStep]);

  const selectTherapistForAssign = (therapist) => {
    setSelectedAssignTherapist(therapist);
    setSelectedChildIds([]);
    setOriginalAssignedIds([]);
    setTouchedChildIds([]);
    setAssignStep(2);
  };

  const toggleChildSelection = (childId) => {
    setTouchedChildIds((prev) => (prev.includes(childId) ? prev : [...prev, childId]));
    setSelectedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
    );
  };

  const handleConfirmAssign = async () => {
    if (!selectedAssignTherapist || assigning) return;

    const addChildIds = selectedChildIds.filter((id) => !originalAssignedIds.includes(id));
    const removeChildIds = originalAssignedIds.filter((id) => !selectedChildIds.includes(id));

    if (addChildIds.length === 0 && removeChildIds.length === 0) {
      Alert.alert("No changes", "You haven't added or removed any children.");
      return;
    }

    setAssigning(true);
    const therapistId = selectedAssignTherapist._id || selectedAssignTherapist.id;
    console.log(addChildIds,removeChildIds,originalAssignedIds,selectedChildIds)

    try {
      const response = await assignChildrenToTherapist({ therapistId, addChildIds, removeChildIds });
      const result = response?.data;

      setTherapists((prev) =>
        prev.map((item) =>
          item.id === therapistId
            ? { ...item, currentLoad: result?.currentLoad ?? item.currentLoad }
            : item
        )
      );

      setIsAssignModalOpen(false);
      Alert.alert("Updated", response?.message || "Assignment updated successfully.");
      fetchTherapistData();
    } catch (error) {
      console.log("Failed to update assignment:", error);
      const backendMessage = error?.response?.data?.message || error?.message;
      Alert.alert("Could not update", backendMessage || "Could not complete the update. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <SafeAreaView style={[styles.mainContainer]}>
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Manage Therapist"}
      />      

      <ScrollView
        style={styles.scrollArea}
        onTouchStart={() => {
          if (activeMenuId) setActiveMenuId(null);
        }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitle}>
              <Text style={styles.pageTitle}>Therapists</Text>
              <TouchableOpacity style={styles.assignChildButton} onPress={openAssignModal}>
                <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                <Text style={styles.assignChildButtonText}>Assign Child</Text>
              </TouchableOpacity>
          </View>
          <Text style={styles.pageSubTitle}>
            Oversee your Therapist team and balance their caseloads.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputContainerMain}>
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
            const specility = therapistSpecialities.find((item) => item.id === cat);
            if(!specility) return;
            console.log(specility.id,"id");
            return (
              <View
                // key={specility.id}
                // onPress={() => setSelectedFilter(specility.id)}
                style={[
                  styles.tabChip,
                  { backgroundColor: specility.bg },
                  selectedFilter === specility.id && styles.activeChipShadow,
                ]}
              >
                <Text style={[styles.tabChipText, { color: specility.color }]}>
                  {specility.label}
                </Text>
              </View>
            );
          })}
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.centerLoader} />
        )}

        {!loading && therapists.length === 0 && (
          <View style={styles.emptyContainer}>
            <Feather name="user-x" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Therapists Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedFilter !== "All"
                ? "No therapist matches your active search or filter criteria."
                : "There are currently no therapists available."}
            </Text>
          </View>
        )}

        {!loading && therapists.map((therapist) => {
          const loadPercentage = `${(therapist.currentLoad / (therapist.maxLoad || 1)) * 100}%`;
          const isMenuOpen = activeMenuId === therapist.id;
          const avatarColor = getAvatarColor(therapist.id || therapist.name);
          return (
            <View  style={styles.therapistCard}>
              <View style={styles.cardHeaderRow}>
                {/* <Image
                  source={{ uri: therapist.avatar }}
                  style={styles.therapistAvatar}
                /> */}
                <View style={[styles.therapistAvatarInitial, { backgroundColor: avatarColor }]}>
                  <Text style={styles.therapistAvatarInitialText}>
                    {therapist.name?.trim()?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.therapistInfo}>
                  <Text style={styles.therapistName}>{therapist.name}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {(therapist.specialties || []).map((spec) => {  
                    return (
                      <View style={[styles.specialtyBadge, { backgroundColor: spec.bg }]}>
                        <Text style={[styles.specialtyText, { color: spec.color }]}>{spec.label}</Text>
                      </View>
                    )})}
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
                        onPress={() => openEditModal(therapist)}
                      >
                        <Feather name="edit-2" size={15} color="#334155" />
                        <Text style={styles.menuItemText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.menuItem, styles.deleteMenuItem]}
                        onPress={() => handleDeleteTherapist(therapist)}
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

        {loadingMore && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        )}

        {/* Spacer so the FAB never covers the last card */}
        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 90 }]} onPress={openAddModal} activeOpacity={0.8}>
        <Feather name="plus" size={30} color="#fff" />
      </TouchableOpacity>

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

              {therapistSpecialities.map((cat) => {
              return (
                <TouchableOpacity
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
              )})}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIsAddModalOpen(false);
          resetTherapistForm();
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setIsAddModalOpen(false);
            resetTherapistForm();
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditMode ? "Edit Therapist" : "Add New Therapist"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsAddModalOpen(false);
                    resetTherapistForm();
                  }}
                >
                  <Feather name="x" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Full Name <Text style={styles.requiredText}>*</Text></Text>
              <TextInput
                style={styles.formInput}
                placeholder="Dr. Sarah Chen"
                placeholderTextColor="#94A3B8"
                value={newTherapist.name}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, name: t })}
              />

              <Text style={styles.fieldLabel}>Specialty</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 }}>
                  {therapistSpecialities.map((item) => {
                    const isSelected = newTherapist.specialty === item.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.tabChip,
                          { backgroundColor: item.bg },
                          isSelected && { borderWidth: 2, borderColor: '#0B4A6F' }
                        ]}
                        onPress={() => setNewTherapist({ 
                          ...newTherapist, 
                          specialty: item.id,
                          specialtyBg: item.bg,
                          specialtyColor: item.color 
                        })}
                      >
                        <Text style={[styles.tabChipText, { color: item.color, fontWeight: '700' }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

              <Text style={styles.fieldLabel}>Max Children (Caseload Limit)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="15"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={newTherapist.maxChildren}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, maxChildren: t })}
              />

              <Text style={styles.fieldLabel}>Email <Text style={styles.requiredText}>*</Text></Text>
              <TextInput
                style={styles.formInput}
                placeholder="therapist@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                value={newTherapist.email}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, email: t })}
              />

              <Text style={styles.fieldLabel}>Phone <Text style={styles.requiredText}>*</Text></Text>
              <TextInput
                style={styles.formInput}
                placeholder="+1 555-0000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newTherapist.phone}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, phone: t })}
              />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Clinic Address"
                placeholderTextColor="#94A3B8"
                value={newTherapist.address}
                onChangeText={(t) => setNewTherapist({ ...newTherapist, address: t })}
              />

              <Text style={styles.fieldLabel}>Password <Text style={styles.requiredText}>*</Text></Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirm Password <Text style={styles.requiredText}>*</Text></Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

            </ScrollView>
              <View style={styles.stickyButtonContainer}>
                <TouchableOpacity
                  style={[styles.saveTherapistButton1, saving && { opacity: 0.6 }]}
                  onPress={handleSaveTherapist}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveTherapistText}>
                      {isEditMode ? "Save Changes" : "Save Therapist"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isAssignModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAssignModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAssignModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {assignStep === 2 && (
                  <TouchableOpacity onPress={() => setAssignStep(1)}>
                    <Feather name="arrow-left" size={20} color="#0F172A" />
                  </TouchableOpacity>
                )}
                <Text style={styles.modalTitle}>
                  {assignStep === 1 ? "Select Therapist" : "Select Children"}
                </Text>
              </View>
              <TouchableOpacity onPress={closeAssignModal}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {assignStep === 1 ? (
              <>
                <View style={styles.searchInputContainer}>
                  <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search therapists..."
                    placeholderTextColor="#94A3B8"
                    value={assignTherapistSearch}
                    onChangeText={setAssignTherapistSearch}
                  />
                </View>

                {assignLoading && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
                )}

                <ScrollView style={{ maxHeight: 360, marginTop: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!assignLoading && assignTherapistResults.length === 0 && (
                    <Text style={styles.emptyListText}>No therapists found.</Text>
                  )}
                  {assignTherapistResults.map((t) => {console.log(t.id,"t id")
                  return (
                    <TouchableOpacity
                      key={t._id || t.id}
                      style={styles.selectableRow}
                      onPress={() => selectTherapistForAssign(t)}
                    >
                      <Text style={styles.selectableRowText}>{t.fullName || t.name}</Text>
                      <Feather name="chevron-right" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )})}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.searchInputContainer}>
                  <Feather name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search children..."
                    placeholderTextColor="#94A3B8"
                    value={assignChildSearch}
                    onChangeText={setAssignChildSearch}
                  />
                </View>

                {assignLoading && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
                )}

                <ScrollView style={{ maxHeight: 280, marginTop: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!assignLoading && assignChildResults.length === 0 && (
                    <Text style={styles.emptyListText}>No children found.</Text>
                  )}
                  {assignChildResults.map((child, index) => {
                    const childId = child._id || child.id;
                    const isSelected = selectedChildIds.includes(childId);
                    return (
                      <TouchableOpacity
                        // key={`${childId}-${index}`} // Safe unique key prevents UI duplicate warning
                        style={styles.selectableRow}
                        onPress={() => toggleChildSelection(childId)}
                      >
                        <Text style={styles.selectableRowText}>{child.fullName || child.name}</Text>
                        <Feather
                          name={isSelected ? "check-square" : "square"}
                          size={18}
                          color={isSelected ? "#0B4A6F" : "#94A3B8"}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {(() => {
                  const toAdd = selectedChildIds.filter((id) => !originalAssignedIds.includes(id));
                  const toRemove = originalAssignedIds.filter((id) => !selectedChildIds.includes(id));
                  const hasChanges = toAdd.length > 0 || toRemove.length > 0;
                  const isDisabled = !hasChanges || assigning;

                  const label = !hasChanges
                    ? "No changes"
                    : [
                        toAdd.length > 0 && `Assign ${toAdd.length}`,
                        toRemove.length > 0 && `Unassign ${toRemove.length}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                  return (
                    <TouchableOpacity
                      style={[styles.saveTherapistButton, isDisabled && { opacity: 0.6 }]}
                      onPress={handleConfirmAssign}
                      disabled={isDisabled}
                    >
                      {assigning ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveTherapistText}>{label}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
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
  assignChildButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0B4A6F",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  assignChildButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  headerTitleContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  searchInputContainerMain: {
    flex:1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInputContainer: {
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
  therapistAvatarInitial: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  therapistAvatarInitialText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
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

  fab: {
    position: "absolute",
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#0d162b",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
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
  requiredText:{
    color:"red"
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
  stickyButtonContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center', 
  },

  saveTherapistButton1: {
    backgroundColor: '#0B4A6F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', 
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
  centerLoader: {
    marginVertical: 30,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  selectableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  selectableRowText: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
  },
  emptyListText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 14,
    marginVertical: 24,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
});