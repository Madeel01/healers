const express = require("express");

const router = express.Router();

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  createInvoice,
  getInvoices,
  getInvoiceById,
  addInvoicePayment,
  getInvoiceChildren,
  updateInvoiceStatus,
  getInvoiceDashboardSummary,
  getChildInvoices
} = require("../controllers/invoiceController");

router.get("/invoice/children", protect, getInvoiceChildren);
router.get("/invoices", protect, getInvoices);
router.post("/invoice", protect, createInvoice);
router.post("/invoice/:invoiceId/payment", protect, addInvoicePayment);
router.get("/invoice/:invoiceId", protect, getInvoiceById);
router.patch("/invoice/:invoiceId/status", protect, updateInvoiceStatus);
router.get("/dashboard-summary", protect, getInvoiceDashboardSummary);
router.get("/child/invoices", protect, getChildInvoices);

module.exports = router;
