import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-slate-800 text-white flex flex-col min-h-screen border-r border-slate-700 relative z-30">
      <div className="p-6 text-2xl font-bold border-b border-slate-700">
        RCOS
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Link
          href="/"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Dashboard
        </Link>

        <Link
          href="/projects"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Projects
        </Link>

        <Link
          href="/personnel"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Personnel
        </Link>

        <Link
          href="/artifacts"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Documents
        </Link>

        <Link
          href="/users"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Manage Users
        </Link>

        <Link
          href="/admin"
          className="block w-full px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white transition"
        >
          Admin
        </Link>
      </nav>
    </aside>
  );
}