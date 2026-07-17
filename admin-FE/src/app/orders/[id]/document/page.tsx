"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { OrderDocument } from "@/lib/types";

const money = (value: string | number) => `$${Number(value).toFixed(2)}`;

const invoiceNumber = (orderId: number, createdAt: string) => {
  const year = new Date(createdAt).getFullYear();
  return `INV-${year}-${String(orderId).padStart(5, "0")}`;
};

export default function OrderDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<OrderDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<OrderDocument>(`/api/orders/${id}/document`)
      .then(setDoc)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id, user]);

  if (error) {
    return <div className="p-8 text-center text-destructive">{error}</div>;
  }

  if (!doc) {
    return <div className="p-8 text-center text-muted-foreground">Loading document...</div>;
  }

  const { order, delivery, payments, company } = doc;
  const items = order.orderdetails || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const gstAmount = company.gst.enabled ? subtotal * (company.gst.rate / 100) : 0;
  const total = subtotal + gstAmount;
  const latestPayment = payments[0];

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" onClick={() => router.push("/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="border border-border bg-white p-10 text-sm text-black print:border-none">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b border-black pb-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-dark.png" alt="Casa Yun" className="h-7 w-auto mb-2 print:h-6" />
            <h1 className="text-xl font-bold">{company.name}</h1>
            <p>{company.address}</p>
            {company.phone && <p>Tel: {company.phone}</p>}
            {company.email && <p>{company.email}</p>}
            {company.uen && <p>UEN: {company.uen}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold">
              {company.gst.enabled ? "TAX INVOICE" : "SALES INVOICE"} / DELIVERY ORDER
            </h2>
            <p>No: {invoiceNumber(order.id, order.created_at)}</p>
            <p>Date: {new Date(order.created_at).toLocaleDateString()}</p>
            <p className="uppercase">Status: {order.status}</p>
          </div>
        </div>

        {/* Bill to / Deliver to */}
        <div className="grid grid-cols-2 gap-8 border-b border-black py-6">
          <div>
            <h3 className="mb-2 font-semibold">Bill To</h3>
            <p>
              {order.user?.firstName} {order.user?.lastName}
            </p>
            <p>{order.user?.email}</p>
            {order.user?.mobile && <p>{order.user.mobile}</p>}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Deliver To</h3>
            {delivery ? (
              <>
                <p>
                  {delivery.first_name} {delivery.last_name}
                </p>
                <p>{delivery.delivery_address}</p>
                {delivery.delivery_postal && <p>Singapore {delivery.delivery_postal}</p>}
                <p>{delivery.contact}</p>
              </>
            ) : (
              <p className="text-gray-500">No delivery information</p>
            )}
          </div>
        </div>

        {/* Items */}
        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2">SKU</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-2">{item.product?.sku}</td>
                <td className="py-2">{item.product?.name}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{money(item.price)}</td>
                <td className="py-2 text-right">{money(Number(item.price) * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto mt-4 w-64">
          <div className="flex justify-between py-1">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {company.gst.enabled && (
            <div className="flex justify-between py-1">
              <span>GST ({company.gst.rate}%)</span>
              <span>{money(gstAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-black py-1 font-bold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="mt-6 border-t border-black pt-4">
          <h3 className="mb-2 font-semibold">Payment</h3>
          {latestPayment ? (
            <p>
              {latestPayment.method} — <span className="uppercase">{latestPayment.status}</span>
              {latestPayment.paid_at &&
                ` on ${new Date(latestPayment.paid_at).toLocaleDateString()}`}
            </p>
          ) : (
            <p className="text-gray-500">No payment recorded</p>
          )}
        </div>

        {/* Delivery order acknowledgement */}
        <div className="mt-8 border-t border-black pt-4">
          <h3 className="mb-2 font-semibold">Delivery Order Acknowledgement</h3>
          <p className="mb-1">
            Preferred delivery:{" "}
            {delivery?.delivery_date
              ? new Date(delivery.delivery_date).toLocaleDateString()
              : "Not specified"}{" "}
            {delivery?.delivery_slot && `(${delivery.delivery_slot})`}
          </p>
          {delivery?.remarks && <p className="mb-4">Notes: {delivery.remarks}</p>}

          <div className="mt-10 grid grid-cols-2 gap-8">
            <div>
              <div className="border-b border-black pb-8" />
              <p className="mt-1 text-xs">Received by (Name &amp; Signature)</p>
            </div>
            <div>
              <div className="border-b border-black pb-8" />
              <p className="mt-1 text-xs">Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
