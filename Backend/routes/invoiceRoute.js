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
const requirePermission = require("../middleware/requirePermission");

router.get("/invoice/children", protect, requirePermission("invoices"),getInvoiceChildren);
router.get("/invoices", protect, requirePermission("invoices"),getInvoices);
router.post("/invoice", protect, requirePermission("invoices"),createInvoice);
router.post("/invoice/:invoiceId/payment", protect, requirePermission("invoices"),addInvoicePayment);
router.get("/invoice/:invoiceId", protect, requirePermission("invoices"),getInvoiceById);
router.patch("/invoice/:invoiceId/status", protect, requirePermission("invoices"),updateInvoiceStatus);
router.get("/dashboard-summary", protect, requirePermission("invoices"),getInvoiceDashboardSummary);
router.get("/child/invoices", protect, requirePermission("invoices"),getChildInvoices);

module.exports = router;
