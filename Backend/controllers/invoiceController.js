const Invoice = require("../models/invoice");
const User = require("../models/User");
const mongoose = require("mongoose");


const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();

  const lastInvoice = await Invoice.findOne({
    invoiceNumber: new RegExp(`^INV-${year}-`),
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber")
    .lean();

  let nextNumber = 1;

  if (lastInvoice?.invoiceNumber) {
    const parts = lastInvoice.invoiceNumber.split("-");
    const current = Number(parts[parts.length - 1]);

    if (!Number.isNaN(current)) {
      nextNumber = current + 1;
    }
  }

  return `INV-${year}-${String(nextNumber).padStart(4, "0")}`;
};


const calculateInvoice = ({
  items,
  discountType = "none",
  discountValue = 0,
  taxPercentage = 0,
}) => {
  const round = (value) =>
    Math.round((value + Number.EPSILON) * 100) / 100;

  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity ?? 1) || 1;
    const rate = Number(item.rate);
    const discount = Number(item.discount ?? 0);

    const baseAmount = round(quantity * rate);
    const amount = round(baseAmount - discount);

    return {
      ...item,
      quantity,
      rate: round(rate),
      discount: round(discount),
      amount,
    };
  });

  const subTotal = round(
    normalizedItems.reduce(
      (sum, item) => sum + item.quantity * item.rate,
      0
    )
  );

  const itemDiscountTotal = round(
    normalizedItems.reduce(
      (sum, item) => sum + item.discount,
      0
    )
  );

  const afterItemDiscount = round(
    subTotal - itemDiscountTotal
  );

  let invoiceDiscount = 0;

  if (discountType === "percentage") {
    invoiceDiscount = round(
      afterItemDiscount *
      (Number(discountValue) / 100)
    );
  }

  if (discountType === "fixed") {
    invoiceDiscount = round(
      Math.min(Number(discountValue), afterItemDiscount)
    );
  }

  const discountAmount = round(
    itemDiscountTotal + invoiceDiscount
  );

  const taxableAmount = round(
    Math.max(afterItemDiscount - invoiceDiscount, 0)
  );

  const taxAmount = round(
    taxableAmount * (Number(taxPercentage) / 100)
  );

  const totalAmount = round(
    taxableAmount + taxAmount
  );

  return {
    normalizedItems,
    subTotal,
    itemDiscountTotal,
    invoiceDiscount,
    discountAmount,
    taxAmount,
    totalAmount,
  };
};

const getPaymentTotals = (payments = []) => {
  const paidAmount = payments.reduce(
    (sum, payment) => sum + Math.max(Number(payment.amount) || 0, 0),
    0,
  );

  return Number(paidAmount.toFixed(2));
};

const getInvoiceStatus = ({
  totalAmount,
  paidAmount,
  dueDate,
}) => {
  if (paidAmount >= totalAmount && totalAmount > 0) {
    return "Paid";
  }

  if (paidAmount > 0) {
    return "Partially Paid";
  }

  if (
    dueDate
    && new Date(dueDate).getTime() < Date.now()
  ) {
    return "Overdue";
  }

  return "Pending";
};

