export async function testAnalyzeDocumentsApi(prompt?: string) {
  const response = await fetch("/api/analyze-documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt:
        prompt ||
        'Rispondi solo con JSON: {"test":true,"messaggio":"ok"}',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Errore chiamata API analisi documenti");
  }

  return data;
}

export async function analyzeDocumentsTest(files: File[]) {
  const filesPayload = await Promise.all(
    files.map(async (file) => {
      const base64 = await fileToBase64(file);

      return {
        name: file.name,
        type: file.type,
        base64,
      };
    })
  );

  const response = await fetch("/api/analyze-documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: filesPayload,
      prompt:
        'Analizza questi documenti come assistente CSE. Restituisci SOLO JSON valido con questa struttura: {"maestranze":[],"checks":{},"allegati":[],"scadenzaAllegati":{},"note":""}',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Errore analisi documenti");
  }

  return data;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}