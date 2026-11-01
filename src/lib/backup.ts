import { createClient } from "@supabase/supabase-js";
import { get, set } from "idb-keyval";
import { type TreasuryState } from "./domain";
import { validateImport } from "./report";

export type Backup = {
  format: "sandouq-backup";
  version: 1;
  state: TreasuryState;
  receipts: Record<string, string>;
};
const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("السحابة غير مهيأة");
  return createClient(url, key);
}
function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
export async function receiptFile(id: string): Promise<File> {
  const ref = id.replace(/^receipt:/, "");
  if (!ref.includes("/")) {
    const file = await get<File>(`sandouq:receipt:${ref}`);
    if (!file) throw new Error("صورة وصل محلية ناقصة");
    return file;
  }
  const { data, error } = await client()
    .storage.from("sandouq-receipts")
    .download(ref);
  if (error || !data) throw error ?? new Error("تعذر تحميل الوصل");
  const name = ref.split("/").at(-1) || "receipt";
  const type =
    data.type ||
    (name.endsWith(".png")
      ? "image/png"
      : name.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg");
  return new File([data], name, { type });
}
export async function makeBackup(state: TreasuryState): Promise<Backup> {
  const receipts: Record<string, string> = {};
  for (const expense of state.expenses)
    if (expense.receiptId) {
      const file = await receiptFile(expense.receiptId);
      if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024)
        throw new Error("صورة وصل غير مدعومة فالنسخ الاحتياطي");
      receipts[expense.id] = await asDataUrl(file);
    }
  return { format: "sandouq-backup", version: 1, state, receipts };
}
export function parseBackup(raw: unknown): Backup {
  if (
    raw &&
    typeof raw === "object" &&
    (raw as Backup).format === "sandouq-backup"
  ) {
    const backup = raw as Backup;
    if (
      backup.version !== 1 ||
      !backup.receipts ||
      typeof backup.receipts !== "object"
    )
      throw new Error("نسخة احتياطية غير صالحة");
    const state = validateImport(backup.state);
    for (const [id, data] of Object.entries(backup.receipts)) {
      if (
        !state.expenses.some((e) => e.id === id) ||
        typeof data !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,/.test(data) ||
        data.length > 7_500_000
      )
        throw new Error("صورة وصل غير صالحة فالنسخة");
    }
    return {
      format: "sandouq-backup",
      version: 1,
      state,
      receipts: backup.receipts,
    };
  }
  return {
    format: "sandouq-backup",
    version: 1,
    state: validateImport(raw),
    receipts: {},
  };
}
export async function filesFromBackup(backup: Backup) {
  const files: Record<string, File> = {};
  for (const [id, data] of Object.entries(backup.receipts)) {
    const blob = await (await fetch(data)).blob();
    if (!allowed.has(blob.type) || blob.size > 5 * 1024 * 1024)
      throw new Error("صورة وصل غير صالحة فالنسخة");
    files[id] = new File(
      [blob],
      `receipt-${id}.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`,
      { type: blob.type },
    );
  }
  return files;
}
export async function restoreLocalBackup(backup: Backup) {
  const state = structuredClone(backup.state);
  const files = await filesFromBackup(backup);
  for (const expense of state.expenses) {
    if (files[expense.id]) {
      expense.receiptId = `receipt:${expense.id}`;
      await set(`sandouq:receipt:${expense.id}`, files[expense.id]);
    } else expense.receiptId = undefined;
  }
  return state;
}
