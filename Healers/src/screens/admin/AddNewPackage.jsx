import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import {
  createPackage,
  getPackageById,
  updatePackage,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function AddNewPackageScreen({
  navigation,
  route,
}) {
  const packageId = route?.params?.packageId;
  const isEditMode = route?.params?.mode === "edit" && Boolean(packageId);

  const [packageName, setPackageName] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingPackage, setLoadingPackage] = useState(false);

  const fetchPackage = useCallback(async () => {
    if (!isEditMode) {
      return;
    }

    try {
      setLoadingPackage(true);

      const response = await getPackageById(packageId);

      if (!response?.success || !response?.data) {
        Alert.alert(
          "Error",
          response?.message || "Package not found.",
        );
        return;
      }

      setPackageName(response.data.name || "");
      setRate(
        response.data.price != null
          ? String(response.data.price)
          : "",
      );
    } catch (error) {
      console.log(
        "getPackageById error:",
        error?.response?.data || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to load package.",
      );
    } finally {
      setLoadingPackage(false);
    }
  }, [isEditMode, packageId]);

  useEffect(() => {
    fetchPackage();
  }, [fetchPackage]);

  const validateForm = () => {
    if (!packageName.trim()) {
      Alert.alert("Validation", "Package name is required.");
      return false;
    }

    const price = Number(rate);

    if (!rate.trim() || !Number.isFinite(price) || price <= 0) {
      Alert.alert("Validation", "Please enter a valid monthly rate.");
      return false;
    }

    return true;
  };

  const handleSavePackage = async () => {
    if (saving || !validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: packageName.trim(),
        type: "per-month",
        price: Number(rate),
      };

      const response = isEditMode
        ? await updatePackage(packageId, payload)
        : await createPackage(payload);

      if (response?.success) {
        Alert.alert(
          "Success",
          response.message
            || (isEditMode
              ? "Package updated successfully."
              : "Package created successfully."),
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    } catch (error) {
      console.log(
        isEditMode ? "updatePackage error:" : "createPackage error:",
        error?.response?.data || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || (isEditMode
            ? "Failed to update package."
            : "Failed to create package."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (isEditMode && loadingPackage) {
    return (
      <SafeAreaView style={[styles.container, commonStyles.container]}>
        <TopBar navigation={navigation} headerTitle="Edit Package" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading package...</Text>
        </View>

        <BottomBar activeTab="" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, commonStyles.container]}>
      <TopBar
        navigation={navigation}
        headerTitle={isEditMode ? "Edit Package" : "Add New Package"}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Package Name</Text>

          <TextInput
            style={styles.textInput}
            placeholder="e.g., Behavioral Therapy Basic"
            placeholderTextColor="#94A3B8"
            value={packageName}
            onChangeText={setPackageName}
          />

          <Text style={styles.inputLabel}>Monthly Rate (PKR)</Text>

          <View style={styles.rateInputContainer}>
            <Text style={styles.currencyPrefix}>Rs.</Text>

            <TextInput
              style={styles.rateTextInput}
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={rate}
              onChangeText={setRate}
            />

            <Text style={styles.rateSuffix}>/ month</Text>
          </View>

          <Text style={styles.helperText}>
            You can give a child a discounted price when you assign
            this package to them from the Children page.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              disabled={saving}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
              onPress={handleSavePackage}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : (
                  <>
                    <Feather
                      name={isEditMode ? "check" : "save"}
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />

                    <Text style={styles.saveBtnText}>
                      {isEditMode ? "Update Package" : "Save Package"}
                    </Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomBar activeTab="" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  inputLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.blackFont,
    lineHeight: 20,
    marginBottom: 6,
    marginTop: 4,
  },

  textInput: {
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 14,
    fontFamily: fonts.regular,
    height: 50,
  },

  rateInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 10,
  },

  currencyPrefix: {
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    marginRight: 8,
  },

  rateTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
    fontFamily: fonts.regular,
  },

  rateSuffix: {
    fontSize: 13,
    color: "#64748B",
    fontFamily: fonts.regular,
    marginLeft: 8,
  },

  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },

  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.blackFont,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 24,
  },

  saveBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtnDisabled: {
    opacity: 0.6,
  },

  saveBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#FFFFFF",
    lineHeight: 24,
  },
});