import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "./sidebar";

export const metadata: Metadata = {
  title: "RCOS",
  description: "Research Compliance Oversight System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100">
        <div className="min-h-screen flex">
          <Sidebar />
          <main className="flex-1 p-6 bg-gradient-to-br from-slate-100 to-slate-200 min-h-screen relative z-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}