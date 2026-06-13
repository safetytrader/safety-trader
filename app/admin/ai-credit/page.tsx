"use client";

import { useEffect, useState } from "react";
import { getAiCreditLogs, getAiCreditSummary } from "@/lib/db";

type AiCreditSummary = {
  user_id: string;
  numero_chiamate: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  costo_totale_eur: number;
  ultima_chiamata: string | null;
};

type AiCreditLog = {
  id: string;
  created_at: string;
  action: string;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_eur: number;
  status: string;
  error_message: string | null;
};

export default function AiCreditPage() {
  const [summary, setSummary] = useState<AiCreditSummary | null>(null);
  const [logs, setLogs] = useState<AiCreditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const summaryData = await getAiCreditSummary();
        const logsData = await getAiCreditLogs(100);

        setSummary(summaryData as AiCreditSummary);
        setLogs(logsData as AiCreditLog[]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Errore durante il caricamento dei consumi AI"
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Consumi AI / log credito</h1>
        <p className="mt-4 text-sm text-gray-500">Caricamento...</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Consumi AI / log credito</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      </main>
    );
  }

  const numeroChiamate = summary?.numero_chiamate ?? 0;
  const inputTokens = summary?.input_tokens ?? 0;
  const outputTokens = summary?.output_tokens ?? 0;
  const totalTokens = summary?.total_tokens ?? 0;
  const costoTotale = Number(summary?.costo_totale_eur ?? 0);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consumi AI / log credito</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitoraggio delle chiamate AI, token consumati e costo stimato.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Chiamate AI</p>
          <p className="mt-2 text-2xl font-semibold">{numeroChiamate}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Token input</p>
          <p className="mt-2 text-2xl font-semibold">{inputTokens}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Token output</p>
          <p className="mt-2 text-2xl font-semibold">{outputTokens}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Token totali</p>
          <p className="mt-2 text-2xl font-semibold">{totalTokens}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Costo stimato</p>
          <p className="mt-2 text-2xl font-semibold">
            € {costoTotale.toFixed(4)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Log credito AI</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ultime 100 chiamate registrate.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Azione</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Modello</th>
                <th className="px-4 py-3">Input</th>
                <th className="px-4 py-3">Output</th>
                <th className="px-4 py-3">Totale</th>
                <th className="px-4 py-3">Costo</th>
                <th className="px-4 py-3">Stato</th>
              </tr>
            </thead>

            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="px-4 py-3">
                      {new Date(log.created_at).toLocaleString("it-IT")}
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3">{log.provider}</td>
                    <td className="px-4 py-3">{log.model ?? "-"}</td>
                    <td className="px-4 py-3">{log.input_tokens}</td>
                    <td className="px-4 py-3">{log.output_tokens}</td>
                    <td className="px-4 py-3">{log.total_tokens}</td>
                    <td className="px-4 py-3">
                      € {Number(log.cost_eur ?? 0).toFixed(6)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          log.status === "success"
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-red-100 px-2 py-1 text-xs text-red-700"
                        }
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Nessun consumo AI registrato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}