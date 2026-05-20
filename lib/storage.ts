export const STORAGE_KEYS = {
  cantieri: "cse-doccheck-cantieri",
};

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const saved = localStorage.getItem(key);

  if (!saved) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch (error) {
    console.error("Errore nel caricamento da localStorage", error);
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Errore nel salvataggio su localStorage", error);
  }
}