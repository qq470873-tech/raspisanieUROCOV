"use client";

import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Домашние задания — заглушка-каркас.
 * TODO(Артём): наполнение по плану. Идея: выставленное ДЗ по ученику/занятию,
 * срок сдачи, статус (задано/сдано/проверено). Нужна таблица homework.
 */
export function HomeworkTab() {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <span className="brand-badge size-12">
        <BookOpen className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Домашние задания</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Здесь будет список выставленных заданий по ученикам: что задано, к какому
          сроку и статус выполнения. Раздел в разработке.
        </p>
      </div>
    </Card>
  );
}
