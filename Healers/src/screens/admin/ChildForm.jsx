import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  createChild,
  updateChild,
  getParents,
  getAllPackages,
  uploadChildDocument,
} from "../../api/admin/api";
import { colors, fonts } from "../../styles/theme";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload";

const PKG_LIMIT = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const GENDER_OPTIONS = [
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
];
const ACTIVE_OPTIONS = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
];
const DOCUMENTS = [
  { key: "cnicFront", label: "CNIC Front", hint: "Parent CNIC, front side" },
  { key: "cnicBack", label: "CNIC Back", hint: "Parent CNIC, back side" },
  { key: "form", label: "Form", hint: "Admission form" },
  { key: "birthCertificate", label: "B.C", hint: "Birth certificate" },
  { key: "slc", label: "SLC", hint: "School leaving certificate" },
];
const STEPS = [
  { n: 1, label: "Child" },
  { n: 2, label: "Contact & Fees" },
  { n: 3, label: "Documents" },
];
const LAST_STEP = STEPS.length;

const pad = (n) => String(n).padStart(2, "0");

const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fromYMD = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const calcAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
};

const formatDob = (d) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const buildInitialForm = (child) => ({
  name: child?.name || "",
  fatherCnic: child?.fatherCnic?.replace(/\D/g, "") || "",
  fatherName: child?.fatherName || "",
  dateOfBirth: fromYMD(child?.dateOfBirth),
  gender: child ? child.gender || "" : "Male",
  diagnosis: child?.diagnosis || "",
  address: child?.address || "",
  phone: child?.phone || "",
  email: child?.email || "",
  packageId: child?.packageId || null,
  discountedPrice:
    child?.discountedPrice != null ? String(child.discountedPrice) : "",
  isActive: child ? child.isActive !== false : true,
});


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

