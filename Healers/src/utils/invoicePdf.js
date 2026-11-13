import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getInvoiceByIdApi } from "../api/admin/api";

// ...COMPANY, money, dateText, escapeHtml, durationText, getInvoiceHtml go here...
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

export const generateInvoicePdf = async (invoice) => {
  const logoAsset = Asset.fromModule(require("../asstes/logo.png"));
  await logoAsset.downloadAsync();

  const logoUri = logoAsset.localUri || logoAsset.uri;
  if (!logoUri) throw new Error("Logo file could not be loaded.");

  const logoBase64 = await FileSystem.readAsStringAsync(logoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const html = getInvoiceHtml(invoice, logoBase64);

  const result = await Print.printToFileAsync({
    html,
    base64: true,
    width: 595,
    height: 842,
  });

  if (!result.base64) throw new Error("PDF generation failed.");

  const safeNumber = String(
    invoice.invoiceNumber || invoice._id || "Invoice",
  ).replace(/[^a-zA-Z0-9_-]/g, "_");

  const uri = `${FileSystem.documentDirectory}${safeNumber}_${Date.now()}.pdf`;

  await FileSystem.writeAsStringAsync(uri, result.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists || !info.size) throw new Error("PDF could not be saved.");

  return uri;
};

// Used by the list screens: takes an invoice id, builds the PDF, opens share sheet
export const shareInvoicePdfById = async (invoiceId) => {
  const result = await getInvoiceByIdApi(invoiceId);

  if (!result?.success) {
    throw new Error(result?.message || "Invoice not found.");
  }

  const invoice = result.data;
  const uri = await generateInvoicePdf(invoice);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Invoice ${invoice.invoiceNumber}`,
  });
};
export const shareInvoicePdfToWhatsApp = async (invoiceId) => {
  const result = await getInvoiceByIdApi(invoiceId);

  if (!result?.success) {
    throw new Error(result?.message || "Invoice not found.");
  }

  const invoice = result.data;
  const uri = await generateInvoicePdf(invoice); 

  try {
    await Share.shareSingle({
      social: Share.Social.WHATSAPP,
      url: uri,
      type: "application/pdf",
      filename: `Invoice_${invoice.invoiceNumber}`,
      message: `Invoice ${invoice.invoiceNumber}`,
    });
  } catch (error) {
    const msg = String(error?.message || "");

    if (msg.includes("User did not share") || msg.includes("cancel")) {
      return;
    }

    if (
      msg.toLowerCase().includes("not installed")
      || msg.toLowerCase().includes("not found")
      || msg.toLowerCase().includes("no app")
    ) {
      throw new Error("WhatsApp is not installed on this device.");
    }

    throw error;
  }
};