"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-white rounded-xl shadow p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Login</h1>
        <p className="text-slate-600 mt-1">
          Sign in to access your organization workspace
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Email
          </label>
          <input
            type="email"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Password
          </label>
          <input
            type="password"
            className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? <p className="text-red-600 text-sm">{error}</p> : null}

        <button
          type="submit"
          className="bg-blue-600 text-white px-5 py-3 rounded hover:bg-blue-700"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}