function DocumentSlot({ label, hint, value, onPick, onRemove }) {
  const isImage = value?.type === "image";
  const isPending = !!value?.pending;
  const previewUri = value?.url || value?.uri;

  const openFile = () => {
    if (isPending) return;
    Linking.openURL(value.url).catch(() =>
      Alert.alert("Error", "Could not open this file."),
    );
  };

  return (
    <View style={styles.docCard}>
      <View style={styles.docHeader}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docHint}>{hint}</Text>
      </View>

      {value ? (
        <View style={styles.docFile}>
          {isImage ? (
            <Image source={{ uri: previewUri }} style={styles.docThumb} />
          ) : (
            <View style={[styles.docThumb, styles.docThumbPdf]}>
              <MaterialCommunityIcons name="file-pdf-box" size={28} color="#DC2626" />
            </View>
          )}
          <TouchableOpacity style={{ flex: 1 }} onPress={openFile} disabled={isPending}>
            <Text style={styles.docName} numberOfLines={1}>
              {value.name || label}
            </Text>
            <Text style={[styles.docMeta, isPending && styles.docMetaPending]}>
              {isPending ? "Will upload when you save" : "Tap to view"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPick} hitSlop={8}>
            <Text style={styles.docActionText}>Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} hitSlop={8} style={{ marginLeft: 12 }}>
            <Feather name="x" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.docEmpty} onPress={onPick} activeOpacity={0.8}>
          <MaterialCommunityIcons name="file-upload-outline" size={28} color="#0B4A6F" />
          <Text style={styles.docEmptyText}>Take photo or upload</Text>
          <Text style={styles.docEmptySub}>Max 5 MB</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PackagePickerModal({ visible, selectedId, onClose, onSelect }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchResults = async (pageNum, term) => {
    const requestId = ++requestIdRef.current;
    const isFirst = pageNum === 1;

    if (isFirst) {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setLoading(true);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const res = await getAllPackages(pageNum, PKG_LIMIT, term.trim());
      if (requestId !== requestIdRef.current) return;

      if (res?.success) {
        const list = res.data || [];
        setResults((prev) =>
          isFirst
            ? list
            : [...prev, ...list.filter((i) => !prev.some((p) => p._id === i._id))],
        );
        setPage(pageNum);
        setHasMore(Boolean(res.hasMore));
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.log("Failed to fetch packages:", error);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  };

  useEffect(() => {
    if (visible) {
      setSearch("");
      setResults([]);
      setHasMore(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => fetchResults(1, search), 300);
    return () => clearTimeout(t);
  }, [search, visible]);

  const onEndReached = () => {
    if (loading || loadingMoreRef.current || !hasMore) return;
    fetchResults(page + 1, search);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Package</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerSearchBox}>
            <Feather name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search packages..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginVertical: 30 }}
            />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item._id)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>
                  {search ? "No packages match your search." : "No packages created yet."}
                </Text>
              }
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ marginVertical: 12 }}
                  />
                ) : null
              }
              renderItem={({ item }) => {
                const on = selectedId === item._id;
                return (
                  <TouchableOpacity
                    style={[styles.packageOption, on && styles.packageOptionOn]}
                    activeOpacity={0.8}
                    onPress={() => onSelect(item)}
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
  );
}

export default function ChildFormScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editingChild = route?.params?.child || null;
  const isEditMode = !!editingChild;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => buildInitialForm(editingChild));
  const [documents, setDocuments] = useState(() =>
    Object.fromEntries(DOCUMENTS.map((d) => [d.key, editingChild?.documents?.[d.key] || null])),
  );
  const [selectedPackage, setSelectedPackage] = useState(
    editingChild?.packageId
      ? {
          _id: editingChild.packageId,
          name: editingChild.packageName,
          price: editingChild.packagePrice,
        }
      : null,
  );
  const [isPackagePickerOpen, setIsPackagePickerOpen] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showDobPicker, setShowDobPicker] = useState(false);
  const [fetchingParent, setFetchingParent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saving...");

  const scrollRef = useRef(null);
  const parentRequestIdRef = useRef(0);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const age = useMemo(() => calcAge(form.dateOfBirth), [form.dateOfBirth]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 1) {
        setStep(step - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  useEffect(() => {
    if (isEditMode) return;

    const cleanCnic = (form.fatherCnic || "").replace(/\D/g, "");
    if (cleanCnic.length !== 13) {
      parentRequestIdRef.current += 1;
      setFetchingParent(false);
      return;
    }

    const currentRequestId = ++parentRequestIdRef.current;

    (async () => {
      setFetchingParent(true);
      try {
        const response = await getParents({ cnic: cleanCnic });
        if (currentRequestId !== parentRequestIdRef.current) return;

        const parentList = response?.data?.data || response?.data || [];
        const parent = Array.isArray(parentList) ? parentList[0] : parentList;
        setField("fatherName", parent?.parentName || "");
      } catch (error) {
        if (currentRequestId === parentRequestIdRef.current) {
          console.log("Parent fetch by CNIC error:", error);
          setField("fatherName", "");
        }
      } finally {
        if (currentRequestId === parentRequestIdRef.current) {
          setFetchingParent(false);
        }
      }
    })();
  }, [form.fatherCnic, isEditMode]);

  const onDobChange = (event, selected) => {
    if (Platform.OS === "android") setShowDobPicker(false);
    if (selected) setField("dateOfBirth", selected);
  };

  const handleSelectPackage = (pkg) => {
    setSelectedPackage({ _id: pkg._id, name: pkg.name, price: pkg.price });
    setForm((prev) => ({ ...prev, packageId: pkg._id, discountedPrice: "" }));
    setIsPackagePickerOpen(false);
  };

  const handleClearPackage = () => {
    setSelectedPackage(null);
    setForm((prev) => ({ ...prev, packageId: null, discountedPrice: "" }));
  };

  const setPendingDoc = (key, file, fallbackMime, fallbackExt) => {
    const name = file.name || file.fileName || `${key}-${Date.now()}.${fallbackExt}`;
    const mimeType = file.mimeType || fallbackMime;
    const size = file.size ?? file.fileSize;

    if (size && size > MAX_FILE_BYTES) {
      Alert.alert("File too large", "Max size is 10 MB.");
      return;
    }

    const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(name);
    setDocuments((prev) => ({
      ...prev,
      [key]: { pending: true, uri: file.uri, name, mimeType, size, type: isPdf ? "pdf" : "image" },
    }));
  };

  const pickFile = async (key) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setPendingDoc(key, result.assets[0], "image/jpeg", "jpg");
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not select this file.");
    }
  };

  const captureDocument = async (key) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission needed", "Allow camera access in phone settings to take a photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled) return;
      setPendingDoc(key, result.assets[0], "image/jpeg", "jpg");
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not open the camera.");
    }
  };

  const handlePickDocument = (key) =>
    Alert.alert("Add document", "How do you want to add it?", [
      { text: "Take photo", onPress: () => captureDocument(key) },
      { text: "Upload", onPress: () => pickFile(key) },
      { text: "Cancel", style: "cancel" },
    ]);

  const handleRemoveDocument = (key) =>
    setDocuments((prev) => ({ ...prev, [key]: null }));

  const fail = (message) => {
    Alert.alert("Validation Error", message);
    return false;
  };

  const validateChild = () => {
    if (!form.name.trim()) return fail("Please enter the child's full name.");

    if (!/^\d{13}$/.test(form.fatherCnic)) {
      return fail("Parent CNIC must be exactly 13 digits.");
    }
    if (!form.fatherName.trim()) return fail("Please enter the parent's name.");

    if (!form.dateOfBirth && !isEditMode) return fail("Please select the date of birth.");
    if (form.dateOfBirth && form.dateOfBirth > new Date()) {
      return fail("Date of birth cannot be in the future.");
    }
    if (!form.gender && !isEditMode) return fail("Please select a gender.");

    return true;
  };

  const validateContact = () => {
    if (!/^(03\d{9}|\+923\d{9})$/.test(form.phone.trim())) {
      return fail("Contact number must be in 03011234567 or +923011234567 format.");
    }

    const email = form.email.trim();
    if (!email) return fail("Email is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Please enter a valid email address.");

    if (form.packageId && form.discountedPrice !== "") {
      const dp = Number(form.discountedPrice);
      if (!Number.isFinite(dp) || dp <= 0) {
        return fail("Please enter a valid discounted price.");
      }
      if (selectedPackage?.price != null && dp >= selectedPackage.price) {
        return fail(
          `Discounted price must be less than the monthly rate (PKR ${Number(
            selectedPackage.price,
          ).toLocaleString()}).`,
        );
      }
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!isEditMode && (!password || !confirmPassword)) {
      return fail("Please enter password and confirm password.");
    }
    if (isEditMode && (password || confirmPassword) && (!password || !confirmPassword)) {
      return fail("Please fill both password fields, or leave both blank.");
    }
    if (password && !passwordRegex.test(password)) {
      return fail(
        "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
      );
    }
    if (password && password !== confirmPassword) {
      return fail("Password and Confirm Password do not match.");
    }
    return true;
  };

  const goToStep = (n) => {
    setStep(n);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleNext = () => {
    if (step === 1 && !validateChild()) return;
    if (step === 2 && !validateContact()) return;
    goToStep(Math.min(step + 1, LAST_STEP));
  };

  const handleBack = () => {
    if (step > 1) goToStep(step - 1);
    else navigation.goBack();
  };

  const handleSave = async () => {
    if (saving) return;

    if (!validateChild()) {
      goToStep(1);
      return;
    }
    if (!validateContact()) {
      goToStep(2);
      return;
    }

    try {
      setSaving(true);

      // 1. Upload only the documents that were picked but not uploaded yet.
      const finalDocuments = { ...documents };
      const pendingKeys = DOCUMENTS.map((d) => d.key).filter(
        (key) => documents[key]?.pending,
      );

      let done = 0;
      setSaveStatus(`Uploading 0/${pendingKeys.length}...`);

      try {
        await Promise.all(
          pendingKeys.map(async (key) => {
            const doc = documents[key];
            const uploaded = await uploadChildDocument({
              uri: doc.uri,
              name: doc.name,
              mimeType: doc.mimeType,
            });
            finalDocuments[key] = uploaded;
            setDocuments((prev) => ({ ...prev, [key]: uploaded }));
            done += 1;
            setSaveStatus(`Uploading ${done}/${pendingKeys.length}...`);
          }),
        );
      } catch (error) {
        Alert.alert(
          "Upload failed",
          error?.response?.data?.message || error?.message || "Could not upload the file.",
        );
        goToStep(3);
        return;
      }

      // 2. Save the child
      setSaveStatus("Saving...");

      const phone = form.phone.trim();
      const email = form.email.trim().toLowerCase();

      const payload = {
        fullName: form.name.trim(),
        fatherName: form.fatherName.trim(),
        fatherCnic: form.fatherCnic,
        ...(form.dateOfBirth && { dateOfBirth: toYMD(form.dateOfBirth) }),
        age: age ?? editingChild?.age ?? null,
        gender: form.gender || null,
        address: form.address || null,
        diagnosis: form.diagnosis.trim(),
        email: form.email.trim().toLowerCase(),
        phone: phone.startsWith("+92") ? "0" + phone.slice(3) : phone,
        ...(password && { password }),
        packageId: form.packageId || null,
        discountedPrice:
          form.packageId && form.discountedPrice !== ""
            ? Number(form.discountedPrice)
            : null,
        isActive: form.isActive,
        documents: Object.fromEntries(
          DOCUMENTS.map((d) => [d.key, finalDocuments[d.key] ?? null]),
        ),
      };
      if (isEditMode) {
        await updateChild(editingChild.id, payload);
      } else {
        await createChild(payload);
      }

      navigation.navigate("Children", { refresh: Date.now() });
    } catch (error) {
      console.log("Failed to save child:", error);
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          `Could not ${isEditMode ? "update" : "create"} this child. Please try again.`,
      );
    } finally {
      setSaving(false);
      setSaveStatus("Saving...");
    }
  };

  const renderSaveButton = (style, label) => (
    <TouchableOpacity
      style={[style, saving && { opacity: 0.6 }]}
      onPress={handleSave}
      disabled={saving}
      activeOpacity={0.85}
    >
      {saving ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{saveStatus}</Text>
        </View>
      ) : (
        <Text style={styles.primaryBtnText}>
          {label || (isEditMode ? "Save Changes" : "Save Child")}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderNextButton = () => (
    <TouchableOpacity
      style={styles.primaryBtn}
      onPress={handleNext}
      activeOpacity={0.85}
    >
      <Text style={styles.primaryBtnText}>Next</Text>
    </TouchableOpacity>
  );

  const renderBackButton = () => (
    <TouchableOpacity
      style={styles.outlineBtn}
      onPress={() => goToStep(step - 1)}
      disabled={saving}
      activeOpacity={0.85}
    >
      <Text style={styles.outlineBtnText}>Back</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.mainContainer} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={10}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "Edit Child" : "Add New Child"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.stepper}>
        {STEPS.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <React.Fragment key={s.n}>
              {i > 0 && <View style={[styles.stepLine, step >= s.n && styles.stepLineOn]} />}
              <TouchableOpacity
                style={styles.stepItem}
                activeOpacity={0.7}
                disabled={s.n >= step}
                onPress={() => goToStep(s.n)}
              >
                <View
                  style={[
                    styles.stepCircle,
                    (active || done) && styles.stepCircleOn,
                  ]}
                >
                  {done ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.stepNum, (active || done) && styles.stepNumOn]}>
                      {s.n}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.stepLabel, (active || done) && styles.stepLabelOn]}
                  numberOfLines={1}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.fieldLabelFirst}>
                Full Name <Text style={styles.requiredText}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Ayaan Khan"
                placeholderTextColor="#94A3B8"
                value={form.name}
                onChangeText={(t) => setField("name", t)}
              />

              <Text style={styles.fieldLabel}>
                Parent CNIC <Text style={styles.requiredText}>*</Text>
              </Text>
              <View style={styles.inputWithLoader}>
                <TextInput
                  style={styles.formInputFlex}
                  placeholder="e.g. 3520112345671"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={13}
                  value={form.fatherCnic}
                  onChangeText={(t) => setField("fatherCnic", t.replace(/\D/g, ""))}
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
                value={form.fatherName}
                onChangeText={(t) => setField("fatherName", t)}
              />

              <Text style={styles.fieldLabel}>
                Date of Birth{" "}
                {!isEditMode && <Text style={styles.requiredText}>*</Text>}
              </Text>
              <TouchableOpacity
                style={styles.selectorRow}
                activeOpacity={0.8}
                onPress={() => setShowDobPicker((v) => !v)}
              >
                <Text
                  style={[
                    styles.selectorText,
                    form.dateOfBirth && { color: "#0F172A" },
                  ]}
                >
                  {form.dateOfBirth ? formatDob(form.dateOfBirth) : "Select date of birth"}
                </Text>
                <Feather name="calendar" size={18} color="#475569" />
              </TouchableOpacity>
              {showDobPicker && (
                <>
                  <DateTimePicker
                    value={form.dateOfBirth || new Date(new Date().getFullYear() - 6, 0, 1)}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onValueChange={onDobChange}
                    onDismiss={() => setShowDobPicker(false)}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={styles.pickerDone}
                      onPress={() => setShowDobPicker(false)}
                    >
                      <Text style={styles.changeButtonText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <Text style={styles.fieldLabel}>Age</Text>
              <View style={[styles.formInput, styles.readOnlyBox]}>
                <Text style={styles.readOnlyText}>
                  {age != null
                    ? `${age} ${age === 1 ? "year" : "years"}`
                    : editingChild?.age != null
                      ? `${editingChild.age} years`
                      : "Calculated from date of birth"}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>
                Gender {!isEditMode && <Text style={styles.requiredText}>*</Text>}
              </Text>
              <SegmentedToggle
                options={GENDER_OPTIONS}
                value={form.gender ?? "Male"}
                onChange={(v) => setField("gender", v)}
              />

              <Text style={styles.fieldLabel}>Diagnosis</Text>
              <TextInput
                style={styles.textArea}
                placeholder="e.g. Speech delay, ADHD..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                value={form.diagnosis}
                onChangeText={(t) => setField("diagnosis", t)}
              />
            </View>
          )}

          {step === 2 && (
            <>
              <View style={styles.card}>
                <Text style={styles.fieldLabelFirst}>
                  Contact Number <Text style={styles.requiredText}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0300 1234567"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={form.phone}
                  onChangeText={(t) => setField("phone", t)}
                />

                <Text style={styles.fieldLabel}>Email <Text style={styles.requiredText}>*</Text></Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="parent@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.email}
                  onChangeText={(t) => setField("email", t)}
                />
                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="House 12, Street 3, Johar Town, Lahore"
                  placeholderTextColor="#94A3B8"
                  value={form.address}
                  onChangeText={(t) => setField("address", t)}
                />

                <Text style={styles.fieldLabel}>
                  {isEditMode ? "New Password" : "Password"}{" "}
                  {!isEditMode && <Text style={styles.requiredText}>*</Text>}
                </Text>
                {isEditMode && (
                  <Text style={styles.helperText}>
                    Leave blank to keep the current password.
                  </Text>
                )}
                <View style={styles.passwordBox}>
                  <TextInput
                    style={styles.passwordInput}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={isEditMode ? "Enter new password" : "Enter password"}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                    <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>
                  {isEditMode ? "Confirm New Password" : "Confirm Password"}{" "}
                  {!isEditMode && <Text style={styles.requiredText}>*</Text>}
                </Text>
                <View style={styles.passwordBox}>
                  <TextInput
                    style={styles.passwordInput}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={isEditMode ? "Confirm new password" : "Confirm password"}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword((v) => !v)}>
                    <Feather
                      name={showConfirmPassword ? "eye" : "eye-off"}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.fieldLabelFirst}>Fee Package (optional)</Text>
                {selectedPackage ? (
                  <View style={styles.selectedPackageCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageOptionName} numberOfLines={1}>
                        {selectedPackage.name}
                      </Text>
                      <Text style={styles.packageOptionPrice}>
                        PKR {Number(selectedPackage.price || 0).toLocaleString()}/mo
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsPackagePickerOpen(true)}
                      style={styles.changeButton}
                    >
                      <Text style={styles.changeButtonText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearPackage} style={{ padding: 4 }}>
                      <Feather name="x" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.selectorRow}
                    activeOpacity={0.8}
                    onPress={() => setIsPackagePickerOpen(true)}
                  >
                    <Feather name="search" size={16} color="#94A3B8" />
                    <Text style={[styles.selectorText, { marginLeft: 10 }]}>
                      Select a package
                    </Text>
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
                      value={form.discountedPrice}
                      onChangeText={(t) =>
                        setField("discountedPrice", t.replace(/[^0-9.]/g, ""))
                      }
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>Status</Text>
                <SegmentedToggle
                  options={ACTIVE_OPTIONS}
                  value={form.isActive}
                  onChange={(v) => setField("isActive", v)}
                />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.stepIntro}>
                Choose a photo or PDF for each document. Files are uploaded when you tap Save. You can
                also add them later by editing the child.
              </Text>
              {DOCUMENTS.map((doc) => (
                <DocumentSlot
                  key={doc.key}
                  label={doc.label}
                  hint={doc.hint}
                  value={documents[doc.key]}
                  onPick={() => handlePickDocument(doc.key)}
                  onRemove={() => handleRemoveDocument(doc.key)}
                />
              ))}
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 1 && (
            <>
              {isEditMode && renderSaveButton(styles.secondaryBtn)}
              {renderNextButton()}
            </>
          )}

          {step === 2 && (
            <>
              {renderBackButton()}
              {isEditMode && renderSaveButton(styles.secondaryBtn, "Save")}
              {renderNextButton()}
            </>
          )}

          {step === 3 && (
            <>
              {renderBackButton()}
              {renderSaveButton(styles.primaryBtn)}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <PackagePickerModal
        visible={isPackagePickerOpen}
        selectedId={selectedPackage?._id}
        onClose={() => setIsPackagePickerOpen(false)}
        onSelect={handleSelectPackage}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary },

  stepper: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
  },
  stepItem: { width: 96, alignItems: "center" },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleOn: { backgroundColor: "#0B4A6F" },
  stepNum: { fontSize: 13, fontFamily: fonts.semiBold, color: "#64748B" },
  stepNumOn: { color: "#FFFFFF" },
  stepLabel: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#94A3B8",
    textAlign: "center",
  },
  stepLabelOn: { color: "#0B4A6F" },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: 12,
    marginHorizontal: -34,
    backgroundColor: "#E2E8F0",
  },
  stepLineOn: { backgroundColor: "#0B4A6F" },

  scrollContent: { padding: 16, paddingBottom: 24 },
  stepIntro: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 14,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },

  requiredText: { color: "red" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    marginTop: 14,
  },
  fieldLabelFirst: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },
  helperText: { fontSize: 12, color: "#64748B", marginBottom: 6 },

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
  textArea: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    height: 90,
    fontSize: 14,
    color: "#0F172A",
  },
  inputWithLoader: {
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
  passwordBox: {
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

  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  selectorText: { flex: 1, fontSize: 14, color: "#94A3B8" },
  pickerDone: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 4 },
  readOnlyBox: { justifyContent: "center", backgroundColor: "#F1F5F9" },
  readOnlyText: { fontSize: 14, color: "#475569" },

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
  segmentItemOn: { backgroundColor: "#0B4A6F" },
  segmentText: { fontSize: 14, fontFamily: fonts.semiBold, color: "#475569" },
  segmentTextOn: { color: "#FFFFFF" },

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
  changeButton: { paddingHorizontal: 10, paddingVertical: 6 },
  changeButtonText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },

  docCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  docHeader: { marginBottom: 10 },
  docLabel: { fontSize: 16, fontFamily: fonts.semiBold, color: "#0F172A" },
  docHint: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  docEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F4F7",
    gap: 4,
  },
  docEmptyText: { fontSize: 14, fontFamily: fonts.regular, color: "#181C1E" },
  docEmptySub: { fontSize: 12, fontFamily: fonts.regular, color: "#64748B" },
  docFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  docThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#E2E8F0" },
  docThumbPdf: { alignItems: "center", justifyContent: "center", backgroundColor: "#FEE2E2" },
  docName: { fontSize: 13, fontWeight: "600", color: "#334155" },
  docMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  docActionText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },

  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  primaryBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0B4A6F",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: fonts.semiBold },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F58B2A",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { color: colors.primary, fontSize: 15, fontFamily: fonts.semiBold },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
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
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: "#0B4A6F" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B4A6F" },
  docMetaPending: { color: "#B45309" },
});