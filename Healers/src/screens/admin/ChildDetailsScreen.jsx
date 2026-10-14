import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";

import { colors, fonts } from "../../styles/theme";

const DOCUMENTS = [
  { key: "cnicFront", label: "CNIC Front", hint: "Parent CNIC, front side" },
  { key: "cnicBack", label: "CNIC Back", hint: "Parent CNIC, back side" },
  { key: "form", label: "Form", hint: "Admission form" },
  { key: "birthCertificate", label: "B.C", hint: "Birth certificate" },
  { key: "slc", label: "SLC", hint: "School leaving certificate" },
];

const formatDob = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
};

const formatCnic = (c = "") =>
  c.length === 13 ? `${c.slice(0, 5)}-${c.slice(5, 12)}-${c.slice(12)}` : c || "-";

const mimeOf = (doc) => {
  const type = String(doc?.type || "").toLowerCase();
  const name = String(doc?.name || "").toLowerCase();
  const url = String(doc?.url || "").split("?")[0].toLowerCase();

  if (
    type.includes("pdf") ||
    name.endsWith(".pdf") ||
    url.endsWith(".pdf")
  ) {
    return "application/pdf";
  }

  if (
    type.includes("png") ||
    name.endsWith(".png") ||
    url.endsWith(".png")
  ) {
    return "image/png";
  }

  if (
    type.includes("webp") ||
    name.endsWith(".webp") ||
    url.endsWith(".webp")
  ) {
    return "image/webp";
  }

  return "image/jpeg";
};

const extOf = (mime) => {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
};

async function downloadAndOpen(doc, onProgress) {
  if (!doc?.url) {
    throw new Error("Document URL is missing.");
  }

  const mime = mimeOf(doc);
  const dir = `${FileSystem.cacheDirectory}child-docs/`;

  await FileSystem.makeDirectoryAsync(dir, {
    intermediates: true,
  });

  const key = String(
    doc.publicId || doc.name || "file"
  ).replace(/[^a-zA-Z0-9_-]/g, "_");

  const fileUri = `${dir}${key}.${extOf(mime)}`;

  // Remove an existing cached file to avoid reusing
  // an incomplete or invalid download.
  await FileSystem.deleteAsync(fileUri, {
    idempotent: true,
  });

  const task = FileSystem.createDownloadResumable(
    doc.url,
    fileUri,
    {},
    (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress(
          p.totalBytesWritten / p.totalBytesExpectedToWrite
        );
      }
    }
  );

  const result = await task.downloadAsync();

  if (!result || result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(fileUri, {
      idempotent: true,
    });
    throw new Error(
      `Download failed. HTTP status: ${result?.status ?? "unknown"}`
    );
  }

  const info = await FileSystem.getInfoAsync(fileUri);

  if (!info.exists || !info.size) {
    await FileSystem.deleteAsync(fileUri, {
      idempotent: true,
    });

    throw new Error("The downloaded file is empty or missing.");
  }

  if (Platform.OS === "android") {
    const contentUri = await FileSystem.getContentUriAsync(fileUri);

    await IntentLauncher.startActivityAsync(
      "android.intent.action.VIEW",
      {
        data: contentUri,
        type: mime,
        flags: 1,
      }
    );
  } else {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("File sharing is not available on this device.");
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: mime,
      UTI: mime === "application/pdf"
        ? "com.adobe.pdf"
        : "public.image",
      dialogTitle: doc.name || "Open document",
    });
  }
}


