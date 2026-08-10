"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="gap-1.5">
      <Printer className="size-4" /> Печать
    </Button>
  );
}
