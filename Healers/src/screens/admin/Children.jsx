import React, { useEffect, useState,useRef } from 'react';

import {
  ActivityIndicator,
  Alert,
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

import {
  childUsers,
  createChild,
  updateChild,
  deleteChild,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import { colors, fonts } from '../../styles/theme';

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
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const initialChildState = {
  name: "",
  parentName: "",
  age: "",
  email: "",
  phone: "",
};
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

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isEditMode = editingChildId !== null;
    const menuTouchRef = useRef(false);
  
  const resetChildForm = () => {
    setNewChild(initialChildState);
    setEditingChildId(null);
    setPassword("");
    setConfirmPassword("");
  };

  const openAddModal = () => {
    resetChildForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (child) => {
    // console.log("EDIT CHILD:", child);

    setActiveMenuId(null);
    setEditingChildId(child.id);

    setNewChild({
        name: child.name || "",
        parentName: child.parentName || "",
        age: child.age != null ? String(child.age) : "",
        email: child.email || "",
        phone: child.phone || "",
    });

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

  // ---- Fetch (paginated + searchable) ----
  const fetchChildrenData = async (pageNum = 1, resetList = false, isRefresh = false) => {
    if (loading || (loadingMore && !resetList && !isRefresh)) return;

    if (isRefresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await childUsers({
        page: pageNum,
        limit: 10,
        search: searchQuery,
      });

      const data = response?.data?.data || [];
      setHasMore(response?.hasMore ?? data.length === 10);
      
      const formatted = data.map((child) => ({
        id: child._id || child.id,
        name: child.fullName || child.name || "",
        parentName: child.fatherName || "",
        age: child.age ?? null,
        email: child.email || "",
        phone: child.phone || "",
      }));

      setChildren((prev) =>
        resetList || isRefresh ? formatted : [...prev, ...formatted]
      );
      setPage(pageNum);
    } catch (error) {
      console.log("Failed to fetch children:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    fetchChildrenData(1, true, true);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchChildrenData(1, true);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;

    if (isCloseToBottom && hasMore && !loadingMore && !loading && !refreshing) {
      fetchChildrenData(page + 1, false);
    }
  };

  // ---- Delete ----
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
              Alert.alert("Error", "Could not delete this child. Please try again.");
            }
          },
        },
      ]
    );
  };


  const handleSaveChild = async () => {
    if (!newChild.name || !newChild.email || !newChild.phone || saving) {
        Alert.alert("Validation Error", "Please fill in all required fields.");
        return;
    }

    if (newChild.age && (isNaN(Number(newChild.age)) || Number(newChild.age) < 0)) {
        Alert.alert("Validation Error", "Please enter a valid age.");
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
        Alert.alert("Error", "Please fill both password fields, or leave both blank.");
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
        fatherName: newChild.parentName || "",
        age: newChild.age ? Number(newChild.age) : null,
        email: newChild.email,
        phone: newChild.phone,
        // Create mode mein hamesha bhejein; edit mode mein sirf tab bhejein jab user ne likha ho
        ...((!isEditMode || password) && { password }),
    };

    try {
        if (isEditMode) {
        const response = await updateChild(editingChildId, payload);
        const updated = response?.data;

        setChildren((prev) =>
            prev.map((item) =>
            item.id === editingChildId
                ? {
                    ...item,
                    name: updated?.fullName || payload.fullName,
                    parentName: updated?.fatherName ?? payload.fatherName,
                    age: updated?.age ?? payload.age,
                    email: updated?.email || payload.email,
                    phone: updated?.phone || payload.phone,
                }
                : item
            )
        );
        } else {
        const response = await createChild(payload);
        const created = response?.data;

        const newItem = {
            id: created?.id || created?._id || Date.now().toString(),
            name: created?.fullName || payload.fullName,
            parentName: created?.fatherName || payload.fatherName,
            age: created?.age ?? payload.age,
            email: created?.email || payload.email,
            phone: created?.phone || payload.phone,
        };

        setChildren((prev) => [newItem, ...prev]);
        }

        closeAddModal();
        await fetchChildrenData(1, true);
    } catch (error) {
        console.log("Failed to save child:", error);
        const backendMessage = error?.response?.data?.message;
        Alert.alert(
        "Error",
        backendMessage ||
            `Could not ${isEditMode ? "update" : "create"} this child. Please try again.`
        );
    } finally {
        setSaving(false);
    }
    };

  return (
    <SafeAreaView style={styles.mainContainer}
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
        // onTouchStart={() => {
        //     if (activeMenuId) setActiveMenuId(null);
        // }}
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
            <Feather name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search children..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.centerLoader} />
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
                    <Text style={styles.childName}>{child.name}</Text>

                    <View style={styles.contactRow}>
                        <Feather name="mail" size={14} color="#64748B" />
                        <Text style={styles.contactText}>{child.email}</Text>
                    </View>

                    <View style={styles.contactRow}>
                        <Feather name="phone" size={14} color="#64748B" />
                        <Text style={styles.contactText}>{child.phone}</Text>
                    </View>
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
                        setActiveMenuId(
                            isMenuOpen ? null : child.id
                        )
                        }
                    >
                        <Feather
                        name="more-vertical"
                        size={20}
                        color="#94A3B8"
                        />
                    </TouchableOpacity>

                    {isMenuOpen && (
                        <View style={styles.dropdownMenu}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            activeOpacity={0.7}
                            onPress={() => openEditModal(child)}
                        >
                            <Feather
                            name="edit-2"
                            size={15}
                            color="#334155"
                            />
                            <Text style={styles.menuItemText}>
                            Edit
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                            styles.menuItem,
                            styles.deleteMenuItem,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => handleDeleteChild(child)}
                        >
                            <Feather
                            name="trash-2"
                            size={15}
                            color="#EF4444"
                            />
                            <Text
                            style={[
                                styles.menuItemText,
                                styles.deleteText,
                            ]}
                            >
                            Delete
                            </Text>
                        </TouchableOpacity>
                        </View>
                    )}
                    </View>
                </View>
                </View>
            );
          })}

        {loadingMore && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
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
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeAddModal}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditMode ? "Edit Child" : "Add New Child"}
                </Text>
                <TouchableOpacity onPress={closeAddModal}>
                  <Feather name="x" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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

              <Text style={styles.fieldLabel}>Parent Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Bilal Khan"
                placeholderTextColor="#94A3B8"
                value={newChild.parentName || ""}
                onChangeText={(t) => setNewChild({ ...newChild, parentName: t })}
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

             
              <Text style={styles.fieldLabel}>
                {isEditMode ? "New Password" : "Password"}{" "}
                {!isEditMode && <Text style={styles.requiredText}>*</Text>}
                </Text>
                {isEditMode && (
                <Text style={styles.helperText}>Leave blank to keep the current password.</Text>
                )}
                <View style={styles.passwordInputContainer}>
                <TextInput
                    style={styles.passwordInput}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={isEditMode ? "Enter new password" : "Enter password"}
                    placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
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
                    placeholder={isEditMode ? "Confirm new password" : "Confirm password"}
                    placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
                </TouchableOpacity>
                </View>
             
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
          </TouchableOpacity>
        </TouchableOpacity>
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

  searchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
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
  cardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatarInitial: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  childInfo: { flex: 1 },
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

  menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  deleteMenuItem: { borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  menuItemText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  deleteText: { color: "#EF4444" },

  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
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

  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
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
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6, marginTop: 14 },
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
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#334155", marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 20 },
});