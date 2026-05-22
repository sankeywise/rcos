"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainNav = [
  { label: "Action Center", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "Project Compliance", href: "/project-compliance" },
  { label: "Personnel", href: "/personnel" },
];

const complianceNav = [
  { label: "CMMC Controls", href: "/cmmc-compliance" },
  { label: "Policies", href: "/cmmc-compliance/policies" },
  { label: "SPRS / SSP / POA&M", href: "/cmmc-compliance/sprs-ssp-poam" },
  { label: "Reports", href: "/cmmc-compliance/reports" },
];

const bottomNav = [
  { label: "Incident Reporting", href: "/incident-reporting" },
  { label: "POA&M / Corrective Actions", href: "/corrective-actions" },
  { label: "Audit Mode", href: "/audit-mode" },
  { label: "Compliance Team", href: "/compliance-team" },
  { label: "Manage Users", href: "/users" },
  { label: "Admin", href: "/admin" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const complianceActive = pathname.startsWith("/cmmc-compliance");

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-slate-950 text-white">
      <div className="flex h-full flex-col">
        <div className="px-6 py-6">
          <div className="text-3xl font-bold tracking-tight">RCOS</div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                isActive(pathname, item.href)
                  ? "bg-blue-600 text-white"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="pt-2">
            <Link
              href="/cmmc-compliance"
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                complianceActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <span>Compliance</span>
              <span className="text-xs">{complianceActive ? "⌃" : "⌄"}</span>
            </Link>

            {complianceActive && (
              <div className="ml-4 mt-2 space-y-1 border-l border-slate-700 pl-3">
                {complianceNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      isActive(pathname, item.href)
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {bottomNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                isActive(pathname, item.href)
                  ? "bg-blue-600 text-white"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="text-sm font-semibold">Test University</div>
            <div className="text-xs text-slate-400">Organization</div>
          </div>
        </div>
      </div>
    </aside>
  );
}