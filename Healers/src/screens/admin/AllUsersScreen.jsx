import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect } from "@react-navigation/native";

import {
  createAdmin,
  createTherapist,
  deleteAdmin,
  deleteChild,
  deleteTherapist,
  getAllUsers,
  getServices,
  updateAdmin,
  updateTherapist,
} from "../../api/admin/api";
import { colors, commonStyles, fonts } from "../../styles/theme";
import { fontSize, hp, wp } from "../../utils/responsive";

const LIMIT = 10;

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "Admin", label: "Admins" },
  { id: "Therapist", label: "Therapists" },
  { id: "Child", label: "Children" },
];
const STATUS_FILTERS = [
  { id: "all", label: "All status" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];
const ROLE_META = {
  Admin: { bg: "#EDE9FE", color: "#6D28D9" },
  Therapist: { bg: "#DBEAFE", color: "#1D4ED8" },
  Child: { bg: "#DCFCE7", color: "#15803D" },
};

const PHONE_RX = /^(03\d{9}|\+923\d{9})$/;
const PASSWORD_RX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- helpers ---------- */

// Shape that ChildForm / ChildDetails already receive from ChildrenScreen
const toChildParam = (u) => ({
  id: u._id,
  name: u.fullName || "",
  fatherName: u.fatherName || "",
  fatherCnic: u.fatherCnic || "",
  age: u.age ?? null,
  email: u.email || "",
  phone: u.phone || "",
  address: u.address || "",
  packageId: u.packageId?._id || u.packageId || null,
  packageName: u.packageId?.name || "",
  packagePrice: u.packageId?.price ?? null,
  discountedPrice: u.discountedPrice ?? null,
  isActive: u.isActive ?? true,
  dateOfBirth: u.dateOfBirth || null,
  gender: u.gender || "",
  diagnosis: u.diagnosis || "",
  documents: u.documents || {},
});

/* ---------- small components ---------- */

function UserCard({ u, onMenu, services = [] }) {
  const meta = ROLE_META[u.role] || { bg: "#F1F5F9", color: "#475569" };
  const btnRef = useRef(null);

  const openMenu = () =>
    btnRef.current?.measureInWindow((x, y, w, h) => onMenu(u, { x, y, w, h }));
  return (
    <View style={styles.card}>
      <View style={[styles.roleClip, { backgroundColor: meta.bg }]}>
        <Text style={[styles.chipText, { color: meta.color }]}>{u.role}</Text>
      </View>
      {u.profileImage ? (
        <Image source={{ uri: u.profileImage }} style={styles.avatar} />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: meta.bg,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: meta.color }]}>
            {(u.fullName || "?").trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {u.fullName}
        </Text>
        {!!u.email && (
          <Text style={styles.meta} numberOfLines={1}>
            {u.email}
          </Text>
        )}
        {/* {!!u.phone && (
          <Text style={styles.meta} numberOfLines={1}>
            {u.phone}
          </Text>
        )} */}
        {u.role === "Therapist" && (u.specialties || []).length > 0 && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 3,
            }}
          >
            {u.specialties.map((id) => {
              const s = services.find((x) => x.id === id);
              if (!s) return null;
              return (
                <View
                  key={id}
                  style={{
                    backgroundColor: s.bg,
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    textAlign: "center",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color: s.color,
                      fontSize: fontSize(11),
                      fontFamily: fonts.semiBold,
                    }}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {u.isActive === false && (
          <View style={[styles.chip, { backgroundColor: "#FEE2E2" }]}>
            <Text style={[styles.chipText, { color: "#B91C1C" }]}>
              Inactive
            </Text>
          </View>
        )}
      </View>

      <View ref={btnRef} collapsable={false}>
        <TouchableOpacity style={styles.menuBtn} onPress={openMenu} hitSlop={8}>
          <Feather name="more-vertical" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const Segmented = ({ options, value, onChange }) => (
  <View style={styles.segmentWrap}>
    {options.map((o) => {
      const on = value === o.value;
      return (
        <TouchableOpacity
          key={String(o.value)}
          style={[styles.segmentItem, on && styles.segmentItemOn]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const DetailRow = ({ label, value }) =>
  value === undefined || value === null || value === "" ? null : (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );

/* ---------- Add / Edit modal for Therapist + Admin ---------- */

function UserFormModal({
  visible,
  role,
  user,
  onClose,
  onSaved,
  services = [],
  insets
}) {
  const isEdit = !!user;
  const isTherapist = role === "Therapist";

  const [form, setForm] = useState({});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      isActive: user ? user.isActive !== false : true,
      specialty: user?.specialties?.[0] || "",
    });
    setPassword("");
    setConfirm("");
    setShowPw(false);
    setShowCpw(false);
  }, [visible, user, role]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (saving) return;
    const fullName = (form.fullName || "").trim();
    const email = (form.email || "").trim();
    const phone = (form.phone || "").trim();

    if (!fullName || !email || !phone) {
      return Alert.alert(
        "Validation Error",
        "Please fill in all required fields.",
      );
    }
    if (!EMAIL_RX.test(email)) {
      return Alert.alert(
        "Validation Error",
        "Please enter a valid email address.",
      );
    }
    if (!PHONE_RX.test(phone)) {
      return Alert.alert(
        "Validation Error",
        "Phone number must be in 03011234567 or +923011234567 format.",
      );
    }
    if (!isEdit && (!password || !confirm)) {
      return Alert.alert("Error", "Please enter and confirm the password.");
    }
    if (isEdit && (password || confirm) && (!password || !confirm)) {
      return Alert.alert(
        "Error",
        "Please fill both password fields, or leave both blank.",
      );
    }
    if (password && !PASSWORD_RX.test(password)) {
      return Alert.alert(
        "Validation Error",
        "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
      );
    }
    if (password && password !== confirm) {
      return Alert.alert(
        "Error",
        "Password and Confirm Password do not match.",
      );
    }

    setSaving(true);
    try {
      if (isTherapist) {
        const payload = {
          name: fullName,
          email,
          specialty: form.specialty,
          phone,
          address: (form.address || "").trim(),
          isActive: form.isActive,
          ...(password && { password }),
        };
        if (isEdit) await updateTherapist(user._id, payload);
        else await createTherapist(payload);
      } else {
        const payload = {
          fullName,
          email,
          phone,
          isActive: form.isActive,
          ...(password && { password }),
        };
        if (isEdit) await updateAdmin(user._id, payload);
        else await createAdmin(payload);
      }
      onSaved();
    } catch (e) {
      Alert.alert(
        "Error",
        e?.response?.data?.message ||
          `Could not ${isEdit ? "update" : "create"} this ${role.toLowerCase()}. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
  };
  const generatePassword = () => {
      const length = 12;
      const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const lowercase = "abcdefghijkmnopqrstuvwxyz";
      const numbers = "23456789";
      const symbols = "!@#$%&*";
  
      const allChars = uppercase + lowercase + numbers + symbols;
  
      
      const getRandomChar = (chars) =>
        chars[Math.floor(Math.random() * chars.length)];
  
      const requiredChars = [
        getRandomChar(uppercase),
        getRandomChar(lowercase),
        getRandomChar(numbers),
        getRandomChar(symbols),
      ];
  
      const remainingChars = Array.from(
        { length: length - requiredChars.length },
        () => getRandomChar(allChars)
      );
  
      const passwordArray = [...requiredChars, ...remainingChars];
  
      for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [passwordArray[i], passwordArray[j]] = [
          passwordArray[j],
          passwordArray[i],
        ];
      }
  
      const newPassword = passwordArray.join("");
  
      setPassword(newPassword);
      setConfirm(newPassword);
    };
  
    const copyPassword = async () => {
      if (!password) {
        Alert.alert("Error", "Generate a password first.");
        return;
      }
  
      try {
        await Share.share({
          message: password,
        });
      } catch (error) {
        Alert.alert("Error", "Unable to share password.");
      }
    };

  const req = <Text style={{ color: "red" }}>*</Text>;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      style={{paddingBottom:insets.bottom}}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {isEdit ? `Edit ${role}` : `Add ${role}`}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <Text style={styles.fieldLabel}>Full Name {req}</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
                value={form.fullName}
                onChangeText={(t) => set("fullName", t)}
              />
              {isTherapist && (
                <>
                  <Text style={styles.fieldLabel}>Specialty</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      marginVertical: 6,
                    }}
                  >
                    {services.map((item) => {
                      const selected = form.specialty === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => set("specialty", item.id)}
                          style={[
                            {
                              backgroundColor: item.bg,
                              paddingHorizontal: 15,
                              paddingVertical: 5,
                              borderRadius: 24,
                            },
                            selected && {
                              borderWidth: 2,
                              borderColor: "#0B4A6F",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: item.color,
                              fontSize: fontSize(12),
                              fontFamily: fonts.bold,
                            }}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              <Text style={styles.fieldLabel}>Email {req}</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(t) => set("email", t)}
              />

              <Text style={styles.fieldLabel}>Phone {req}</Text>
              <TextInput
                style={styles.input}
                placeholder="03011234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(t) => set("phone", t)}
              />

              {isTherapist && (
                <>
                  <Text style={styles.fieldLabel}>Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Address"
                    placeholderTextColor="#94A3B8"
                    value={form.address}
                    onChangeText={(t) => set("address", t)}
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>
                {isEdit ? "New Password" : "Password"} {!isEdit && req}
              </Text>
              {isEdit && (
                <Text style={styles.helper}>
                  Leave blank to keep the current password.
                </Text>
              )}
              <View style={styles.pwBox}>
                <TextInput
                  style={styles.pwInput}
                  secureTextEntry={!showPw}
                  placeholder={isEdit ? "Enter new password" : "Enter password"}
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)}>
                  <Feather
                    name={showPw ? "eye" : "eye-off"}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>
                {isEdit ? "Confirm New Password" : "Confirm Password"}{" "}
                {!isEdit && req}
              </Text>
              <View style={styles.pwBox}>
                <TextInput
                  style={styles.pwInput}
                  secureTextEntry={!showCpw}
                  placeholder="Confirm password"
                  placeholderTextColor="#94A3B8"
                  value={confirm}
                  onChangeText={setConfirm}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCpw((v) => !v)}>
                  <Feather
                    name={showCpw ? "eye" : "eye-off"}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.passwordButton}>
                <TouchableOpacity
                  style={[
                    styles.passwordSubButton,
                    { backgroundColor: "#0B4A6F" },
                  ]}
                  onPress={generatePassword}
                >
                  <Text style={styles.passwordButtonText}>
                    Generate Password
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.passwordSubButton, { borderColor: "#0B4A6F" }]}
                  onPress={copyPassword}
                >
                  <Text
                    style={[styles.passwordButtonText, { color: "#0B4A6F" }]}
                  >
                    Copy
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Status</Text>
              <Segmented
                options={[
                  { label: "Active", value: true },
                  { label: "Inactive", value: false },
                ]}
                value={form.isActive ?? true}
                onChange={(v) => set("isActive", v)}
              />
            </ScrollView>

            <View style={styles.stickyFooter}>
              <TouchableOpacity
                style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {isEdit ? "Save Changes" : `Save ${role}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Screen ---------- */

export default function AllUsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [services, setServices] = useState([]);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const [items, setItems] = useState([]);
  const [roleCounts, setRoleCounts] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // filter modal
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftRole, setDraftRole] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");

  // add menu / card menu / details / form
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [actionUser, setActionUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [form, setForm] = useState({
    visible: false,
    role: "Therapist",
    user: null,
  });

  const requestRef = useRef(0);

  const activeFilterCount =
    (role !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    (async () => {
      try {
        const res = await getServices({ search: "" });
        setServices((res?.data || []).filter((s) => s.isActive === true));
      } catch (e) {
        console.log("Failed to load services:", e);
      }
    })();
  }, []);

  const load = useCallback(
    async (pageNum = 1, mode = "reset") => {
      const id = ++requestRef.current;
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "reset") setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await getAllUsers({
          page: pageNum,
          limit: LIMIT,
          search: query,
          role,
          status,
        });
        if (id !== requestRef.current) return;

        if (!res?.success) {
          Alert.alert("Error", res?.message || "Could not load users.");
          return;
        }
        setRoleCounts(res.roleCounts || {});
        setHasMore(!!res.hasMore);
        setPage(pageNum);
        setItems((prev) => {
          if (mode !== "more") return res.data || [];
          const seen = new Set(prev.map((x) => x._id));
          return [...prev, ...(res.data || []).filter((x) => !seen.has(x._id))];
        });
      } catch (e) {
        if (id === requestRef.current) {
          Alert.alert(
            "Error",
            e?.response?.data?.message || "Could not load users.",
          );
        }
      } finally {
        if (id === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [query, role, status],
  );

  // mount, filter change, and returning from ChildForm
  useFocusEffect(
    useCallback(() => {
      load(1, "reset");
    }, [load]),
  );

  const onEndReached = () => {
    if (hasMore && !loading && !loadingMore && !refreshing) {
      load(page + 1, "more");
    }
  };

  const countFor = (id) =>
    id === "all"
      ? Object.values(roleCounts).reduce((a, b) => a + b, 0)
      : roleCounts[id] || 0;

  /* filter modal */
  const openFilter = () => {
    setDraftRole(role);
    setDraftStatus(status);
    setFilterOpen(true);
  };
  const applyFilter = () => {
    setRole(draftRole);
    setStatus(draftStatus);
    setFilterOpen(false);
  };
  const resetFilter = () => {
    setDraftRole("all");
    setDraftStatus("all");
  };

  /* add flow */
  const onAdd = (r) => {
    setAddMenuOpen(false);
    if (r === "Child") navigation.navigate("ChildForm", { screen: "allUser" });
    else setForm({ visible: true, role: r, user: null });
  };

  const { width: winW, height: winH } = useWindowDimensions();
  const [menu, setMenu] = useState(null);

  const MENU_ITEM_H = 44;

  const openMenu = (u, r) => {
    const manageable = ["Child", "Therapist", "Admin"].includes(u.role);
    const menuH = (manageable ? 3 : 1) * MENU_ITEM_H + 12;
    const below = r.y + r.h + 4;
    const fitsBelow = below + menuH < winH - insets.bottom - 70;
    setMenu({
      user: u,
      top: fitsBelow ? below : Math.max(r.y - menuH - 4, insets.top + 8),
      right: Math.max(winW - (r.x + r.w), 8),
    });
  };
  const closeMenu = () => setMenu(null);

  const onView = () => {
    setDetailUser(menu?.user);
    closeMenu();
  };

  const onEdit = () => {
    const u = menu?.user;
    closeMenu();
    if (!u) return;
    if (u.role === "Child") {
      navigation.navigate("ChildForm", { child: toChildParam(u) });
    } else setForm({ visible: true, role: u.role, user: u });
  };
  const closeForm = () => setForm((p) => ({ ...p, visible: false }));

  const onDelete = () => {
    const u = menu?.user;
    closeMenu();
    if (!u) return;
    Alert.alert(
      `Delete ${u.role}`,
      `Remove ${u.fullName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => doDelete(u) },
      ],
    );
  };

  const doDelete = async (u) => {
    try {
      let res;
      if (u.role === "Child") res = await deleteChild(u._id);
      else if (u.role === "Therapist") res = await deleteTherapist(u._id);
      else res = await deleteAdmin(u._id);

      const body = res?.data ?? res;
      // therapist/child with past records are deactivated instead of deleted
      if (body?.deactivated || body?.deleted === false) {
        Alert.alert(
          "Marked Inactive",
          body?.message ||
            "This user has past records, so they were marked inactive instead of deleted.",
        );
      }
      load(1, "reset");
    } catch (e) {
      Alert.alert(
        "Cannot Delete",
        e?.response?.data?.message ||
          e?.message ||
          "Could not delete this user. Please try again.",
      );
    }
  };
  const onSaved = () => {
    closeForm();
    load(1, "reset");
  };

  return (
    <View style={[commonStyles.container]}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email or phone..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={openFilter}
          activeOpacity={0.8}
        >
          <Feather name="sliders" size={fontSize(20)} color="#0B4A6F" />
          {activeFilterCount > 0 && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <UserCard u={item} onMenu={openMenu} services={services} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(1, "refresh")}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={34} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {query ? "No matches found" : "No users found"}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginVertical: 14 }}
              />
            ) : null
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab]}
        onPress={() => setAddMenuOpen(true)}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={fontSize(24)} color="#fff" />
      </TouchableOpacity>

      {/* Filter modal */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setFilterOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter Users</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Role</Text>
            <View style={styles.wrap}>
              {ROLE_FILTERS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.filterChip,
                    draftRole === r.id && styles.filterChipOn,
                  ]}
                  onPress={() => setDraftRole(r.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      draftRole === r.id && styles.filterTextOn,
                    ]}
                  >
                    {r.label} · {countFor(r.id)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.wrap}>
              {STATUS_FILTERS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.filterChip,
                    draftStatus === s.id && styles.filterChipOn,
                  ]}
                  onPress={() => setDraftStatus(s.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      draftStatus === s.id && styles.filterTextOn,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilter}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilter}>
                <Text style={styles.primaryBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add options */}
      <Modal
        visible={addMenuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAddMenuOpen(false)}
        
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setAddMenuOpen(false)}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add New</Text>
              <TouchableOpacity onPress={() => setAddMenuOpen(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            {[
              { r: "Child", icon: "smile", label: "Add Child" },
              { r: "Therapist", icon: "user-check", label: "Add Therapist" },
              { r: "Admin", icon: "shield", label: "Add Admin" },
            ].map((o) => (
              <TouchableOpacity
                key={o.r}
                style={styles.optionRow}
                onPress={() => onAdd(o.r)}
              >
                <View
                  style={[
                    styles.optionIcon,
                    { backgroundColor: ROLE_META[o.r].bg },
                  ]}
                >
                  <Feather
                    name={o.icon}
                    size={18}
                    color={ROLE_META[o.r].color}
                  />
                </View>
                <Text style={styles.optionText}>{o.label}</Text>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Card action sheet */}
      <Modal
        visible={!!menu}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeMenu}
        >
          {menu && (
            <View
              style={[styles.dropdown, { top: menu.top, right: menu.right }]}
            >
              <TouchableOpacity style={styles.dropdownItem} onPress={onView}>
                <Feather name="eye" size={15} color="#334155" />
                <Text style={styles.dropdownText}>View</Text>
              </TouchableOpacity>

              {["Child", "Therapist", "Admin"].includes(menu.user.role) && (
                <>
                  <TouchableOpacity
                    style={[styles.dropdownItem, styles.dropdownDivider]}
                    onPress={onEdit}
                  >
                    <Feather name="edit-2" size={15} color="#334155" />
                    <Text style={styles.dropdownText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dropdownItem, styles.dropdownDivider]}
                    onPress={onDelete}
                  >
                    <Feather name="trash-2" size={15} color="#EF4444" />
                    <Text style={[styles.dropdownText, { color: "#EF4444" }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Details modal */}
      <Modal
        visible={!!detailUser}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailUser(null)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setDetailUser(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>User Details</Text>
              <TouchableOpacity onPress={() => setDetailUser(null)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            {detailUser && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <DetailRow label="Name" value={detailUser.fullName} />
                <DetailRow label="Role" value={detailUser.role} />
                <DetailRow
                  label="Specialty"
                  value={(detailUser.specialties || [])
                    .map((id) => services.find((s) => s.id === id)?.label)
                    .filter(Boolean)
                    .join(", ")}
                />
                <DetailRow label="Email" value={detailUser.email} />
                <DetailRow label="Phone" value={detailUser.phone} />
                <DetailRow label="Address" value={detailUser.address} />
                <DetailRow
                  label="Status"
                  value={detailUser.isActive === false ? "Inactive" : "Active"}
                />
                {detailUser.role === "Child" && (
                  <>
                    <DetailRow label="Parent" value={detailUser.fatherName} />
                    <DetailRow
                      label="Parent CNIC"
                      value={detailUser.fatherCnic}
                    />
                    <DetailRow label="Age" value={detailUser.age} />
                    <DetailRow label="Gender" value={detailUser.gender} />
                    <DetailRow label="Diagnosis" value={detailUser.diagnosis} />
                    <DetailRow
                      label="Package"
                      value={detailUser.packageId?.name}
                    />
                  </>
                )}
                <DetailRow
                  label="Joined"
                  value={
                    detailUser.createdAt
                      ? new Date(detailUser.createdAt).toLocaleDateString()
                      : ""
                  }
                />
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Therapist / Admin add-edit */}
      <UserFormModal
        visible={form.visible}
        role={form.role}
        user={form.user}
        onClose={closeForm}
        services={services}
        onSaved={onSaved}
        insets={insets}

      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: wp(12),
    paddingHorizontal: wp(12),
    height: hp(50),
  },
  searchInput: { flex: 1, fontSize: fontSize(14), color: "#0F172A" },
  filterBtn: {
    width: wp(50),
    height: hp(50),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  listContent: { padding: 16, paddingBottom: hp(20), flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    position: "relative",
  },
  roleClip: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: wp(3),
    borderTopEndRadius: wp(16),
    borderBottomStartRadius: wp(16),
    paddingHorizontal: wp(10),
  },
  avatar: { width: wp(46), height: hp(46), borderRadius: wp(999) },
  avatarText: {
    fontSize: fontSize(18),
    fontFamily: fonts.semiBold,
    lineHeight: 24,
  },
  name: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  meta: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 2,
  },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: {
    fontSize: fontSize(10),
    fontFamily: fonts.medium,
    lineHeight: 14,
  },
  menuBtn: { padding: 4 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 6 },
  emptyTitle: {
    fontSize: fontSize(15),
    fontFamily: fonts.semiBold,
    color: "#334155",
    marginTop: 6,
  },

  fab: {
    position: "absolute",
    right: 10,
    bottom: 15,
    width: wp(56),
    height: hp(56),
    borderRadius: wp(16),
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#0d162b",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },

  /* modals */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    fontSize: fontSize(18),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  sectionTitle: {
    fontSize: fontSize(13),
    fontFamily: fonts.bold,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 10,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  filterText: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#475569",
  },
  filterTextOn: { color: "#FFFFFF" },
  filterFooter: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  resetBtn: {
    flex: 1,
    height: wp(48),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: fontSize(14),
    fontFamily: fonts.bold,
    color: "#475569",
  },
  applyBtn: {
    flex: 2,
    height: wp(48),
    borderRadius: 14,
    backgroundColor: "#0B4A6F",
    alignItems: "center",
    justifyContent: "center",
  },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  optionIcon: {
    width: wp(38),
    height: hp(38),
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailLabel: {
    fontSize: fontSize(13),
    fontFamily: fonts.bold,
    color: "#64748B",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: fontSize(14),
    color: "#0F172A",
  },

  /* form */
  fieldLabel: {
    fontSize: fontSize(13),
    fontFamily: fonts.bold,
    color: "#475569",
    marginBottom: 6,
    marginTop: 14,
  },
  helper: { fontSize: fontSize(11), color: "#64748B", marginBottom: 6 },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: hp(50),
    fontSize: fontSize(14),
    color: "#0F172A",
  },
  pwBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: hp(50),
  },
  pwInput: { flex: 1, fontSize: fontSize(14), color: "#0F172A" },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: hp(40),
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemOn: { backgroundColor: "#0B4A6F" },
  segmentText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#475569",
  },
  segmentTextOn: { color: "#FFFFFF" },
  stickyFooter: {
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  primaryBtn: {
    backgroundColor: "#0B4A6F",
    borderRadius: 14,
    paddingVertical: hp(14),
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: fontSize(14), fontFamily: fonts.semiBold,lineHeight:18 },
  dropdown: {
    position: "absolute",
    width: wp(120),
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 6,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  dropdownItem: {
    height: hp(40),
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  dropdownDivider: { borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  dropdownText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#334155",
  },
  passwordButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  passwordSubButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#0B4A6F",
  },
  passwordButtonText: {
    fontSize: fontSize(13),
    color: "#fff",
  },
});
