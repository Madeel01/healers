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
  const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

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
      0,
    ),
  );

  const itemDiscountTotal = round(
    normalizedItems.reduce(
      (sum, item) => sum + item.discount,
      0,
    ),
  );

  const afterItemDiscount = round(
    subTotal - itemDiscountTotal,
  );

  let invoiceDiscount = 0;

  if (discountType === "percentage") {
    invoiceDiscount = round(
      afterItemDiscount
        * (Number(discountValue) / 100),
    );
  }

  if (discountType === "fixed") {
    invoiceDiscount = round(
      Math.min(Number(discountValue), afterItemDiscount),
    );
  }

  const discountAmount = round(
    itemDiscountTotal + invoiceDiscount,
  );

  const taxableAmount = round(
    Math.max(afterItemDiscount - invoiceDiscount, 0),
  );

  const taxAmount = round(
    taxableAmount * (Number(taxPercentage) / 100),
  );

  const totalAmount = round(
    taxableAmount + taxAmount,
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
      status = "All Statuses",
      search = "",
      childId,
    } = req.query;

    const currentPage = Math.max(
      Math.floor(Number(page)) || 1,
      1,
    );

    const pageLimit = Math.min(
      Math.max(Math.floor(Number(limit)) || 5, 1),
      50,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allowedStatuses = [
      "Draft",
      "Pending",
      "Partially Paid",
      "Paid",
      "Overdue",
      "Cancelled",
    ];

    if (
      status
      && status !== "All Statuses"
      && !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice status.",
      });
    }

    if (
      childId
      && !mongoose.Types.ObjectId.isValid(childId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid child ID.",
      });
    }

    const overdueUpdate = await Invoice.updateMany(
      {
        status: {
          $in: ["Pending", "Partially Paid"],
        },
        dueDate: {
          $lt: today,
        },
        balanceDue: {
          $gt: 0,
        },
      },
      {
        $set: {
          status: "Overdue",
        },
      },
    );

    console.log("OVERDUE UPDATE:", {
      matched: overdueUpdate.matchedCount,
      modified: overdueUpdate.modifiedCount,
    });

    const query = {};

    if (status && status !== "All Statuses") {
      query.status = status;
    }

    if (childId) {
      query.childId = new mongoose.Types.ObjectId(childId);
    }

    const trimmedSearch = String(search).trim();

    if (trimmedSearch) {
      const escapedSearch = trimmedSearch.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      query.invoiceNumber = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    const skip = (currentPage - 1) * pageLimit;

    const [invoices, total, summary] = await Promise.all([
      Invoice.find(query)
        .populate(
          "childId",
          "_id fullName profileImage",
        )
        .populate(
          "parentId",
          "_id fullName email phone",
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      Invoice.countDocuments(query),

      Invoice.aggregate([
        {
          $match: {
            status: {
              $nin: ["Draft", "Cancelled"],
            },
          },
        },
        {
          $group: {
            _id: null,

            totalRevenue: {
              $sum: {
                $ifNull: ["$totalAmount", 0],
              },
            },

            collected: {
              $sum: {
                $ifNull: ["$paidAmount", 0],
              },
            },

            outstanding: {
              $sum: {
                $ifNull: ["$balanceDue", 0],
              },
            },

            outstandingCount: {
              $sum: {
                $cond: [
                  {
                    $gt: ["$balanceDue", 0],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const totals = summary[0] || {};

    const totalPages = Math.ceil(total / pageLimit);

    const pagination = {
      page: currentPage,
      limit: pageLimit,
      total,
      totalPages,
      hasMore: currentPage * pageLimit < total,
    };

    return res.status(200).json({
      success: true,
      message: "Invoices fetched successfully.",

      data: invoices,

      stats: {
        totalRevenue: totals.totalRevenue || 0,
        outstanding: totals.outstanding || 0,
        collected: totals.collected || 0,
        outstandingCount: totals.outstandingCount || 0,
      },

      pagination,
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
    const { invoiceId } = req.params;
    const {
      amount,
      paymentMethod = "Cash",
      reference = "",
      note = "",
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid payment amount.",
      });
    }

    if (Math.round(paymentAmount * 100) !== paymentAmount * 100) {
      return res.status(400).json({
        success: false,
        message: "Amount can have at most two decimal places.",
      });
    }

    const validMethods = [
      "Cash",
      "Bank Transfer",
      "Card",
      "Online",
      "Cheque",
      "Other",
    ];

    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    if (["Draft", "Cancelled"].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        message: "Payments are not allowed for this invoice.",
      });
    }

    const balanceDue = Math.round(
      (invoice.totalAmount - invoice.paidAmount) * 100,
    ) / 100;

    if (paymentAmount > balanceDue) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed PKR ${balanceDue}.`,
      });
    }

    invoice.payments.push({
      amount: paymentAmount,
      paymentMethod,
      reference,
      note,
      paidAt: new Date(),
      receivedBy: req.user._id || req.user.id,
    });

    invoice.paidAmount = Math.round(
      (invoice.paidAmount + paymentAmount) * 100,
    ) / 100;

    invoice.balanceDue = Math.round(
      Math.max(invoice.totalAmount - invoice.paidAmount, 0) * 100,
    ) / 100;

    invoice.status = invoice.balanceDue === 0
      ? "Paid"
      : invoice.paidAmount > 0
      ? "Partially Paid"
      : "Pending";

    await invoice.save();

    return res.status(200).json({
      success: true,
      message: "Payment updated successfully.",
      data: invoice,
    });
  } catch (error) {
    console.error("addInvoicePayment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update payment.",
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

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Invoice status is required.",
      });
    }

    if (status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Draft invoices can only be changed to Pending.",
      });
    }

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: invoiceId,
        status: "Draft",
      },
      {
        $set: {
          status: "Pending",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!invoice) {
      const existingInvoice = await Invoice.findById(invoiceId)
        .select("status")
        .lean();

      if (!existingInvoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found.",
        });
      }

      return res.status(409).json({
        success: false,
        message: `Cannot update invoice with status ${existingInvoice.status}. Only Draft invoices can be activated.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invoice status updated successfully.",
      data: invoice,
    });
  } catch (error) {
    console.error("updateInvoiceStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update invoice status.",
    });
  }
};

exports.getInvoiceDashboardSummary = async (req, res) => {
  try {
    const now = new Date();

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const fiscalYearStart = new Date(now.getFullYear(), 0, 1);
    const fiscalYearEnd = new Date(now.getFullYear() + 1, 0, 1);

    const activeStatuses = [
      "Pending",
      "Partially Paid",
      "Overdue",
    ];

    const overdueResult = await Invoice.aggregate([
      {
        $match: {
          status: { $in: activeStatuses },
          dueDate: { $lt: today },
          balanceDue: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: "$balanceDue",
          },
          children: {
            $addToSet: "$childId",
          },
          invoiceCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          invoiceCount: 1,
          childrenCount: {
            $size: "$children",
          },
        },
      },
    ]);

    const unpaidResult = await Invoice.aggregate([
      {
        $match: {
          status: {
            $nin: ["Draft", "Cancelled", "Paid"],
          },
          balanceDue: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: "$balanceDue",
          },
          children: {
            $addToSet: "$childId",
          },
          invoiceCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          invoiceCount: 1,
          childrenCount: {
            $size: "$children",
          },
        },
      },
    ]);

    const revenueFromPayments = await Invoice.aggregate([
      {
        $match: {
          status: {
            $nin: ["Draft", "Cancelled"],
          },
        },
      },
      {
        $unwind: "$payments",
      },
      {
        $match: {
          "payments.paidAt": {
            $gte: fiscalYearStart,
            $lt: fiscalYearEnd,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: "$payments.amount",
          },
          paymentCount: {
            $sum: 1,
          },
        },
      },
    ]);

    const overdue = overdueResult[0] || {};
    const unpaid = unpaidResult[0] || {};
    const revenue = revenueFromPayments[0] || {};

    const responseData = {
      overdueFees: {
        amount: overdue.totalAmount || 0,
        childrenCount: overdue.childrenCount || 0,
        invoiceCount: overdue.invoiceCount || 0,
      },

      unpaidFees: {
        amount: unpaid.totalAmount || 0,
        childrenCount: unpaid.childrenCount || 0,
        invoiceCount: unpaid.invoiceCount || 0,
      },

      totalRevenue: {
        amount: revenue.totalAmount || 0,
        paymentCount: revenue.paymentCount || 0,
        fiscalYear: now.getFullYear(),
      },
    };

    return res.status(200).json({
      success: true,
      message: "Invoice dashboard summary fetched successfully.",
      data: responseData,
    });
  } catch (error) {
    console.error("ERROR MESSAGE:", error.message);
    console.error("ERROR STACK:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch invoice dashboard summary.",
    });
  }
};

const ALLOWED_STATUSES = [
  "Pending",
  "Partially Paid",
  "Paid",
  "Overdue",
];

const getToday = () => {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
};

const syncOverdueInvoices = async (childId) => {
  await Invoice.updateMany(
    {
      childId,
      status: {
        $in: ["Pending", "Partially Paid"],
      },
      dueDate: {
        $lt: getToday(),
      },
      balanceDue: {
        $gt: 0,
      },
    },
    {
      $set: {
        status: "Overdue",
      },
    },
  );
};

exports.getChildInvoices = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;

    if (!childId || !mongoose.Types.ObjectId.isValid(childId)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized child.",
      });
    }

    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 5, 1),
      50,
    );

    const status = String(
      req.query.status || "All Statuses",
    );

    const search = String(
      req.query.search || "",
    ).trim();

    if (
      status !== "All Statuses"
      && !ALLOWED_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice status.",
      });
    }

    const childObjectId = new mongoose.Types.ObjectId(
      childId,
    );

    await syncOverdueInvoices(childObjectId);

    const query = {
      childId: childObjectId,
      status: {
        $in: ALLOWED_STATUSES,
      },
    };

    if (status !== "All Statuses") {
      query.status = status;
    }

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      query.invoiceNumber = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    const skip = (page - 1) * limit;

    const [invoices, total, summary] = await Promise.all([
      Invoice.find(query)
        .select(
          [
            "invoiceNumber",
            "invoiceDate",
            "dueDate",
            "status",
            "totalAmount",
            "paidAmount",
            "balanceDue",
            "items",
            "createdAt",
          ].join(" "),
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Invoice.countDocuments(query),

      Invoice.aggregate([
        {
          $match: {
            childId: childObjectId,
            status: {
              $in: ALLOWED_STATUSES,
            },
          },
        },
        {
          $group: {
            _id: null,

            totalBilled: {
              $sum: {
                $ifNull: ["$totalAmount", 0],
              },
            },

            totalPaid: {
              $sum: {
                $ifNull: ["$paidAmount", 0],
              },
            },

            totalDue: {
              $sum: {
                $ifNull: ["$balanceDue", 0],
              },
            },

            totalInvoices: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const stats = summary[0] || {};

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Child invoices fetched successfully.",

      data: invoices,

      stats: {
        totalBilled: stats.totalBilled || 0,
        totalPaid: stats.totalPaid || 0,
        totalDue: stats.totalDue || 0,
        totalInvoices: stats.totalInvoices || 0,
      },

      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error("getMyInvoices error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch child invoices.",
    });
  }
};

exports.getMyInvoiceById = async (req, res) => {
  try {
    const childId = req.user?._id || req.user?.id;
    const { invoiceId } = req.params;

    if (!childId || !mongoose.Types.ObjectId.isValid(childId)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized child.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID.",
      });
    }

    const childObjectId = new mongoose.Types.ObjectId(
      childId,
    );

    await syncOverdueInvoices(childObjectId);

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      childId: childObjectId,
      status: {
        $in: ALLOWED_STATUSES,
      },
    })
      .populate(
        "childId",
        "fullName email phone profileImage",
      )
      .populate(
        "parentId",
        "fullName email phone",
      )
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invoice details fetched successfully.",
      data: invoice,
    });
  } catch (error) {
    console.error("getMyInvoiceById error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice details.",
    });
  }
};