const Row = ({ icon, label, value }) => (
  <View style={styles.row}>
    <Feather name={icon} size={16} color="#64748B" style={{ marginTop: 2 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "-"}</Text>
    </View>
  </View>
);

function DocCard({ label, hint, doc }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const open = async () => {
    if (busy || !doc?.url) return;
    setBusy(true);
    setProgress(0);
    try {
      await downloadAndOpen(doc, setProgress);
    } catch (e) {
      Alert.alert(
        "Could not open file",
        /activity|resolve|no app/i.test(e?.message || "")
          ? "No app found on this phone to open this file."
          : e?.message || "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.docCard}>
      <Text style={styles.docLabel}>{label}</Text>
      <Text style={styles.docHint}>{hint}</Text>

      {doc?.url ? (
        <TouchableOpacity style={styles.docFile} activeOpacity={0.8} onPress={open} disabled={busy}>
          {doc.type === "image" ? (
            <Image source={{ uri: doc.url }} style={styles.docThumb} />
          ) : (
            <View style={[styles.docThumb, styles.docThumbPdf]}>
              <MaterialCommunityIcons name="file-pdf-box" size={28} color="#DC2626" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.docName} numberOfLines={1}>
              {doc.name || label}
            </Text>
            <Text style={styles.docMeta}>
              {busy
                ? progress > 0
                  ? `Downloading ${Math.round(progress * 100)}%`
                  : "Downloading..."
                : "Tap to open"}
            </Text>
          </View>
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="download" size={20} color="#0B4A6F" />
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.docEmpty}>
          <Text style={styles.docEmptyText}>Not uploaded</Text>
        </View>
      )}
    </View>
  );
}

export default function ChildDetailsScreen({ navigation, route }) {
  const { child } = route.params;
  const active = child.isActive !== false;
  const hasDiscount = child.discountedPrice != null;

  return (
    <SafeAreaView style={styles.main}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Child Details</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("ChildForm", { child })}>
          <Feather name="edit-2" size={20} color="#0B4A6F" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{child.name?.trim()?.charAt(0)?.toUpperCase() || "?"}</Text>
          </View>
          <Text style={styles.name}>{child.name}</Text>
          <View style={[styles.badge, active ? styles.badgeOn : styles.badgeOff]}>
            <View style={[styles.dot, { backgroundColor: active ? "#16A34A" : "#EF4444" }]} />
            <Text style={[styles.badgeText, { color: active ? "#15803D" : "#DC2626" }]}>
              {active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Child</Text>
          <Row icon="calendar" label="Date of birth" value={formatDob(child.dateOfBirth)} />
          <Row icon="clock" label="Age" value={child.age != null ? `${child.age} ${child.age === 1 ? "year" : "years"}` : "-"} />
          <Row icon="user" label="Gender" value={child.gender} />
          <Row icon="file-text" label="Diagnosis" value={child.diagnosis} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parent</Text>
          <Row icon="user" label="Parent name" value={child.fatherName} />
          <Row icon="credit-card" label="Parent CNIC" value={formatCnic(child.fatherCnic)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>
          <Row icon="phone" label="Phone" value={child.phone} />
          <Row icon="mail" label="Email" value={child.email} />
          <Row icon="home" label="Address" value={child.address} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fee package</Text>
          {child.packageId ? (
            <>
              <Row icon="package" label="Package" value={child.packageName} />
              <Row
                icon="tag"
                label="Monthly fee"
                value={
                  hasDiscount
                    ? `PKR ${Number(child.packagePrice - child.discountedPrice).toLocaleString()} (was ${Number(child.packagePrice || 0).toLocaleString()})`
                    : `PKR ${Number(child.packagePrice || 0).toLocaleString()}`
                }
              />
            </>
          ) : (
            <Text style={styles.muted}>No package assigned.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Documents</Text>
        {DOCUMENTS.map((d) => (
          <DocCard key={d.key} label={d.label} hint={d.hint} doc={child.documents?.[d.key]} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary },
  content: { padding: 16, paddingBottom: 40 },

  hero: { alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#0B4A6F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 30, fontWeight: "700" },
  name: { marginTop: 10, fontSize: 20, fontFamily: fonts.semiBold, color: "#0F172A", textAlign: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOn: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  badgeOff: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontFamily: fonts.semiBold },

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
  cardTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: "#0B4A6F", marginBottom: 10 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 8 },
  rowLabel: { fontSize: 12, color: "#64748B" },
  rowValue: { fontSize: 14, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 2 },
  muted: { fontSize: 13, color: "#94A3B8" },

  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 6, marginBottom: 10 },
  docCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  docLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: "#0F172A" },
  docHint: { fontSize: 12, color: "#64748B", marginTop: 2, marginBottom: 10 },
  docFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  docThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#E2E8F0" },
  docThumbPdf: { alignItems: "center", justifyContent: "center", backgroundColor: "#FEE2E2" },
  docName: { fontSize: 13, fontWeight: "600", color: "#334155" },
  docMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  docEmpty: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  docEmptyText: { fontSize: 13, color: "#94A3B8" },
});