exports.createInvoice = async (req, res) => {
  try {
    const {
      childId,
      parentId,
      invoiceDate,
      dueDate,
      referenceNumber,
      items,
      discountType = "none",
      discountValue = 0,
      taxPercentage = 0,
      clinicalSummary = "",
      notes = "",
      termsAndConditions = "",
      status = "Pending",
    } = req.body;

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child is required.",
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one invoice item is required.",
      });
    }

    const invalidItem = items.find((item) => {
      const rate = Number(item.rate);
      const quantity = Number(item.quantity ?? 1);
      const discount = Number(item.discount ?? 0);

      return (
        !item.serviceName?.trim()
        || !Number.isFinite(rate)
        || rate < 0
        || !Number.isFinite(quantity)
        || quantity <= 0
        || !Number.isFinite(discount)
        || discount < 0
        || discount > quantity * rate
      );
    });

    if (invalidItem) {
      return res.status(400).json({
        success: false,
        message: "Each item requires a service name, valid quantity, rate and discount.",
      });
    }

    if (!["none", "fixed", "percentage"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice discount type.",
      });
    }

    if (
      !Number.isFinite(Number(discountValue))
      || Number(discountValue) < 0
      || !Number.isFinite(Number(taxPercentage))
      || Number(taxPercentage) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount or tax value.",
      });
    }

    if (!["Draft", "Pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice status.",
      });
    }

    const calculated = calculateInvoice({
      items,
      discountType,
      discountValue,
      taxPercentage,
    });

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      childId,
      parentId: parentId || null,
      createdBy: req.user._id || req.user.id,
      invoiceDate: invoiceDate || new Date(),
      dueDate: dueDate || null,
      referenceNumber,

      items: calculated.normalizedItems,

      subTotal: calculated.subTotal,
      discountType,
      discountValue: Number(discountValue) || 0,
      discountAmount: calculated.discountAmount,

      taxPercentage: Number(taxPercentage) || 0,
      taxAmount: calculated.taxAmount,

      totalAmount: calculated.totalAmount,
      paidAmount: 0,
      balanceDue: calculated.totalAmount,

      status,
      clinicalSummary,
      notes,
      termsAndConditions,
    });

    return res.status(201).json({
      success: true,
      message: status === "Draft"
        ? "Invoice draft saved successfully."
        : "Invoice created successfully.",
      data: invoice,
    });
  } catch (error) {
    console.error("createInvoice error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create invoice.",
      error: error.message,
    });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 5,
      status,
      search = "",
      childId,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(
      Math.max(Number(limit) || 5, 1),
      50,
    );

    const query = {};

    if (status && status !== "All Statuses") {
      query.status = status;
    }

    if (childId) {
      query.childId = childId;
    }

    if (search.trim()) {
      query.invoiceNumber = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate(
          "childId",
          "_id fullName profileImage",
        )
        .populate(
          "parentId",
          "_id fullName email phone",
        )
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .lean(),

      Invoice.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit),
        hasMore: currentPage * pageLimit < total,
      },
    });
  } catch (error) {
    console.error("getInvoices error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get invoices.",
    });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate(
        "childId",
        "_id fullName email phone profileImage fatherName fatherCnic age packageId discountedPrice",
      )
      .populate(
        "createdBy",
        "_id fullName role",
      )
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error(
      "getInvoiceById error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get invoice.",
      error: error.message,
    });
  }
};

exports.addInvoicePayment = async (req, res) => {
  try {
    const {
      amount,
      paymentMethod,
      reference,
      note,
    } = req.body;

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required.",
      });
    }

    const invoice = await Invoice.findById(
      req.params.invoiceId,
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    if (paymentAmount > invoice.balanceDue) {
      return res.status(400).json({
        success: false,
        message: "Payment cannot exceed balance due.",
      });
    }

    invoice.payments.push({
      amount: paymentAmount,
      paymentMethod,
      reference,
      note,
      receivedBy: req.user._id || req.user.id,
    });

    invoice.paidAmount = getPaymentTotals(
      invoice.payments,
    );

    invoice.balanceDue = Number(
      Math.max(
        invoice.totalAmount - invoice.paidAmount,
        0,
      ).toFixed(2),
    );

    invoice.status = getInvoiceStatus({
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      dueDate: invoice.dueDate,
    });

    await invoice.save();

    return res.status(200).json({
      success: true,
      message: "Payment added successfully.",
      data: invoice,
    });
  } catch (error) {
    console.error("addInvoicePayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add payment.",
    });
  }
};

exports.getInvoiceChildren = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1,
    );

    const pageLimit = Math.min(
      Math.max(Number(limit) || 10, 1),
      20,
    );

    const query = {
      role: "Child",
    };

    const searchValue = search.trim();

    if (searchValue) {
      const escapedSearch = searchValue.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      const regex = new RegExp(
        escapedSearch,
        "i",
      );

      query.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { fatherName: regex },
        { fatherCnic: regex },
      ];
    }

    const skip = (currentPage - 1) * pageLimit;

    const [children, total] = await Promise.all([
      User.find(query)
        .select(
          "_id fullName email phone fatherName fatherCnic age profileImage packageId discountedPrice role",
        )
        .populate({
          path: "packageId",
          select: "_id name title price type",
        })
        .sort({
          fullName: 1,
          _id: 1,
        })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / pageLimit);

    return res.status(200).json({
      success: true,
      data: children.map((child) => ({
        _id: child._id,
        id: child._id,
        fullName: child.fullName || "",
        email: child.email || "",
        phone: child.phone || "",
        profileImage: child.profileImage || "",
        age: child.age ?? null,
        fatherName: child.fatherName || "",
        fatherCnic: child.fatherCnic || "",
        package: child.packageId || null,
        discountedPrice: child.discountedPrice ?? null,
      })),

      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages,
        hasMore: currentPage < totalPages,
      },
    });
  } catch (error) {
    console.error(
      "getInvoiceChildren error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get children.",
      error: error.message,
    });
  }
};
