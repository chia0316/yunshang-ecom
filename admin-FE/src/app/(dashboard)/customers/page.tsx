"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useConfirm } from "@/components/confirm-provider";
import type { User } from "@/lib/types";

export default function CustomersPage() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<"Active" | "Suspended">("Active");
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCustomers = (targetStatus: "Active" | "Suspended") => {
    setLoading(true);
    apiFetch<{ userList: User[] }>(`/api/admin/usersList/${targetStatus}`)
      .then((res) => setCustomers(res.userList))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to load customers")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers(status);
  }, [status]);

  const toggleStatus = async (customer: User) => {
    const nextStatus = customer.status === "Active" ? "Suspended" : "Active";
    const suspending = nextStatus === "Suspended";
    const ok = await confirm({
      title: `${suspending ? "Suspend" : "Reactivate"} ${customer.firstName} ${customer.lastName}?`,
      confirmLabel: suspending ? "Suspend" : "Reactivate",
      variant: suspending ? "destructive" : "default",
    });
    if (!ok) return;
    try {
      await apiFetch("/api/admin/updateUserData", {
        method: "PUT",
        body: JSON.stringify({ userId: customer.id, status: nextStatus }),
      });
      toast.success(`Customer ${nextStatus.toLowerCase()}`);
      loadCustomers(status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Manage customer accounts
        </p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as "Active" | "Suspended")}>
        <TabsList>
          <TabsTrigger value="Active">Active</TabsTrigger>
          <TabsTrigger value="Suspended">Suspended</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No {status.toLowerCase()} customers.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="hover:underline"
                    >
                      {customer.firstName} {customer.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.mobile || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">{customer.orderCount ?? 0}</TableCell>
                  <TableCell className="text-right">
                    ${Number(customer.totalSpent ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.status === "Active" ? "success" : "destructive"}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(customer)}>
                      {customer.status === "Active" ? "Suspend" : "Reactivate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
