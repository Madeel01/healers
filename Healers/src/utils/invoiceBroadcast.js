import { createBroadcast } from '../api/admin/api';

export const sendInvoiceBroadcast = async (invoice) => {
  const childId = typeof invoice.childId === "object"
    ? invoice.childId?._id || invoice.childId?.id
    : invoice.childId;

  if (!childId) {
    throw new Error("Child ID is missing.");
  }

  const invoiceNumber = invoice.invoiceNumber || "New Invoice";

  const amount = Number(invoice.totalAmount || 0).toLocaleString(
    "en-PK",
    {
      maximumFractionDigits: 2,
    },
  );

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString("en-PK")
    : "Not specified";

  const fd = new FormData();

  fd.append("title", "New Invoice Generated");

  fd.append(
    "message",
    `Your invoice ${invoiceNumber} of PKR ${amount} has been generated. Due date: ${dueDate}. Please check your billing section.`,
  );

  fd.append("audience", "users");
  fd.append("type", "Reminder");
  fd.append("users", JSON.stringify([String(childId)]));
  fd.append("deliverySchedule", "now");

  const response = await createBroadcast(fd);

  const result = response?.data?.success
    ? response.data
    : response;

  if (!result?.success) {
    throw new Error(
      result?.message || "Failed to create invoice broadcast.",
    );
  }

  return result;
};
