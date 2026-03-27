"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-10">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
          <div className="flex flex-col justify-between bg-slate-900 px-8 py-10 text-white lg:px-12 lg:py-14">
            <div>
              <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200">
                RCOS Platform
              </div>

              <h1 className="mt-6 text-4xl font-bold leading-tight lg:text-5xl">
                Research Compliance
                <br />
                Oversight System
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 lg:text-base">
                Centralize project oversight, personnel authorization,
                compliance artifacts, and readiness tracking in one workspace.
              </p>
            </div>

            <div className="mt-10 grid gap-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-slate-800 bg-slate-800/70 p-4">
                <div className="font-semibold text-white">
                  Project-level visibility
                </div>
                <div className="mt-1">
                  Track classification, export control status, PoP, and current
                  readiness by project.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-800/70 p-4">
                <div className="font-semibold text-white">
                  Personnel and document control
                </div>
                <div className="mt-1">
                  Maintain authorized personnel, required training, and
                  supporting compliance records in one place.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-10 lg:px-12 lg:py-14">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <div className="text-sm font-medium uppercase tracking-wide text-blue-600">
                  Sign In
                </div>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Welcome back
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Sign in to access your RCOS organization workspace.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-900">
                      Password
                    </label>

                    <Link
                      href="/users/reset-password"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Enter password"
                    required
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500">
                RCOS helps organizations manage research compliance oversight,
                readiness, and controlled project administration.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}