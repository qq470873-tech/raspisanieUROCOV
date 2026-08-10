"use client";

import { useState } from "react";

export function SiteFooter() {
  const [open, setOpen] = useState(false);

  return (
    <footer className="no-print relative mt-auto flex justify-center py-6">
      {/* Клик вне окошка — закрыть */}
      {open && <button aria-label="Закрыть" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />}

      <div className="relative z-50">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
        >
          <span
            className="inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.24 285), oklch(0.55 0.2 250))" }}
          >
            P
          </span>
          <span className="font-medium">PARAweb</span>
        </button>

        {open && (
          <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-border bg-card p-4 text-sm shadow-xl duration-200">
            <p className="mb-3 text-foreground">
              Нужен сайт, проект или дизайн любой сложности? Сделаем 💜
            </p>
            <a
              href="https://t.me/Paradoxllt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
            >
              Telegram: @Paradoxllt
            </a>
            <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
          </div>
        )}
      </div>
    </footer>
  );
}
