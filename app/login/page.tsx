"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlError = useSearchParams().get("error");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setSent(true);
    else setError((await res.json()).error ?? "Error al enviar el enlace");
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="text-2xl font-semibold mb-2">Acceso</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Sin contraseñas: te enviamos un enlace mágico por email.
        En desarrollo, los emails se ven en{" "}
        <a href="http://localhost:8025" target="_blank" className="underline">MailHog</a>.
      </p>
      {sent ? (
        <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4">
          Enlace enviado a <strong>{email}</strong>. Revisa MailHog y haz clic para entrar.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2"
          />
          <button className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700">
            Enviarme el enlace
          </button>
          {(error || urlError) && (
            <p className="text-sm text-red-600">{error ?? `Error: ${urlError}`}</p>
          )}
        </form>
      )}
      <p className="text-xs text-zinc-400 mt-6">
        Demo: <code>admin@bonos.local</code> (admin), <code>ana@inversores.local</code> (inversor)
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
