"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/app/sidebar";
import UserMenu from "@/components/user-menu";

type AppShellProps = {
  children: React.ReactNode;
  fullName: string;
  organizationName: string;
};

export default function AppShell({
  children,
  fullName,
  organizationName,
}: AppShellProps) {
  const pathname = usePathname();

  const hideNavigation =
    pathname === "/login" ||
    pathname === "/users/reset-password" ||
    pathname === "/users/update-password";

  if (hideNavigation) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 bg-slate-100">
        <div className="flex items-center justify-end px-6 py-4">
          <UserMenu
            fullName={fullName}
            organizationName={organizationName}
          />
        </div>

        <div className="px-6 pb-6">{children}</div>
      </main>
    </div>
  );
}