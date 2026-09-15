"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  History,
  Inbox,
  LogOut,
  Menu,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SlotWithBooking } from "@/lib/domain";
import type { BookingEvent, BookingWithSlot, StudentOverview } from "@/lib/queries";
import { apiSend } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/auto-refresh";
import { BookingLinkCard } from "./booking-link-card";
import { ScheduleTab } from "./schedule-tab";
import { RequestsTab } from "./requests-tab";
import { StudentsTab } from "./students-tab";
import { HistoryTab } from "./history-tab";
import { AccountingTab } from "./accounting-tab";
import { HomeworkTab } from "./homework-tab";
import { AssistantTab } from "./assistant-tab";

export type StudentOption = { id: string; name: string };

type ViewKey =
  | "schedule"
  | "requests"
  | "students"
  | "accounting"
  | "homework"
  | "history"
  | "assistant";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface Props {
  slots: SlotWithBooking[];
  bookings: BookingWithSlot[];
  bookingUrl: string;
  unseen: number;
  overview: StudentOverview[];
  history: BookingEvent[];
}

const VIEW_TITLES: Record<ViewKey, string> = {
  schedule: "Расписание",
  requests: "Заявки",
  students: "Ученики",
  accounting: "Бухгалтерия",
  homework: "Домашние задания",
  history: "История",
  assistant: "ИИ-ассистент",
};

export function DashboardShell({ slots, bookings, bookingUrl, unseen, overview, history }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<ViewKey>("schedule");
  const [navOpen, setNavOpen] = useState(false);

  const freeSlots = useMemo(
    () => slots.filter((s) => s.is_active && !s.booking),
    [slots],
  );
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const studentOptions: StudentOption[] = useMemo(
    () => overview.map((s) => ({ id: s.id, name: s.name })),
    [overview],
  );

  const nav: NavItem[] = [
    { key: "schedule", label: "Расписание", icon: CalendarDays },
    { key: "requests", label: "Заявки", icon: Inbox, badge: pendingCount },
    { key: "students", label: "Ученики", icon: Users },
    { key: "accounting", label: "Бухгалтерия", icon: Wallet },
    { key: "homework", label: "Домашние задания", icon: BookOpen },
    { key: "history", label: "История", icon: History },
    { key: "assistant", label: "ИИ-ассистент", icon: Sparkles },
  ];

  async function logout() {
    await apiSend("/api/logout", "POST").catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  function select(key: ViewKey) {
    setActive(key);
    setNavOpen(false);
    // Открытие заявок помечает новые просмотренными.
    if (key === "requests" && unseen > 0) {
      apiSend("/api/notifications/seen", "POST").catch(() => {});
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-1 bg-sidebar p-3">
      <div className="flex items-center gap-3 px-2 py-3">
        <span className="brand-badge size-10 shrink-0">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">Расписание уроков</p>
          <p className="truncate text-xs text-muted-foreground">Панель преподавателя</p>
        </div>
        <button
          onClick={() => setNavOpen(false)}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-foreground/10 lg:hidden"
          title="Закрыть меню"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => select(item.key)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <Badge
                  variant={isActive ? "secondary" : "default"}
                  className="rounded-full px-1.5"
                >
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </nav>

      <Button variant="ghost" onClick={logout} className="justify-start gap-3 text-muted-foreground">
        <LogOut className="size-4" />
        Выйти
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1">
      <AutoRefresh seconds={12} />

      {/* Сайдбар — рабочая зона (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
        {sidebar}
      </aside>

      {/* Мобильное меню (overlay) */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Контент */}
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-foreground/10 lg:hidden"
              title="Меню"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {VIEW_TITLES[active]}
            </h1>
          </div>

          {(active === "schedule" || active === "requests") && (
            <BookingLinkCard bookingUrl={bookingUrl} />
          )}

          <div>
            {active === "schedule" && <ScheduleTab slots={slots} />}
            {active === "requests" && (
              <RequestsTab bookings={bookings} freeSlots={freeSlots} students={studentOptions} />
            )}
            {active === "students" && <StudentsTab overview={overview} />}
            {active === "accounting" && <AccountingTab />}
            {active === "homework" && <HomeworkTab />}
            {active === "history" && <HistoryTab history={history} />}
            {active === "assistant" && <AssistantTab />}
          </div>
        </div>
      </main>
    </div>
  );
}
