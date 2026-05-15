import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza mapas gerados pelo Wails (`{ [k]?: string }`, opcionais por
 * precaução) para `Record<string, string>`. O backend Go envia `map[string]string`,
 * então valores nunca são realmente undefined em runtime; isto torna isso explícito
 * no boundary, sem `as`.
 */
export function strMap(map?: { [_: string]: string | undefined }): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}
