"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FolderTree,
  Users,
  BarChart3,
  PieChart,
  Tag,
  Mail,
  Settings,
  KeyRound,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Categories", url: "/categories", icon: FolderTree },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Coupons", url: "/coupons", icon: Tag },
  { title: "Enquiries", url: "/enquiries", icon: Mail },
  { title: "Sales Report", url: "/reports/sales", icon: BarChart3 },
  { title: "Fulfilment Report", url: "/reports/category-fulfillment", icon: PieChart },
];

const settingsItems = [{ title: "Settings", url: "/settings", icon: Settings }];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-icon.png"
            alt="Casa Yun"
            className="h-8 w-8 shrink-0 group-data-[collapsible=icon]:block hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-dark.png"
            alt="Casa Yun"
            className="h-7 w-auto group-data-[collapsible=icon]:hidden"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Store</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={user?.firstName || "Account"}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {user?.firstName?.[0]?.toUpperCase() || "A"}
              </div>
              <span>{user?.firstName || "Admin"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setPasswordDialogOpen(true)} tooltip="Change password">
              <KeyRound />
              <span>Change Password</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Log out">
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </Sidebar>
  );
}
