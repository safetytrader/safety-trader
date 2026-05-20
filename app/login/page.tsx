"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);

  function showMsg(text: string, type: "error" | "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function handleSignIn() {
    if (!email || !password) {
      showMsg("Inserisci email e password.", "error");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      showMsg(err?.message || "Accesso non riuscito.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      showMsg("Inserisci email e password.", "error");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const data = await signUp(email, password);
      const user = data?.user;
      if (user && !user.email_confirmed_at) {
        showMsg("Registrazione inviata. Controlla la email per confermare l’account, poi accedi.", "success");
      } else {
        showMsg("Registrazione completata. Ora puoi accedere.", "success");
      }
    } catch (err) {
      showMsg(err?.message || "Registrazione non riuscita.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-800">Accedi</h1>
        <p className="mb-6 text-sm text-slate-500">Autenticazione Supabase (email e password)</p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoComplete="current-password"
            />
          </div>

          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                messageType === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Attendere..." : "Accedi"}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Registrati
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
