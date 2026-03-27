import Link from "next/link";

type SidebarProps = {
  pathname?: string;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/personnel", label: "Personnel" },
  { href: "/cmmc-compliance", label: "CMMC Compliance" },
  { href: "/compliance-team", label: "Compliance Team" },
  { href: "/users", label: "Manage Users" },
  { href: "/admin", label: "Admin" },
];

export default function Sidebar({ pathname = "" }: SidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-slate-950 text-white border-r border-slate-800">
      <div className="px-6 py-6 border-b border-slate-800">
        <div className="text-3xl font-bold tracking-tight">RCOS</div>
      </div>

      <nav className="px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}