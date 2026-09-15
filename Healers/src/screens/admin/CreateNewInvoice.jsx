import React, { useState } from 'react';

import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const PACKAGE_OPTIONS = [
  "Behavioral Therapy - Basic",
  "Speech Therapy - Standard",
  "Occupational Therapy - Premium",
];

export default function CreateNewInvoiceScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [parentName, setParentName] = useState("Zainab Ahmed");
  const [invoiceDate, setInvoiceDate] = useState("11/24/2023");
  const [dueDate, setDueDate] = useState("12/01/2023");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-2023-0842");

  const [items, setItems] = useState([
    {
      id: "1",
      package: "Behavioral Therapy - Basic",
      sessions: "10",
      rate: "150",
      discount: "0",
    },
  ]);

  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        package: "Behavioral Therapy - Basic",
        sessions: "1",
        rate: "0",
        discount: "0",
      },
    ]);
  };

  const handleRemoveItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const openPackageDropdown = (index) => {
    setActiveItemIndex(index);
    setIsDropdownVisible(true);
  };

  const selectPackage = (option) => {
    if (activeItemIndex !== null) {
      handleItemChange(activeItemIndex, "package", option);
    }
    setIsDropdownVisible(false);
    setActiveItemIndex(null);
  };

  const subtotal = items.reduce((sum, item) => {
    const count = parseFloat(item.sessions) || 0;
    const rateVal = parseFloat(item.rate) || 0;
    const discVal = parseFloat(item.discount) || 0;
    const base = count * rateVal;
    const itemTotal = base - base * (discVal / 100);
    return sum + itemTotal;
  }, 0);

  const tax = subtotal * 0.05;
  const totalAmount = subtotal + tax;

  return (
    <SafeAreaView style={[styles.container, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar navigation={navigation} headerTitle={"Create New Invoice"} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="user-check" size={18} color={colors.primary} />
            <Text style={styles.cardHeaderTitle}>Client Selection</Text>
          </View>

          <Text style={styles.inputLabel}>Select Parent</Text>
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={parentName}
              onChangeText={setParentName}
              placeholder="Search parent..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.childCard}>
            <Image
              source={{ uri: "https://avatar.iran.liara.run/public/boy" }}
              style={styles.avatar}
            />
            <View style={styles.childInfo}>
              <Text style={styles.childName}>Ali Ahmed</Text>
              <Text style={styles.childSubtext}>Child associated with Zainab</Text>
            </View>
            <Feather name="check-circle" size={20} color={colors.blackFont} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="file-text" size={18} color={colors.primary} />
            <Text style={styles.cardHeaderTitle}>Billing Details</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>Invoice Date</Text>
              <TextInput
                style={styles.textInput}
                value={invoiceDate}
                onChangeText={setInvoiceDate}
              />
            </View>

            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>Due Date</Text>
              <TextInput
                style={styles.textInput}
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Invoice Number</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="shopping-bag" size={18} color={colors.primary} />
            <Text style={styles.cardHeaderTitle}>Services & Items</Text>
          </View>

          {items.map((item, index) => (
            <View key={item.id} style={styles.itemBox}>
              <TouchableOpacity
                style={styles.removeIconBtn}
                onPress={() => handleRemoveItem(item.id)}
              >
                <Feather name="x" size={14} color="#E11D48" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Service Package</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => openPackageDropdown(index)}
              >
                <Text style={styles.dropdownText}>{item.package}</Text>
                <Feather name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.itemRow}>
                <View style={styles.itemCol}>
                  <Text style={styles.inputLabel}>Sessions</Text>
                  <TextInput
                    style={styles.textInputCenter}
                    value={item.sessions}
                    keyboardType="numeric"
                    onChangeText={(v) => handleItemChange(index, "sessions", v)}
                  />
                </View>

                <View style={styles.itemCol}>
                  <Text style={styles.inputLabel}>Rate ($)</Text>
                  <TextInput
                    style={styles.textInputCenter}
                    value={item.rate}
                    keyboardType="numeric"
                    onChangeText={(v) => handleItemChange(index, "rate", v)}
                  />
                </View>

                <View style={styles.itemCol}>
                  <Text style={styles.inputLabel}>Disc (%)</Text>
                  <TextInput
                    style={styles.textInputCenter}
                    value={item.discount}
                    keyboardType="numeric"
                    onChangeText={(v) => handleItemChange(index, "discount", v)}
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
            <Feather name="plus-circle" size={18} color="#00497B" />
            <Text style={styles.addItemBtnText}>Add Another Item</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (VAT 5%)</Text>
            <Text style={styles.summaryValue}>
              {tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryTotalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>
              {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.draftBtn} activeOpacity={0.8}>
          <Text style={styles.draftBtnText}>Save as Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.generateBtn}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate("InvoiceDetail", {
              invoiceData: {
                invoiceNumber,
                parentName,
                subtotal,
                tax,
                totalAmount,
                items,
              },
            })}
        >
          <Feather name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.generateBtnText}>Generate & Send</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isDropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Service Package</Text>
                {PACKAGE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={styles.modalOption}
                    onPress={() => selectPackage(opt)}
                  >
                    <Text style={styles.modalOptionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BottomBar activeTab={"Home"} />
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
    paddingTop: 16,
    paddingBottom: 24,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 24,
  },

  inputLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    marginBottom: 6,
    lineHeight: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#181C1E",
    fontFamily: fonts.regular,
  },

  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 22,
    marginRight: 12,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 24,
  },
  childSubtext: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 16,
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  halfColumn: {
    flex: 1,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: "#0F172A",
    fontFamily: fonts.regular,
  },
  disabledInput: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
  },

  itemBox: {
    position: "relative",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  removeIconBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FFE4E6",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  dropdownText: {
    fontSize: 14,
    color: "#0F172A",
    fontFamily: fonts.regular,
  },
  itemRow: {
    flexDirection: "row",
    gap: 10,
  },
  itemCol: {
    flex: 1,
  },
  textInputCenter: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    height: 44,
    textAlign: "center",
    fontSize: 14,
    color: "#0F172A",
    fontFamily: fonts.regular,
  },

  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#00497B",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  addItemBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#00497B",
  },

  summaryCard: {
    backgroundColor: "#E8F1F8",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#475569",
    fontFamily: fonts.regular,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 10,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#00497B",
  },
  totalValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#00497B",
  },

  /* Action Buttons */
  draftBtn: {
    borderWidth: 1,
    borderColor: "#00497B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  draftBtnText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#00497B",
  },
  generateBtn: {
    flexDirection: "row",
    backgroundColor: "#00497B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: 14,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#334155",
  },
});
