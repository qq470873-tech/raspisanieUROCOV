"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Slot, SlotWithBooking } from "@/lib/domain";
import type { BookingEvent, BookingWithSlot, StudentOverview } from "@/lib/queries";
import { apiSend } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/auto-refresh";
import { ScheduleTab } from "./schedule-tab";
import { StudentsTab } from "./students-tab";
import { AccountingTab } from "./accounting-tab";
import { HomeworkTab } from "./homework-tab";
import { AssistantTab } from "./assistant-tab";
import type { StudentOption } from "./booking-dialogs";

type ViewKey = "assistant" | "schedule" | "accounting" | "homework" | "students";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
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
  assistant: "ИИ-ассистент",
  schedule: "Расписание",
  accounting: "Бухгалтерия",
  homework: "Домашние задания",
  students: "Ученики",
};

const NAV: NavItem[] = [
  { key: "assistant", label: "ИИ-ассистент", icon: Sparkles },
  { key: "schedule", label: "Расписание", icon: CalendarDays },
  { key: "accounting", label: "Бухгалтерия", icon: Wallet },
  { key: "homework", label: "Домашние задания", icon: BookOpen },
  { key: "students", label: "Ученики", icon: Users },
];

export function DashboardShell({ slots, overview, history }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<ViewKey>("schedule");
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const freeSlots = useMemo(() => slots.filter((s) => s.is_active && !s.booking) as Slot[], [slots]);
  const studentOptions: StudentOption[] = useMemo(
    () => overview.map((s) => ({ id: s.id, name: s.name })),
    [overview],
  );

  async function logout() {
    await apiSend("/api/logout", "POST").catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  function select(key: ViewKey) {
    setActive(key);
    setNavOpen(false);
  }

  const sidebar = (full: boolean) => (
    <div className="flex h-full flex-col gap-1 bg-sidebar p-3">
      <div className={cn("flex items-center gap-3 px-1 py-3", !full && "justify-center px-0")}>
        <span className="brand-badge size-10 shrink-0">
          <GraduationCap className="size-5" />
        </span>
        {full && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">Расписание уроков</p>
            <p className="truncate text-xs text-muted-foreground">Панель преподавателя</p>
          </div>
        )}
        <button
          onClick={() => setNavOpen(false)}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-foreground/10 lg:hidden"
          title="Закрыть меню"
        >
          <X className="size-5" />
        </button>
      </div>

      <button
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? "Развернуть меню" : "Свернуть меню"}
        className={cn(
          "mb-1 hidden items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent lg:flex",
          !full && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4 shrink-0" />
        ) : (
          <PanelLeftClose className="size-4 shrink-0" />
        )}
        {full && <span>Свернуть</span>}
      </button>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => select(item.key)}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                !full && "justify-center px-0",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {full && <span className="flex-1 text-left">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <Button
        variant="ghost"
        onClick={logout}
        title="Выйти"
        className={cn("gap-3 text-muted-foreground", full ? "justify-start" : "justify-center px-0")}
      >
        <LogOut className="size-4" />
        {full && "Выйти"}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1">
      <AutoRefresh seconds={20} />

      {/* Сайдбар (desktop) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {sidebar(!collapsed)}
      </aside>

      {/* Мобильное меню */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-xl">
            {sidebar(true)}
          </div>
        </div>
      )}

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
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{VIEW_TITLES[active]}</h1>
          </div>

          <div>
            {active === "assistant" && <AssistantTab />}
            {active === "schedule" && (
              <ScheduleTab
                slots={slots}
                freeSlots={freeSlots}
                students={studentOptions}
                history={history}
              />
            )}
            {active === "accounting" && <AccountingTab />}
            {active === "homework" && <HomeworkTab />}
            {active === "students" && <StudentsTab overview={overview} />}
          </div>
        </div>
      </main>
    </div>
  );
}
