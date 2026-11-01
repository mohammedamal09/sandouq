import { SandouqApp } from "@/components/sandouq-app";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          جاري تحميل الصندوق…
        </main>
      }
    >
      <SandouqApp />
    </Suspense>
  );
}
