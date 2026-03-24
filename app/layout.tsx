import "./globals.css";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "RCOS PLATFORM",
  description: "Research Compliance Oversight System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = "Guest User";
  let organizationName = "No Organization";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (profile?.full_name) {
      fullName = profile.full_name;
    }

    if (membership?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .single();

      if (org?.name) {
        organizationName = org.name;
      }
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900">
        <AppShell
          fullName={fullName}
          organizationName={organizationName}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}