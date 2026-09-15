import React, { useState } from 'react';

import {
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

const INVOICES = [
  {
    id: "1",
    parentName: "Zainab Ahmed",
    childName: "Ali Ahmed",
    invoiceNumber: "INV-2023-089",
    amount: "PKR 12,500",
    status: "Paid",
    icon: "file-text",
    iconBg: "#EBF3F9",
    iconColor: "#0B4A6F",
  },
  {
    id: "2",
    parentName: "Omar Farooq",
    childName: "Sarah Farooq",
    invoiceNumber: "INV-2023-094",
    amount: "PKR 24,000",
    status: "Overdue",
    icon: "alert-triangle",
    iconBg: "#FDF2F2",
    iconColor: "#C53030",
  },
];

const STATUS_OPTIONS = ["All Statuses", "Paid", "Overdue", "Pending"];

export default function InvoiceManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);

  const handleSelectStatus = (status) => {
    setSelectedStatus(status);
    setIsStatusModalVisible(false);
  };

  const filteredInvoices = INVOICES.filter((invoice) => {
    const matchesSearch = invoice.parentName.toLowerCase().includes(searchQuery.toLowerCase())
      || invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === "All Statuses" || invoice.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <SafeAreaView style={[styles.container, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar navigation={navigation} headerTitle={"Back to dashboard"} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Invoice Management</Text>
        <Text style={styles.introDescription}>
          Oversee billing, track collections, and manage child session payments.
        </Text>

        <TouchableOpacity
          style={styles.createBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("CreateNewInvoice")}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create New Invoice</Text>
        </TouchableOpacity>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TOTAL REVENUE (OCT)</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricValuePrimary}>PKR 450,200</Text>
            <View style={styles.badgeSuccessLight}>
              <Text style={styles.badgeSuccessText}>↑12%</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>OUTSTANDING</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricValueDanger}>PKR 82,400</Text>
            <Text style={styles.metricSubtext}>18 Invoices</Text>
          </View>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>COLLECTED</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricValueSuccess}>PKR 367,800</Text>
            <View style={styles.badgeSuccessLight}>
              <Text style={styles.badgeSuccessText}>82%</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.searchBarContainer}>
            <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search parent name, invoice ID..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterRow}>
            {/* Status Dropdown Button */}
            <TouchableOpacity
              style={styles.dropdownFilter}
              onPress={() => setIsStatusModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownFilterText}>{selectedStatus}</Text>
              <Feather name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.tuneButton}>
              <Feather name="sliders" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {filteredInvoices.map((item) => (
          <View key={item.id} style={styles.invoiceCard}>
            <View style={styles.invoiceHeaderRow}>
              <View style={[styles.invoiceIconContainer, { backgroundColor: item.iconBg }]}>
                <Feather name={item.icon} size={18} color={item.iconColor} />
              </View>

              <View style={styles.invoiceTextContainer}>
                <Text style={styles.parentName}>{item.parentName}</Text>
                <Text style={styles.childSubtitle}>
                  Child: {item.childName} • {item.invoiceNumber}
                </Text>
              </View>
            </View>

            <View style={styles.amountStatusRow}>
              <View>
                <Text style={styles.amountLabel}>AMOUNT</Text>
                <Text style={styles.amountValue}>{item.amount}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  item.status === "Paid" ? styles.statusPaid : styles.statusOverdue,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    item.status === "Paid" ? styles.statusPaidText : styles.statusOverdueText,
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {item.status === "Paid"
                ? (
                  <>
                    <TouchableOpacity style={styles.iconCircleBtn}>
                      <Feather name="eye" size={16} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconCircleBtn}>
                      <Feather name="upload" size={16} color="#475569" />
                    </TouchableOpacity>
                  </>
                )
                : (
                  <TouchableOpacity style={styles.remindBtn}>
                    <Feather name="mail" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.remindBtnText}>Remind</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={isStatusModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsStatusModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsStatusModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Filter by Status</Text>
                {STATUS_OPTIONS.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={styles.modalOption}
                    onPress={() => handleSelectStatus(status)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        selectedStatus === status && styles.modalOptionTextSelected,
                      ]}
                    >
                      {status}
                    </Text>
                    {selectedStatus === status && <Feather name="check" size={18} color={colors.primary} />}
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
    paddingBottom: 28,
  },

  screenTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 36,
    marginBottom: 5,
  },
  introDescription: {
    fontSize: 16,
    color: colors.blackFont,
    lineHeight: 20,
    fontFamily: fonts.regular,
    marginBottom: 20,
  },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
    gap: 8,
    width: 210,
  },
  createBtnText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    lineHeight: 20,
  },

  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  metricLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    letterSpacing: 0.5,
    marginBottom: 8,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricValuePrimary: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 40,
  },
  metricValueDanger: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: "#BA1A1A",
    lineHeight: 40,
  },
  metricValueSuccess: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: "#006B58",
    lineHeight: 40,
  },
  metricSubtext: {
    fontSize: 16,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  badgeSuccessLight: {
    backgroundColor: "rgba(139,246,217,.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSuccessText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#00725E",
  },

  filterSection: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 24,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  dropdownFilter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  dropdownFilterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  tuneButton: {
    width: 46,
    height: 46,
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  invoiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  invoiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  invoiceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  invoiceTextContainer: {
    flex: 1,
  },
  parentName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
    color: "#181C1E",
  },
  childSubtitle: {
    fontSize: 10,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 24,
  },

  amountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: "#C1C7D2",
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    lineHeight: 20,
    color: "#00497B",
  },

  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPaid: {
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  statusPaidText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: "#181C1E",
  },
  statusOverdue: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFFFF",
  },
  statusOverdueText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: "#181C1E",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  remindBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BA1A1A",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  remindBtnText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    color: "#FFFFFF",
  },

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
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "#334155",
  },
  modalOptionTextSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
});
