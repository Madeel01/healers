import React, {
  useCallback,
  useState,
} from 'react';

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import { getInvoiceByIdApi } from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  fonts,
} from '../../styles/theme';

const COMPANY = {
  name: "HEALERS INSTITUTION",
  address: "12-K, Gulberg III, Lahore",
};

const money = (value) => {
  return `PKR ${
    Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }`;
};

const dateText = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const durationText = (item) => {
  const quantity = Number(item.quantity) || 1;
  const unit = item.durationUnit || "session";

  return `${quantity} ${unit}${quantity !== 1 ? "s" : ""}`;
};

const getInvoiceHtml = (invoice, logoBase64) => {
  const child = invoice.childId || {};
  const parent = invoice.parentId || {};
  const items = invoice.items || [];

  const subTotal = Number(invoice.subTotal || 0);
  const discount = Number(invoice.discountAmount || 0);
  const tax = Number(invoice.taxAmount || 0);
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.balanceDue ?? total - paid);

  const rows = items
    .map((item, index) => {
      const itemDiscount = Number(item.discount || 0);

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(item.serviceName)}</strong>

            ${
        item.description
          ? `<div class="muted">${escapeHtml(item.description)}</div>`
          : ""
      }

            ${
        itemDiscount > 0
          ? `<div class="item-discount">
                    Discount: -${escapeHtml(money(itemDiscount))}
                  </div>`
          : ""
      }
          </td>
          <td>${escapeHtml(durationText(item))}</td>
          <td class="amount">${escapeHtml(money(item.rate))}</td>
          <td class="amount">${escapeHtml(money(item.amount))}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />

  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      text-rendering: geometricPrecision;
    }

    * {
      box-sizing: border-box;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 28px;
    }

    .company-logo {
  width: 75px;
  height: 75px;
  object-fit: contain;
  display: block;
  margin-bottom: 10px;
}

    .company {
      color: #07588d;
      font-size: 17pt;
      font-weight: bold;
      margin-bottom: 9px;
    }

    .address {
      font-size: 10pt;
    }

    .invoice-title {
      font-size: 26pt;
      font-weight: 400;
      letter-spacing: 1px;
      text-align: right;
    }

    .muted {
      color: #94a3b8;
      font-size: 9pt;
      margin-top: 5px;
    }

    .balance {
      text-align: right;
      margin-top: 20px;
    }

    .balance strong {
      font-size: 17pt;
    }

    .details {
      display: flex;
      justify-content: space-between;
      margin: 25px 0 30px;
    }

    .details > div {
      width: 46%;
    }

    .label {
      color: #94a3b8;
      font-size: 9pt;
      margin-bottom: 6px;
    }

    .detail-line {
      margin-bottom: 8px;
      font-size: 10pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
    }

    th {
      background: #176b9e;
      color: white;
      text-align: left;
      padding: 11px 7px;
      font-size: 9pt;
      font-weight: normal;
    }

    td {
      padding: 14px 7px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      font-size: 9pt;
      overflow-wrap: anywhere;
    }

    th:first-child,
    td:first-child {
      width: 6%;
    }

    th:nth-child(2),
    td:nth-child(2) {
      width: 39%;
    }

    th:nth-child(3),
    td:nth-child(3) {
      width: 18%;
    }

    th:nth-child(4),
    td:nth-child(4) {
      width: 18%;
    }

    th:nth-child(5),
    td:nth-child(5) {
      width: 19%;
    }

    .amount {
      text-align: right;
    }

    .item-discount {
      margin-top: 6px;
      color: #dc2626;
      font-size: 9pt;
    }

    .totals {
      width: 53%;
      margin: 30px 0 35px auto;
      page-break-inside: avoid;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      font-size: 10pt;
    }

    .total-row span:last-child {
      text-align: right;
    }

    .grand {
      font-weight: bold;
      font-size: 12pt;
    }

    .paid {
      color: #e54848;
    }

    .due {
      background: #f1f3f5;
      padding: 12px;
      font-weight: bold;
    }

    .section {
      margin-top: 22px;
      page-break-inside: avoid;
    }

    .section-title {
      color: #64748b;
      margin-bottom: 8px;
      font-size: 10pt;
    }

    .section-body {
      line-height: 1.6;
      font-size: 10pt;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .footer {
      margin-top: 35px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      color: #94a3b8;
      text-align: center;
      font-size: 9pt;
    }
  </style>
</head>

<body>
  <div class="header">
    <div>
    ${
    logoBase64
      ? `<img
             src="data:image/png;base64,${logoBase64}"
             class="company-logo"
             alt="Company Logo"
           />`
      : ""
  }

    <div class="company">${escapeHtml(COMPANY.name)}</div>
    <div class="address">${escapeHtml(COMPANY.address)}</div>
  </div>

    <div>
      <div class="invoice-title">INVOICE</div>

      <div class="muted" style="text-align:right">
        # ${escapeHtml(invoice.invoiceNumber)}
      </div>

      <div class="balance">
        <div class="label">Balance Due</div>
        <strong>${escapeHtml(money(balance))}</strong>
      </div>
    </div>
  </div>

  <div class="details">
    <div>
      <div class="label">Student Details</div>

      <div class="detail-line">
        <strong>
          ${escapeHtml(child.fullName || invoice.childName || "—")}
        </strong>
      </div>

      ${
    child.grade
      ? `<div class="detail-line">${escapeHtml(child.grade)}</div>`
      : ""
  }

      <div class="label" style="margin-top:18px">
        Bill To (Parent/Guardian)
      </div>

      <div class="detail-line">
        <strong>
          ${
    escapeHtml(
      parent.fullName
        || child.fatherName
        || invoice.parentName
        || "—",
    )
  }
        </strong>
      </div>

      <div class="detail-line">
        ${escapeHtml(parent.address || child.address || "")}
      </div>
    </div>

    <div>
      <div class="detail-line">
        <span class="label">Invoice Date:</span>
        ${escapeHtml(dateText(invoice.invoiceDate))}
      </div>

      <div class="detail-line">
        <span class="label">Due Date:</span>
        ${escapeHtml(dateText(invoice.dueDate))}
      </div>

      <div class="detail-line">
        <span class="label">Ref#:</span>
        ${escapeHtml(invoice.referenceNumber || "—")}
      </div>

      <div class="detail-line">
        <span class="label">Status:</span>
        ${escapeHtml(invoice.status || "Pending")}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Service & Date</th>
        <th>Duration</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>

    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Sub Total</span>
      <span>${escapeHtml(money(subTotal))}</span>
    </div>

    ${
    discount > 0
      ? `
          <div class="total-row">
            <span>Discount</span>
            <span>-${escapeHtml(money(discount))}</span>
          </div>
        `
      : ""
  }

    <div class="total-row">
      <span>Tax (${Number(invoice.taxPercentage || 0)}%)</span>
      <span>${escapeHtml(money(tax))}</span>
    </div>

    <div class="total-row grand">
      <span>Total</span>
      <span>${escapeHtml(money(total))}</span>
    </div>

    <div class="total-row paid">
      <span>Payment Received</span>
      <span>-${escapeHtml(money(paid))}</span>
    </div>

    <div class="total-row due">
      <span>Balance Due</span>
      <span>${escapeHtml(money(balance))}</span>
    </div>
  </div>

  ${
    invoice.clinicalSummary
      ? `
        <div class="section">
          <div class="section-title">Clinical Summary</div>
          <div class="section-body">
            ${escapeHtml(invoice.clinicalSummary)}
          </div>
        </div>
      `
      : ""
  }

  ${
    invoice.notes
      ? `
        <div class="section">
          <div class="section-title">Notes</div>
          <div class="section-body">
            ${escapeHtml(invoice.notes)}
          </div>
        </div>
      `
      : ""
  }

  ${
    invoice.termsAndConditions
      ? `
        <div class="section">
          <div class="section-title">Terms & Conditions</div>
          <div class="section-body">
            ${escapeHtml(invoice.termsAndConditions)}
          </div>
        </div>
      `
      : ""
  }

  <div class="footer">
    ${escapeHtml(COMPANY.name)} •
    ${escapeHtml(invoice.invoiceNumber)}
  </div>
</body>
</html>
`;
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || "—"}</Text>
  </View>
);

const TotalRow = ({
  label,
  value,
  bold,
  danger,
  background,
}) => (
  <View
    style={[
      styles.totalRow,
      background && styles.balanceRow,
    ]}
  >
    <Text
      style={[
        styles.totalLabel,
        bold && styles.bold,
        danger && styles.danger,
      ]}
    >
      {label}
    </Text>

    <Text
      style={[
        styles.totalValue,
        bold && styles.bold,
        danger && styles.danger,
      ]}
    >
      {value}
    </Text>
  </View>
);

export default function InvoiceViewScreen({ navigation, route }) {
  const invoiceId = route.params?.invoiceId;

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadInvoice = useCallback(async () => {
    try {
      setLoading(true);

      if (!invoiceId) {
        throw new Error("Invoice ID is missing.");
      }

      const result = await getInvoiceByIdApi(invoiceId);

      if (!result?.success) {
        throw new Error(result?.message || "Invoice not found.");
      }

      setInvoice(result.data);
    } catch (error) {
      console.log("getInvoiceById error:", error);

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || error?.message
          || "Unable to load invoice.",
      );
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useFocusEffect(
    useCallback(() => {
      loadInvoice();
    }, [loadInvoice]),
  );

  const handleDownloadPdf = async () => {
    if (!invoice || downloading) return;

    try {
      setDownloading(true);

      const logoAsset = Asset.fromModule(
        require("../../asstes/logo.png"),
      );

      await logoAsset.downloadAsync();

      const logoUri = logoAsset.localUri || logoAsset.uri;

      if (!logoUri) {
        throw new Error("Logo file could not be loaded.");
      }

      const logoBase64 = await FileSystem.readAsStringAsync(
        logoUri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      const html = getInvoiceHtml(invoice, logoBase64);

      const result = await Print.printToFileAsync({
        html,
        base64: true,
        width: 595,
        height: 842,
      });

      if (!result.base64) {
        throw new Error("PDF generation failed.");
      }

      const invoiceNumber = String(
        invoice.invoiceNumber || invoice._id || "Invoice",
      ).replace(/[^a-zA-Z0-9_-]/g, "_");

      const fileName = `${invoiceNumber}_${Date.now()}.pdf`;

      const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        destinationUri,
        result.base64,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      const fileInfo = await FileSystem.getInfoAsync(
        destinationUri,
        { size: true },
      );

      if (!fileInfo.exists || !fileInfo.size) {
        throw new Error("PDF could not be saved.");
      }

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "PDF Created",
          "Invoice PDF saved successfully.",
        );
        return;
      }

      await Sharing.shareAsync(destinationUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `Invoice ${invoice.invoiceNumber}`,
      });
    } catch (error) {
      console.log("Download invoice error:", error);

      Alert.alert(
        "Error",
        error?.message || "Failed to download invoice PDF.",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <TopBar navigation={navigation} headerTitle="Invoices" />

        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading invoice...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.screen}>
        <TopBar navigation={navigation} headerTitle="Invoices" />

        <View style={styles.center}>
          <Feather
            name="file-text"
            size={42}
            color="#94A3B8"
          />

          <Text style={styles.loadingText}>
            Invoice not available
          </Text>

          <TouchableOpacity
            onPress={loadInvoice}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const child = invoice.childId || {};
  const parent = invoice.parentId || {};
  const invoiceItems = invoice.items || [];

  const subTotal = Number(invoice.subTotal || 0);
  const discount = Number(invoice.discountAmount || 0);
  const tax = Number(invoice.taxAmount || 0);
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.balanceDue ?? total - paid);

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar navigation={navigation} headerTitle="Invoices" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.invoicePaper}>
          <View style={styles.invoiceHeader}>
            <View style={styles.companySection}>
              <Image
                source={require("../../asstes/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.companyName}>
                {COMPANY.name}
              </Text>

              <Text style={styles.companyAddress}>
                {COMPANY.address}
              </Text>
            </View>

            <View style={styles.invoiceHeading}>
              <Text style={styles.invoiceTitle}>
                INVOICE
              </Text>

              <Text style={styles.invoiceNumber}>
                # {invoice.invoiceNumber}
              </Text>

              <Text style={styles.balanceHeaderLabel}>
                Balance Due
              </Text>

              <Text style={styles.balanceHeaderValue}>
                {money(balance)}
              </Text>

              <Text style={styles.statusText}>
                {invoice.status || "Pending"}
              </Text>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <View style={styles.studentSection}>
              <Text style={styles.sectionLabel}>
                Student Details
              </Text>

              <Text style={styles.personName}>
                {child.fullName || invoice.childName || "—"}
              </Text>

              {!!child.grade && (
                <Text style={styles.smallText}>
                  {child.grade}
                </Text>
              )}

              <Text
                style={[
                  styles.sectionLabel,
                  styles.billToLabel,
                ]}
              >
                Bill To (Parent/Guardian)
              </Text>

              <Text style={styles.personName}>
                {parent.fullName
                  || child.fatherName
                  || invoice.parentName
                  || "—"}
              </Text>

              <Text style={styles.smallText}>
                {parent.address || child.address || ""}
              </Text>
            </View>

            <View style={styles.invoiceMeta}>
              <DetailRow
                label="Invoice Date"
                value={dateText(invoice.invoiceDate)}
              />

              <DetailRow
                label="Due Date"
                value={dateText(invoice.dueDate)}
              />

              <DetailRow
                label="Ref#"
                value={invoice.referenceNumber}
              />
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text
              style={[
                styles.tableHeadingText,
                styles.colNumber,
              ]}
            >
              #
            </Text>

            <Text
              style={[
                styles.tableHeadingText,
                styles.colService,
              ]}
            >
              Service & Date
            </Text>

            <Text
              style={[
                styles.tableHeadingText,
                styles.colDuration,
              ]}
            >
              Duration
            </Text>

            <Text
              style={[
                styles.tableHeadingText,
                styles.colRate,
              ]}
            >
              Rate
            </Text>

            <Text
              style={[
                styles.tableHeadingText,
                styles.colAmount,
              ]}
            >
              Amount
            </Text>
          </View>

          {invoiceItems.map((item, index) => (
            <View
              key={String(item._id || index)}
              style={styles.tableRow}
            >
              <Text
                style={[
                  styles.cellText,
                  styles.colNumber,
                ]}
              >
                {index + 1}
              </Text>

              <View style={styles.colService}>
                <Text style={styles.serviceName}>
                  {item.serviceName}
                </Text>

                {!!item.description && (
                  <Text style={styles.serviceDescription}>
                    {item.description}
                  </Text>
                )}

                {Number(item.discount || 0) > 0 && (
                  <Text style={styles.itemDiscount}>
                    Discount: -{money(item.discount)}
                  </Text>
                )}
              </View>

              <Text
                style={[
                  styles.cellText,
                  styles.colDuration,
                ]}
              >
                {durationText(item)}
              </Text>

              <Text
                style={[
                  styles.cellText,
                  styles.colRate,
                ]}
              >
                {money(item.rate)}
              </Text>

              <Text
                style={[
                  styles.cellText,
                  styles.colAmount,
                ]}
              >
                {money(item.amount)}
              </Text>
            </View>
          ))}

          <View style={styles.totalsSection}>
            <TotalRow
              label="Sub Total"
              value={money(subTotal)}
            />

            {discount > 0 && (
              <TotalRow
                label="Discount"
                value={`-${money(discount)}`}
              />
            )}

            <TotalRow
              label={`Tax (${Number(invoice.taxPercentage || 0)}%)`}
              value={money(tax)}
            />

            <TotalRow
              label="Total"
              value={money(total)}
              bold
            />

            <TotalRow
              label="Payment Received"
              value={`-${money(paid)}`}
              danger
            />

            <TotalRow
              label="Balance Due"
              value={money(balance)}
              bold
              background
            />
          </View>

          {!!invoice.clinicalSummary && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>
                Clinical Summary
              </Text>

              <Text style={styles.notesText}>
                {invoice.clinicalSummary}
              </Text>
            </View>
          )}

          {!!invoice.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>
                Notes
              </Text>

              <Text style={styles.notesText}>
                {invoice.notes}
              </Text>
            </View>
          )}

          {!!invoice.termsAndConditions && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>
                Terms & Conditions
              </Text>

              <Text style={styles.notesText}>
                {invoice.termsAndConditions}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.downloadButton,
              downloading && styles.disabledButton,
            ]}
            activeOpacity={0.8}
            disabled={downloading}
            onPress={handleDownloadPdf}
          >
            {downloading
              ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              )
              : (
                <Feather
                  name="download"
                  size={20}
                  color="#FFFFFF"
                />
              )}

            <Text style={styles.downloadText}>
              {downloading
                ? "Generating PDF..."
                : "Download Invoice PDF"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomBar activeTab="" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F8FB",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },

  invoicePaper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    minHeight: 170,
  },

  companySection: {
    flex: 1,
    paddingRight: 10,
  },

  logo: {
    width: 52,
    height: 52,
    marginBottom: 12,
  },

  companyName: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
    lineHeight: 28,
  },

  companyAddress: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 24,
  },

  invoiceHeading: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 25,
  },

  invoiceTitle: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: "#1F2937",
    letterSpacing: 1,
    lineHeight: 28,
  },

  invoiceNumber: {
    fontSize: 10,
    color: "#6B7280",
    fontFamily: fonts.regular,
    lineHeight: 13,
  },

  balanceHeaderLabel: {
    marginTop: 20,
    fontSize: 10,
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },

  balanceHeaderValue: {
    marginTop: 4,
    fontSize: 15,
    color: "#1E293B",
    fontFamily: fonts.bold,
  },

  statusText: {
    marginTop: 6,
    fontSize: 10,
    color: "#64748B",
    fontFamily: fonts.semiBold,
  },

  detailsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 26,
  },

  studentSection: {
    flex: 1,
    paddingRight: 10,
  },

  sectionLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: fonts.regular,
    marginBottom: 5,
  },

  personName: {
    fontSize: 11,
    color: "#1E293B",
    fontFamily: fonts.semiBold,
  },

  smallText: {
    fontSize: 10,
    color: "#64748B",
    fontFamily: fonts.regular,
    lineHeight: 15,
  },

  billToLabel: {
    marginTop: 15,
  },

  invoiceMeta: {
    flex: 1,
    justifyContent: "flex-end",
    gap: 8,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
  },

  detailLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontFamily: fonts.regular,
    flex: 1,
  },

  detailValue: {
    fontSize: 9,
    color: "#1E293B",
    fontFamily: fonts.regular,
    textAlign: "right",
    flex: 1,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#176B9E",
    paddingVertical: 10,
    paddingHorizontal: 5,
  },

  tableHeadingText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: fonts.regular,
  },

  colNumber: {
    width: "7%",
  },

  colService: {
    width: "34%",
    paddingRight: 4,
  },

  colDuration: {
    width: "18%",
  },

  colRate: {
    width: "20%",
    textAlign: "right",
  },

  colAmount: {
    width: "21%",
    textAlign: "right",
  },

  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 5,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    minHeight: 75,
  },

  cellText: {
    fontSize: 9,
    color: "#475569",
    fontFamily: fonts.regular,
    lineHeight: 14,
  },

  serviceName: {
    fontSize: 10,
    color: "#1E293B",
    fontFamily: fonts.semiBold,
    lineHeight: 14,
  },

  serviceDescription: {
    fontSize: 9,
    color: "#94A3B8",
    fontFamily: fonts.regular,
    marginTop: 4,
  },

  itemDiscount: {
    fontSize: 9,
    color: "#DC2626",
    fontFamily: fonts.regular,
    marginTop: 5,
  },

  totalsSection: {
    marginTop: 30,
    marginLeft: "32%",
    marginBottom: 28,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    gap: 8,
  },

  totalLabel: {
    flex: 1,
    fontSize: 10,
    color: "#475569",
    fontFamily: fonts.regular,
  },

  totalValue: {
    fontSize: 10,
    color: "#334155",
    fontFamily: fonts.regular,
    textAlign: "right",
  },

  bold: {
    fontFamily: fonts.bold,
    color: "#1E293B",
  },

  danger: {
    color: "#EF4444",
  },

  balanceRow: {
    backgroundColor: "#F1F3F5",
    borderRadius: 3,
    paddingHorizontal: 8,
    marginTop: 4,
  },

  notesSection: {
    marginTop: 22,
  },

  notesText: {
    fontSize: 10,
    color: "#475569",
    fontFamily: fonts.regular,
    lineHeight: 16,
  },

  downloadButton: {
    marginTop: 65,
    height: 54,
    backgroundColor: "#FA8C28",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B65A08",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },

  downloadText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },

  disabledButton: {
    opacity: 0.6,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  retryButton: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },

  retryText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },
});
