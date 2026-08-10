"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Периодически обновляет серверные данные страницы (только когда вкладка видима). */
export function AutoRefresh({ seconds = 12 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
