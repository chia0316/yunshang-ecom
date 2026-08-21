// ORD-2026-00042 — same shape the order-document page already used locally
// for its invoice number, now the one canonical, persisted reference shown
// everywhere an order is displayed instead of the raw numeric id.
const formatOrderNumber = (id, createdAt) => {
  const year = new Date(createdAt).getFullYear();
  return `ORD-${year}-${String(id).padStart(5, '0')}`;
};

module.exports = { formatOrderNumber };
