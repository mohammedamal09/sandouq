"use client";

import { useState } from "react";
import { get } from "idb-keyval";
import { createClient } from "@supabase/supabase-js";
import { FileImage } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReceiptButton({
  receiptId,
  privacy,
}: {
  receiptId: string;
  privacy: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function openReceipt() {
    setBusy(true);
    const windowRef = window.open("", "_blank");
    if (windowRef) windowRef.opener = null;
    try {
      const ref = receiptId.replace(/^receipt:/, "");
      if (!ref.includes("/")) {
        const file = await get<File>(`sandouq:receipt:${ref}`);
        if (!file) throw new Error("صورة الوصل ما بقاتش محفوظة فهاد الجهاز");
        const url = URL.createObjectURL(file);
        if (windowRef) windowRef.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const cloudUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
          key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!cloudUrl || !key) throw new Error("السحابة غير مهيأة");
        const client = createClient(cloudUrl, key);
        const { data, error } = await client.storage
          .from("sandouq-receipts")
          .createSignedUrl(ref, 300);
        if (error || !data?.signedUrl)
          throw error ?? new Error("تعذر فتح الوصل");
        if (windowRef) windowRef.location.href = data.signedUrl;
        else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      windowRef?.close();
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy || privacy}
      onClick={() => void openReceipt()}
    >
      <FileImage className="size-3.5" /> وصل
    </Button>
  );
}
