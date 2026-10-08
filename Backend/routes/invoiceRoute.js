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
} = require("../controllers/invoiceController");
const { downloadInvoicePdf } = require("../controllers/invoicePdfController");

router.get("/invoice/children", protect, getInvoiceChildren);
router.get("/invoices", protect, getInvoices);
router.post("/invoice", protect, createInvoice);
router.post("/invoice/:invoiceId/payment", protect, addInvoicePayment);
router.get("/invoice/:invoiceId", protect, getInvoiceById);
router.get("/invoice/:invoiceId/download",protect, downloadInvoicePdf);
module.exports = router;
