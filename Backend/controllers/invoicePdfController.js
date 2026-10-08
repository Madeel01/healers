
const PDFDocument = require("pdfkit");
const Invoice = require("../models/invoice");

const COLORS = {
  primary: "#176B9E",
  heading: "#07588D",
  text: "#1E293B",
  secondary: "#475569",
  muted: "#94A3B8",
  border: "#E2E8F0",
  light: "#F1F3F5",
  danger: "#DC2626",
  white: "#FFFFFF",
};

const COMPANY = {
  name: "HEALERS INSTITUTION",
  address: "12-K, Gulberg III, Lahore",
};

const money = (value) =>
  `PKR ${Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

const durationText = (item) => {
  const quantity = Number(item.quantity) || 1;
  const unit = item.durationUnit || "session";

  return `${quantity} ${unit}${quantity !== 1 ? "s" : ""}`;
};

const text = (value) => String(value ?? "");

const drawLine = (doc, x1, y1, x2, y2, color = COLORS.border) => {
  doc
    .strokeColor(color)
    .lineWidth(0.6)
    .moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke();
};

const drawText = (
  doc,
  value,
  x,
  y,
  width,
  options = {}
) => {
  const {
    font = "Helvetica",
    size = 10,
    color = COLORS.text,
    align = "left",
    ...rest
  } = options;

  doc
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(text(value), x, y, {
      width,
      align,
      ...rest,
    });
};

const sectionTitle = (doc, title, x, y, width) => {
  drawText(doc, title, x, y, width, {
    size: 10,
    color: COLORS.secondary,
    font: "Helvetica-Bold",
  });
};

const drawFooter = (doc, invoiceNumber) => {
  const pageWidth = doc.page.width;
  const left = 45;
  const right = pageWidth - 45;
  const y = doc.page.height - 65;

  drawLine(doc, left, y, right, y);

  drawText(
    doc,
    `${COMPANY.name}  |  ${invoiceNumber}`,
    left,
    y + 12,
    right - left,
    {
      size: 9,
      color: COLORS.muted,
      align: "center",
    }
  );
};

const drawTableHeader = (doc, y) => {
  const left = 45;
  const width = doc.page.width - 90;

  doc
    .rect(left, y, width, 35)
    .fill(COLORS.primary);

  const columns = [
    { label: "#", x: 53, width: 20 },
    { label: "Service & Date", x: 80, width: 180 },
    { label: "Duration", x: 265, width: 75 },
    { label: "Rate", x: 345, width: 95 },
    { label: "Amount", x: 445, width: 95 },
  ];

  columns.forEach((column, index) => {
    drawText(
      doc,
      column.label,
      column.x,
      y + 11,
      column.width,
      {
        font: "Helvetica",
        size: 9,
        color: COLORS.white,
        align: index >= 3 ? "right" : "left",
      }
    );
  });

  return y + 35;
};

const drawItemRow = (doc, item, index, y) => {
  const service = text(item.serviceName || "Service");
  const description = text(item.description || "");
  const discount = Number(item.discount || 0);

  const serviceHeight = doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .heightOfString(service, { width: 170 });

  const descriptionHeight = description
    ? doc
        .font("Helvetica")
        .fontSize(9)
        .heightOfString(description, { width: 170 })
    : 0;

  const discountHeight = discount > 0 ? 15 : 0;

  const rowHeight = Math.max(
    52,
    serviceHeight +
      descriptionHeight +
      discountHeight +
      22
  );

  drawText(doc, index + 1, 53, y + 12, 20, {
    size: 9,
  });

  drawText(doc, service, 80, y + 11, 170, {
    font: "Helvetica-Bold",
    size: 10,
  });

  let contentY = y + 14 + serviceHeight;

  if (description) {
    drawText(doc, description, 80, contentY, 170, {
      size: 9,
      color: COLORS.muted,
    });

    contentY += descriptionHeight + 3;
  }

  if (discount > 0) {
    drawText(
      doc,
      `Discount: -${money(discount)}`,
      80,
      contentY,
      170,
      {
        size: 9,
        color: COLORS.danger,
      }
    );
  }

  drawText(
    doc,
    durationText(item),
    265,
    y + 12,
    75,
    { size: 9 }
  );

  drawText(
    doc,
    money(item.rate),
    345,
    y + 12,
    95,
    {
      size: 9,
      align: "right",
    }
  );

  drawText(
    doc,
    money(item.amount),
    445,
    y + 12,
    95,
    {
      size: 9,
      align: "right",
    }
  );

  drawLine(
    doc,
    45,
    y + rowHeight,
    doc.page.width - 45,
    y + rowHeight
  );

  return y + rowHeight;
};

const drawTotalRow = (
  doc,
  label,
  value,
  y,
  options = {}
) => {
  const {
    bold = false,
    danger = false,
    background = false,
  } = options;

  const x = 285;
  const width = doc.page.width - x - 45;
  const height = background ? 35 : 27;

  if (background) {
    doc
      .rect(x, y, width, height)
      .fill(COLORS.light);
  }

  drawText(doc, label, x + 10, y + 9, 110, {
    size: bold ? 11 : 10,
    font: bold ? "Helvetica-Bold" : "Helvetica",
    color: danger ? COLORS.danger : COLORS.secondary,
  });

  drawText(
    doc,
    value,
    x + 115,
    y + 9,
    width - 125,
    {
      size: bold ? 11 : 10,
      font: bold ? "Helvetica-Bold" : "Helvetica",
      color: danger ? COLORS.danger : COLORS.text,
      align: "right",
    }
  );

  return y + height;
};

const drawNotesSection = (
  doc,
  title,
  value,
  y
) => {
  if (!value) return y;

  const left = 45;
  const width = doc.page.width - 90;

  const contentHeight = doc
    .font("Helvetica")
    .fontSize(10)
    .heightOfString(text(value), {
      width,
      lineGap: 4,
    });

  const requiredHeight = contentHeight + 45;

  if (y + requiredHeight > doc.page.height - 85) {
    doc.addPage();
    y = 55;
  }

  sectionTitle(doc, title, left, y, width);

  drawText(
    doc,
    value,
    left,
    y + 20,
    width,
    {
      size: 10,
      color: COLORS.secondary,
      lineGap: 4,
    }
  );

  return y + requiredHeight;
};

exports.downloadInvoicePdf = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate("childId", "fullName fatherName grade address")
      .populate("parentId", "fullName address")
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const child = invoice.childId || {};
    const parent = invoice.parentId || {};
    const items = invoice.items || [];

    const subTotal = Number(invoice.subTotal || 0);
    const discount = Number(invoice.discountAmount || 0);
    const tax = Number(invoice.taxAmount || 0);
    const total = Number(invoice.totalAmount || 0);
    const paid = Number(invoice.paidAmount || 0);
    const balance = Number(
      invoice.balanceDue ?? total - paid
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
      compress: true,
      autoFirstPage: true,
      bufferPages: true,
    });

    const fileName = `Invoice-${String(
      invoice.invoiceNumber || invoiceId
    ).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );
    res.setHeader("Cache-Control", "no-store");

    doc.pipe(res);

    const left = 45;
    const right = doc.page.width - 45;

    drawText(
      doc,
      COMPANY.name,
      left,
      55,
      280,
      {
        font: "Helvetica-Bold",
        size: 17,
        color: COLORS.heading,
      }
    );

    drawText(
      doc,
      COMPANY.address,
      left,
      85,
      280,
      {
        size: 10,
      }
    );

    drawText(
      doc,
      "INVOICE",
      345,
      50,
      205,
      {
        size: 26,
        align: "right",
      }
    );

    drawText(
      doc,
      `# ${invoice.invoiceNumber || "—"}`,
      345,
      86,
      205,
      {
        size: 9,
        color: COLORS.muted,
        align: "right",
      }
    );

    drawText(
      doc,
      "Balance Due",
      345,
      119,
      205,
      {
        size: 9,
        color: COLORS.muted,
        align: "right",
      }
    );

    drawText(
      doc,
      money(balance),
      325,
      138,
      225,
      {
        font: "Helvetica-Bold",
        size: 17,
        align: "right",
      }
    );

    sectionTitle(
      doc,
      "Student Details",
      left,
      205,
      240
    );

    drawText(
      doc,
      child.fullName || invoice.childName || "—",
      left,
      225,
      240,
      {
        font: "Helvetica-Bold",
        size: 11,
      }
    );

    if (child.grade) {
      drawText(
        doc,
        child.grade,
        left,
        244,
        240,
        {
          size: 9,
          color: COLORS.secondary,
        }
      );
    }

    sectionTitle(
      doc,
      "Bill To (Parent/Guardian)",
      left,
      275,
      240
    );

    drawText(
      doc,
      parent.fullName ||
        child.fatherName ||
        invoice.parentName ||
        "—",
      left,
      295,
      240,
      {
        font: "Helvetica-Bold",
        size: 11,
      }
    );

    drawText(
      doc,
      parent.address || child.address || "",
      left,
      315,
      240,
      {
        size: 9,
        color: COLORS.secondary,
      }
    );

    const metaX = 340;

    const metadata = [
      ["Invoice Date:", dateText(invoice.invoiceDate)],
      ["Due Date:", dateText(invoice.dueDate)],
      ["Ref#:", invoice.referenceNumber || "—"],
      ["Status:", invoice.status || "Pending"],
    ];

    metadata.forEach(([label, value], index) => {
      const rowY = 205 + index * 27;

      drawText(
        doc,
        label,
        metaX,
        rowY,
        95,
        {
          size: 9,
          color: COLORS.muted,
        }
      );

      drawText(
        doc,
        value,
        metaX + 95,
        rowY,
        115,
        {
          size: 9,
          align: "right",
        }
      );
    });

    let y = 365;

    y = drawTableHeader(doc, y);

    items.forEach((item, index) => {
      const service = text(item.serviceName || "Service");
      const description = text(item.description || "");

      const serviceHeight = doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .heightOfString(service, { width: 170 });

      const descriptionHeight = description
        ? doc
            .font("Helvetica")
            .fontSize(9)
            .heightOfString(description, { width: 170 })
        : 0;

      const requiredHeight = Math.max(
        52,
        serviceHeight +
          descriptionHeight +
          (Number(item.discount || 0) > 0 ? 15 : 0) +
          22
      );

      if (y + requiredHeight > doc.page.height - 90) {
        doc.addPage();
        y = 55;
        y = drawTableHeader(doc, y);
      }

      y = drawItemRow(doc, item, index, y);
    });

    if (y + 220 > doc.page.height - 85) {
      doc.addPage();
      y = 55;
    }

    y += 28;

    y = drawTotalRow(
      doc,
      "Sub Total",
      money(subTotal),
      y
    );

    if (discount > 0) {
      y = drawTotalRow(
        doc,
        "Discount",
        `-${money(discount)}`,
        y
      );
    }

    y = drawTotalRow(
      doc,
      `Tax (${Number(invoice.taxPercentage || 0)}%)`,
      money(tax),
      y
    );

    y = drawTotalRow(
      doc,
      "Total",
      money(total),
      y,
      { bold: true }
    );

    y = drawTotalRow(
      doc,
      "Payment Received",
      `-${money(paid)}`,
      y,
      { danger: true }
    );

    y = drawTotalRow(
      doc,
      "Balance Due",
      money(balance),
      y,
      {
        bold: true,
        background: true,
      }
    );

    y += 30;

    y = drawNotesSection(
      doc,
      "Clinical Summary",
      invoice.clinicalSummary,
      y
    );

    y = drawNotesSection(
      doc,
      "Notes",
      invoice.notes,
      y
    );

    y = drawNotesSection(
      doc,
      "Terms & Conditions",
      invoice.termsAndConditions,
      y
    );

    const pageRange = doc.bufferedPageRange();

    for (
      let i = pageRange.start;
      i < pageRange.start + pageRange.count;
      i++
    ) {
      doc.switchToPage(i);
      drawFooter(doc, invoice.invoiceNumber || "Invoice");
    }

    doc.end();
  } catch (error) {
    console.error("downloadInvoicePdf error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate invoice PDF",
      });
    }

    res.destroy(error);
  }
};
