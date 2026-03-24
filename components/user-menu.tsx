"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import LogoutButton from "@/components/logout-button";

type Props = {
  userId: string;
  fullName: string;
  email: string;
  organizationName: string;
  phone: string | null;
  contactTitle: string | null;
};

export default function UserMenu({
  userId,
  fullName,
  email,
  organizationName,
  phone,
  contactTitle,
}: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [phoneValue, setPhoneValue] = useState(phone || "");
  const [contactTitleValue, setContactTitleValue] = useState(contactTitle || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const initials = useMemo(() => {
    const parts = fullName?.trim().split(" ").filter(Boolean) || [];
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [fullName]);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        phone: phoneValue,
        contact_title: contactTitleValue,
      })
      .eq("id", userId);

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Profile updated.");
    setSaving(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 hover:bg-slate-100 transition"
      >
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-700">
          {initials}
        </div>
        <div className="text-left">
          <div className="text-slate-800 font-medium leading-tight">
            {fullName}
          </div>
          <div className="text-xs text-slate-500 leading-tight">
            {organizationName}
          </div>
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 mt-3 w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl p-5 z-50">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Profile
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                User Name
              </label>
              <input
                value={fullName}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Organization
              </label>
              <input
                value={organizationName}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                value={email}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder="Enter phone number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Title
              </label>
              <input
                value={contactTitleValue}
                onChange={(e) => setContactTitleValue(e.target.value)}
                placeholder="Example: ISO, Export Control Officer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
              />
            </div>

            {message ? (
              <p className="text-sm text-slate-600">{message}</p>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Contact Info"}
              </button>

              <LogoutButton />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}