import React, { useEffect, useState, useRef } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";

import {
  childUsers,
  createChild,
  updateChild,
  deleteChild,
  getParents,
  getAllPackages,
} from "../../api/admin/api";
import BottomBar from "../../components/BottomBar";
import TopBar from "../../components/TopBar";
import { colors, fonts } from "../../styles/theme";

const AVATAR_COLORS = [
  "#0B4A6F",
  "#7C3AED",
  "#DC2626",
  "#059669",
  "#D97706",
  "#DB2777",
  "#2563EB",
  "#0891B2",
  "#65A30D",
  "#9333EA",
  "#EA580C",
  "#0D9488",
];

const getAvatarColor = (str = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const initialChildState = {
  name: "",
  fatherName: "",
  fatherCnic: "",
  age: "",
  email: "",
  phone: "",
  packageId: null,        
  discountedPrice: "",
  isActive: true,
};
const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const ACTIVE_OPTIONS = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
];

const SegmentedToggle = ({ options, value, onChange }) => (
  <View style={styles.segmentWrap}>
    {options.map((opt) => {
      const on = value === opt.value;
      return (
        <TouchableOpacity
          key={String(opt.value)}
          style={[styles.segmentItem, on && styles.segmentItemOn]}
          activeOpacity={0.8}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);
export default function ChildrenScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [children, setChildren] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBottomTab, setActiveBottomTab] = useState("Children");
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newChild, setNewChild] = useState(initialChildState);
  const [editingChildId, setEditingChildId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fetchingParent, setFetchingParent] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isPackagePickerOpen, setIsPackagePickerOpen] = useState(false);
  const [packageSearch, setPackageSearch] = useState("");
  const [pkgResults, setPkgResults] = useState([]);
  const [pkgPage, setPkgPage] = useState(1);
  const [pkgHasMore, setPkgHasMore] = useState(true);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [pkgLoadingMore, setPkgLoadingMore] = useState(false);
  const pkgRequestIdRef = useRef(0);
  const pkgLoadingMoreRef = useRef(false);

  const PKG_LIMIT = 10;

  const isEditMode = editingChildId !== null;
  const menuTouchRef = useRef(false);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const parentRequestIdRef = useRef(0);

  const resetChildForm = () => {
    setNewChild(initialChildState);
    setEditingChildId(null);
    setSelectedPackage(null);          
    setPassword("");
    setConfirmPassword("");
  };

  const openAddModal = () => {
    resetChildForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (child) => {
    setActiveMenuId(null);
    setEditingChildId(child.id);

    setNewChild({
      name: child.name || "",
      fatherName: child.fatherName || "",
      fatherCnic: child.fatherCnic || "",
      age: child.age != null ? String(child.age) : "",
      email: child.email || "",
      phone: child.phone || "",
      packageId: child.packageId || null,
      discountedPrice: child.discountedPrice != null ? String(child.discountedPrice) : "",
      isActive: child.isActive !== false,
    });
    setSelectedPackage(
      child.packageId
        ? { _id: child.packageId, name: child.packageName, price: child.packagePrice }
        : null,
    );

    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);

    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    resetChildForm();
  };

  const fetchChildrenData = async (
    pageNum = 1,
    resetList = false,
    isRefresh = false
  ) => {
    const requestId = ++requestIdRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else if (resetList) {
      setLoading(true);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const response = await childUsers({
        page: pageNum,
        limit: 5,
        search: searchQuery.trim(),
        status: statusFilter,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      const data = response?.data?.data || response?.data || [];

      const hasMoreData =
        response?.hasMore ?? data.length >= 5;

      const formatted = data.map((child) => ({
        id: child._id || child.id,
        name: child.fullName || child.name || "",
        fatherName: child.fatherName || "",
        fatherCnic: child.fatherCnic || "",
        age: child.age ?? null,
        email: child.email || "",
        phone: child.phone || "",
        packageId: child.packageId?._id || child.packageId || null,
        packageName: child.packageId?.name || "",
        packagePrice: child.packageId?.price ?? null,
        discountedPrice: child.discountedPrice ?? null,
        isActive: child.isActive ?? true,
      }));

      setHasMore(hasMoreData);

      if (resetList || isRefresh) {
        setChildren(formatted);
      } else {
        setChildren((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));

          const newItems = formatted.filter(
            (item) => !existingIds.has(item.id)
          );

          return [...prev, ...newItems];
        });
      }

      setPage(pageNum);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.log("Failed to fetch children:", error);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }

      if (!resetList && !isRefresh) {
        loadingMoreRef.current = false;
      }
    }
  };
  const fetchPackageResults = async (pageNum = 1, search = "") => {
    const requestId = ++pkgRequestIdRef.current;
    const isFirst = pageNum === 1;

    if (isFirst) {
      pkgLoadingMoreRef.current = false;
      setPkgLoadingMore(false);
      setPkgLoading(true);
    } else {
      pkgLoadingMoreRef.current = true;
      setPkgLoadingMore(true);
    }

    try {
      const res = await getAllPackages(pageNum, PKG_LIMIT, search.trim());
      if (requestId !== pkgRequestIdRef.current) return;

      if (res?.success) {
        const list = res.data || [];
        setPkgResults((prev) =>
          isFirst
            ? list
            : [...prev, ...list.filter((i) => !prev.some((p) => p._id === i._id))],
        );
        setPkgPage(pageNum);
        setPkgHasMore(Boolean(res.hasMore));
      }
    } catch (error) {
      if (requestId === pkgRequestIdRef.current) {
        console.log("Failed to fetch packages:", error);
      }
    } finally {
      if (requestId === pkgRequestIdRef.current) {
        setPkgLoading(false);
        setPkgLoadingMore(false);
        pkgLoadingMoreRef.current = false;
      }
    }
  };

  useEffect(() => {
    if (!isPackagePickerOpen) return;
    const t = setTimeout(() => fetchPackageResults(1, packageSearch), 300);
    return () => clearTimeout(t);
  }, [packageSearch, isPackagePickerOpen]);

  const openPackagePicker = () => {
    setPackageSearch("");
    setPkgResults([]);
    setPkgHasMore(true);
    setIsPackagePickerOpen(true);
  };

  const closePackagePicker = () => setIsPackagePickerOpen(false);

  const handleSelectPackage = (pkg) => {
    setSelectedPackage({ _id: pkg._id, name: pkg.name, price: pkg.price });
    setNewChild((prev) => ({ ...prev, packageId: pkg._id, discountedPrice: "" }));
    closePackagePicker();
  };

  const handleClearPackage = () => {
    setSelectedPackage(null);
    setNewChild((prev) => ({ ...prev, packageId: null, discountedPrice: "" }));
  };

  const handlePackageEndReached = () => {
    if (pkgLoading || pkgLoadingMoreRef.current || !pkgHasMore) return;
    fetchPackageResults(pkgPage + 1, packageSearch);
  };


  const onRefresh = () => {
    loadingMoreRef.current = false;
    setPage(1);
    setHasMore(true);

    fetchChildrenData(1, true, true);
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      loadingMoreRef.current = false;
      setPage(1);
      setHasMore(true);

      fetchChildrenData(1, true);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);


  const handleScroll = ({ nativeEvent }) => {
    const {
      layoutMeasurement,
      contentOffset,
      contentSize,
    } = nativeEvent;

    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - 100;

    if (
      isCloseToBottom &&
      hasMore &&
      !loading &&
      !refreshing &&
      !loadingMoreRef.current
    ) {
      loadingMoreRef.current = true;

      fetchChildrenData(page + 1, false);
    }
  };


  const handleDeleteChild = (child) => {
    setActiveMenuId(null);
    Alert.alert(
      "Delete Child",
      `Remove ${child.name} from the system? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const previous = children;
            setChildren((prev) => prev.filter((item) => item.id !== child.id));
            try {
              await deleteChild(child.id);
            } catch (error) {
              console.log("Failed to delete child:", error);
              setChildren(previous);
              Alert.alert(
                "Error",
                `${error?.response?.data?.message??"Could not delete this child. Please try again."}`,
              );
            }
          },
        },
      ],
    );
  };

  const handleSaveChild = async () => {
    if (
      !newChild.name ||
      !newChild.email ||
      !newChild.phone ||
      !newChild.fatherName ||
      !newChild.fatherCnic ||
      saving
    ) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return;
    }

    if (
      newChild.age &&
      (isNaN(Number(newChild.age)) || Number(newChild.age) < 0)
    ) {
      Alert.alert("Validation Error", "Please enter a valid age.");
      return;
    }
    if (newChild.packageId && newChild.discountedPrice !== "") {
      const dp = Number(newChild.discountedPrice);
      const selected = selectedPackage;

      if (!Number.isFinite(dp) || dp <= 0) {
        Alert.alert("Validation Error", "Please enter a valid discounted price.");
        return;
      }
      if (selected?.price != null && dp >= selected.price) {
        Alert.alert(
          "Validation Error",
          `Discounted price must be less than the monthly rate (PKR ${Number(selected.price).toLocaleString()}).`,
        );
        return;
      }
    }
    const phone = newChild.phone.trim();

    const phoneRegex = /^(030\d{8}|\+923\d{9})$/;

    if (!phoneRegex.test(phone)) {
      Alert.alert(
        "Validation Error",
        "Phone number must be in 03011234567 or +923011234567 format.",
      );
      return;
    }

    const normalizedPhone = phone.startsWith("+92")
      ? "0" + phone.slice(3)
      : phone;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

    if (password && !passwordRegex.test(password)) {
      Alert.alert(
        "Validation Error",
        "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
      );
      return;
    }
    // Create mode: password required
    if (!isEditMode) {
      if (!password || !confirmPassword) {
        Alert.alert("Error", "Please enter and confirm your password.");
        return;
      }
    }

    // Edit mode: password optional, lekin agar diya ho to match aur validate hona chahiye
    if (isEditMode && (password || confirmPassword)) {
      if (!password || !confirmPassword) {
        Alert.alert(
          "Error",
          "Please fill both password fields, or leave both blank.",
        );
        return;
      }
    }

    if (password && password !== confirmPassword) {
      Alert.alert("Error", "Password and Confirm Password do not match.");
      return;
    }

    setSaving(true);

    const payload = {
      fullName: newChild.name,
      fatherName: newChild.fatherName || "",
      fatherCnic: newChild.fatherCnic || "",
      age: newChild.age ? Number(newChild.age) : null,
      email: newChild.email,
      phone: normalizedPhone,
      ...((!isEditMode || password) && { password }),
      packageId: newChild.packageId || null,
      discountedPrice:
        newChild.packageId && newChild.discountedPrice !== ""
          ? Number(newChild.discountedPrice)
          : null,
      isActive: newChild.isActive,
    };

    try {
      if (isEditMode) {
        await updateChild(editingChildId, payload);
      } else {
        await createChild(payload);
      }

      closeAddModal();
      loadingMoreRef.current = false;
      setPage(1);
      setHasMore(true);
      await fetchChildrenData(1, true);
    } catch (error) {
      console.log("Failed to save child:", error);
      const backendMessage = error?.response?.data?.message;
      Alert.alert(
        "Error",
        backendMessage ||
          `Could not ${isEditMode ? "update" : "create"} this child. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (isEditMode || !isAddModalOpen) return;

    const cleanCnic = (newChild.fatherCnic || "").replace(/\D/g, "");

    if (cleanCnic.length !== 13) {
      parentRequestIdRef.current += 1;
      setFetchingParent(false);
      return;
    }

    const currentRequestId = ++parentRequestIdRef.current;

    const fetchParentByCnic = async () => {
      setFetchingParent(true);

      try {
        const response = await getParents({
          cnic: cleanCnic,
        });

        if (currentRequestId !== parentRequestIdRef.current) {
          return;
        }

        const parentList =
          response?.data?.data ||
          response?.data ||
          [];

        const parent = Array.isArray(parentList)
          ? parentList[0]
          : parentList;

        if (parent?.parentName) {
          setNewChild((prev) => ({
            ...prev,
            fatherName: parent.parentName,
          }));
        } else {
          setNewChild((prev) => ({
            ...prev,
            fatherName: "",
          }));
        }
      } catch (error) {
        if (currentRequestId === parentRequestIdRef.current) {
          console.log(
            "Parent fetch by CNIC error:",
            error
          );

          setNewChild((prev) => ({
            ...prev,
            fatherName: "",
          }));
        }
      } finally {
        if (currentRequestId === parentRequestIdRef.current) {
          setFetchingParent(false);
        }
      }
    };

    fetchParentByCnic();
  }, [
    newChild.fatherCnic,
    isAddModalOpen,
    isEditMode,
  ]);


  return (
    <SafeAreaView
      style={styles.mainContainer}
      onTouchStart={() => {
        if (menuTouchRef.current) {
          menuTouchRef.current = false;
          return;
        }
        if (activeMenuId) setActiveMenuId(null);
      }}
    >
      <TopBar
        navigation={navigation}
        isNotificationOpen={isNotificationOpen}
        onToggleNotification={setIsNotificationOpen}
        headerTitle={"Manage Children"}
      />

      <ScrollView
        style={styles.scrollArea}
        onScrollBeginDrag={() => setActiveMenuId(null)}
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
          <Text style={styles.pageTitle}>Children</Text>
          <Text style={styles.pageSubTitle}>
            View, add, and manage children enrolled in the program.
          </Text>
        </View>

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
              placeholder="Search children..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.8}
            onPress={() => setIsFilterOpen(true)}
          >
            <Feather name="sliders" size={20} color="#0B4A6F" />
            {statusFilter !== "active" && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {loading && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.centerLoader}
          />
        )}

        {!loading && children.length === 0 && (
          <View style={styles.emptyContainer}>
            <Feather name="user-x" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Children Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "No child matches your active search."
                : "There are currently no children added."}
            </Text>
          </View>
        )}

        {!loading &&
          children.map((child) => {
            const isMenuOpen = activeMenuId === child.id;
            const avatarColor = getAvatarColor(child.id || child.name);

            return (
              <View
                key={child.id}
                style={[
                  styles.childCard,
                  {
                    zIndex: isMenuOpen ? 1000 : 1,
                    elevation: isMenuOpen ? 10 : 3,
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.avatarInitial,
                      { backgroundColor: avatarColor },
                    ]}
                  >
                    <Text style={styles.avatarInitialText}>
                      {child.name?.trim()?.charAt(0)?.toUpperCase() || "?"} 
                      </Text> 
                    
                  </View>

                  <View style={styles.childInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.childNameInline} numberOfLines={1}>
                        {child.name}
                      </Text>

                      {child.isActive === false && (
                        <View style={styles.inactiveBadge}>
                          <View style={styles.inactiveDot} />
                          <Text style={styles.inactiveBadgeText}>Inactive</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.contactRow}>
                      <Feather name="mail" size={14} color="#64748B" />
                      <Text style={styles.contactText}>{child.email}</Text>
                    </View>

                    <View style={styles.contactRow}>
                      <Feather name="phone" size={14} color="#64748B" />
                      <Text style={styles.contactText}>{child.phone}</Text>
                    </View>
                    {!!child.packageId && (
                      <View style={styles.packagePill}>
                        <Feather name="package" size={12} color="#0B4A6F" />
                        <Text style={styles.packagePillText} numberOfLines={1}>
                          {child.packageName} •{" "}
                          {child.discountedPrice != null
                            ? `PKR ${Number(child.packagePrice - child.discountedPrice).toLocaleString()}/mo (was ${Number(child.packagePrice || 0).toLocaleString()})`
                            : `PKR ${Number(child.packagePrice || 0).toLocaleString()}/mo`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* MENU */}
                  <View
                    onTouchStart={() => {
                      menuTouchRef.current = true;
                    }}
                    style={{
                      position: "relative",
                      zIndex: isMenuOpen ? 1000 : 1,
                      elevation: isMenuOpen ? 20 : 1,
                    }}
                  >
                    <TouchableOpacity
                      style={styles.moreOptionsButton}
                      activeOpacity={0.7}
                      onPress={() =>
                        setActiveMenuId(isMenuOpen ? null : child.id)
                      }
                    >
                      <Feather name="more-vertical" size={20} color="#94A3B8" />
                    </TouchableOpacity>

                    {isMenuOpen && (
                      <View style={styles.dropdownMenu}>
                        <TouchableOpacity
                          style={styles.menuItem}
                          activeOpacity={0.7}
                          onPress={() => openEditModal(child)}
                        >
                          <Feather name="edit-2" size={15} color="#334155" />
                          <Text style={styles.menuItemText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.menuItem, styles.deleteMenuItem]}
                          activeOpacity={0.7}
                          onPress={() => handleDeleteChild(child)}
                        >
                          <Feather name="trash-2" size={15} color="#EF4444" />
                          <Text
                            style={[styles.menuItemText, styles.deleteText]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.scheduleButton}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate("ChildSchedule", {
                      childId: child.id,
                      childName: child.name,
                      isActive: child.isActive
                    })
                  }
                >
                  <Feather name="calendar" size={16} color="#FFFFFF" />
                  <Text style={styles.scheduleButtonText}>View Schedule</Text>
                </TouchableOpacity>
              </View>
            );
          })}

        {loadingMore && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginVertical: 12 }}
          />
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
        onPress={openAddModal}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeAddModal}
      >
        <View
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeAddModal}
        >
          <View activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? "Edit Child" : "Add New Child"}
              </Text>
              <TouchableOpacity onPress={closeAddModal}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>
                Full Name <Text style={styles.requiredText}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Ayaan Khan"
                placeholderTextColor="#94A3B8"
                value={newChild.name || ""}
                onChangeText={(t) => setNewChild({ ...newChild, name: t })}
              />
              <Text style={styles.fieldLabel}>
                Parent CNIC <Text style={styles.requiredText}>*</Text>
              </Text>
              <View style={styles.inputWithLoaderContainer}>
                <TextInput
                  style={styles.formInputFlex}
                  placeholder="e.g. 3520112345671"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={13}
                  value={newChild.fatherCnic || ""}
                  onChangeText={(t) =>
                    setNewChild({ ...newChild, fatherCnic: t })
                  }
                />
                {fetchingParent && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ marginRight: 10 }}
                  />
                )}
              </View>

              <Text style={styles.fieldLabel}>
                Parent Name <Text style={styles.requiredText}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Bilal Khan"
                placeholderTextColor="#94A3B8"
                value={newChild.fatherName || ""}
                onChangeText={(t) =>
                  setNewChild({ ...newChild, fatherName: t })
                }
              />

              <Text style={styles.fieldLabel}>Age</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 6"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={newChild.age || ""}
                onChangeText={(t) => setNewChild({ ...newChild, age: t })}
              />

              <Text style={styles.fieldLabel}>
                Email <Text style={styles.requiredText}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="parent@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                value={newChild.email || ""}
                onChangeText={(t) => setNewChild({ ...newChild, email: t })}
              />

              <Text style={styles.fieldLabel}>
                Phone <Text style={styles.requiredText}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="0300 1234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={newChild.phone || ""}
                onChangeText={(t) => setNewChild({ ...newChild, phone: t })}
              />

              <Text style={styles.fieldLabel}>Fee Package (optional)</Text>

              {selectedPackage ? (
                <View style={styles.selectedPackageCard}>
                  <View style={styles.selectedPackageInfo}>
                    <Text style={styles.packageOptionName} numberOfLines={1}>
                      {selectedPackage.name}
                    </Text>
                    <Text style={styles.packageOptionPrice}>
                      PKR {Number(selectedPackage.price || 0).toLocaleString()}/mo
                    </Text>
                  </View>

                  <TouchableOpacity onPress={openPackagePicker} style={styles.changeButton}>
                    <Text style={styles.changeButtonText}>Change</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleClearPackage} style={styles.clearButton}>
                    <Feather name="x" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectPackageButton}
                  activeOpacity={0.8}
                  onPress={openPackagePicker}
                >
                  <Feather name="search" size={16} color="#94A3B8" />
                  <Text style={styles.selectPackageText}>Select a package</Text>
                  <Feather name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}

              {!!selectedPackage && (
                <>
                  <Text style={styles.fieldLabel}>Discounted Price (PKR / month)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Optional, leave blank for full rate"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newChild.discountedPrice || ""}
                    onChangeText={(t) =>
                      setNewChild({ ...newChild, discountedPrice: t.replace(/[^0-9.]/g, "") })
                    }
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>
                {isEditMode ? "New Password" : "Password"}{" "}
                {!isEditMode && <Text style={styles.requiredText}>*</Text>}
              </Text>
              {isEditMode && (
                <Text style={styles.helperText}>
                  Leave blank to keep the current password.
                </Text>
              )}
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    isEditMode ? "Enter new password" : "Enter password"
                  }
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>
                {isEditMode ? "Confirm New Password" : "Confirm Password"}{" "}
                {!isEditMode && <Text style={styles.requiredText}>*</Text>}
              </Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={
                    isEditMode ? "Confirm new password" : "Confirm password"
                  }
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Feather
                    name={showConfirmPassword ? "eye" : "eye-off"}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Status</Text>
              <SegmentedToggle
                options={ACTIVE_OPTIONS}
                value={newChild.isActive}
                onChange={(v) => setNewChild((prev) => ({ ...prev, isActive: v }))}
              />
            </ScrollView>

            <View style={styles.stickyButtonContainer}>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSaveChild}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isEditMode ? "Save Changes" : "Save Child"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isPackagePickerOpen}
        animationType="fade"
        transparent
        onRequestClose={closePackagePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Package</Text>
              <TouchableOpacity onPress={closePackagePicker}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchBox}>
              <Feather name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search packages..."
                placeholderTextColor="#94A3B8"
                value={packageSearch}
                onChangeText={setPackageSearch}
                autoFocus
              />
            </View>

            {pkgLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: 30 }}
              />
            ) : (
              <FlatList
                data={pkgResults}
                keyExtractor={(item) => String(item._id)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onEndReached={handlePackageEndReached}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                  <Text style={styles.pickerEmpty}>
                    {packageSearch ? "No packages match your search." : "No packages created yet."}
                  </Text>
                }
                ListFooterComponent={
                  pkgLoadingMore ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={{ marginVertical: 12 }}
                    />
                  ) : null
                }
                renderItem={({ item }) => {
                  const on = selectedPackage?._id === item._id;
                  return (
                    <TouchableOpacity
                      style={[styles.packageOption, on && styles.packageOptionOn]}
                      activeOpacity={0.8}
                      onPress={() => handleSelectPackage(item)}
                    >
                      <View style={[styles.radio, on && styles.radioOn]}>
                        {on && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.packageOptionName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.packageOptionPrice}>
                        PKR {Number(item.price || 0).toLocaleString()}/mo
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={isFilterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <View
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.filterSheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Children</Text>
              <TouchableOpacity onPress={() => setIsFilterOpen(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Status</Text>
            <SegmentedToggle
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setIsFilterOpen(false);
              }}
            />
          </TouchableOpacity>
        </View>
      </Modal>

      <BottomBar
        activeTab={"Children"}
        setActiveTab={setActiveBottomTab}
        onOpenNotifications={setIsNotificationOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 10 },

  headerTitleContainer: { marginBottom: 16 },
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
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#0F172A" },

  childCard: {
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
    marginBottom: 12,
  },
  avatarInitial: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  childInfo: { flex: 1, },
  childName: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginBottom: 2,
  },
  childMeta: { fontSize: 13, color: "#64748B" },

  moreOptionsButton: { padding: 6 },
  dropdownMenu: {
    position: "absolute",
    right: 0,
    top: 34,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 6,
    width: 120,

    elevation: 20,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,

    zIndex: 9999,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteMenuItem: { borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  menuItemText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  deleteText: { color: "#EF4444" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  contactText: { fontSize: 13, color: "#475569" },

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
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A" },

  requiredText: { color: "red" },
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
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  passwordInput: { flex: 1, fontSize: 14, color: "#0F172A" },

  stickyButtonContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#0B4A6F",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  centerLoader: { marginVertical: 30 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  inputWithLoaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    height: 46,
  },
  formInputFlex: {
    flex: 1,
    paddingHorizontal: 14,
    height: "100%",
    fontSize: 14,
    color: "#0F172A",
  },
  scheduleButton: {
    marginTop: 4,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scheduleButtonText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#FFFFFF" },
  helperText: { fontSize: 12, color: "#64748B", marginBottom: 6 }, // was referenced but missing

  packageOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  packageOptionOn: { borderColor: "#0B4A6F", backgroundColor: "#FFFFFF" },
  packageOptionName: { flex: 1, fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A" },
  packageOptionPrice: { fontSize: 12, fontFamily: fonts.regular, color: "#475569" },

  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center",
  },
  radioOn: { borderColor: "#0B4A6F" },
  selectPackageButton: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  height: 46,
  paddingHorizontal: 14,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#CBD5E1",
  backgroundColor: "#F8FAFC",
},
selectPackageText: { flex: 1, fontSize: 14, color: "#94A3B8" },

selectedPackageCard: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#0B4A6F",
  backgroundColor: "#FFFFFF",
},
selectedPackageInfo: { flex: 1 },
changeButton: { paddingHorizontal: 10, paddingVertical: 6 },
changeButtonText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },
clearButton: { padding: 4 },

pickerContent: {
  backgroundColor: "#FFFFFF",
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  padding: 24,
  height: "70%",
},
pickerSearchBox: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  height: 46,
  paddingHorizontal: 14,
  marginBottom: 8,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#CBD5E1",
  backgroundColor: "#F8FAFC",
},
pickerSearchInput: { flex: 1, fontSize: 14, color: "#0F172A" },
pickerEmpty: { textAlign: "center", marginTop: 30, fontSize: 14, color: "#64748B" },

  packagePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E8F2FC",
  },
  packagePillText: { fontSize: 11, fontFamily: fonts.semiBold, color: "#0B4A6F", flexShrink: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B4A6F" },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  filterSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemOn: {
    backgroundColor: "#0B4A6F",
  },
  segmentText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#475569" },
  segmentTextOn: { color: "#FFFFFF" },
    nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // marginBottom: 2,
  },
  childNameInline: {
    flexShrink: 1,
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  inactiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: "#DC2626",
  },
});
