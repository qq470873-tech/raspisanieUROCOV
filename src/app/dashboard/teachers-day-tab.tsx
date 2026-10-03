"use client";

export function TeachersDayTab() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-rose-300/60 bg-gradient-to-br from-rose-50 via-amber-50 to-pink-100 p-6 shadow-sm dark:border-rose-500/30 dark:from-rose-950/40 dark:via-amber-950/30 dark:to-pink-950/40">
        <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">Мама, с Днём учителя! 💐</p>
        <div className="mt-3 space-y-2 text-base leading-relaxed text-foreground/90">
          <p>
            Спасибо тебе за терпение, доброту и за то, что каждый урок ты вкладываешь душу. Твои ученики
            счастливчики — у них самый лучший учитель, а у меня самая лучшая мама.
          </p>
          <p>
            Желаю тебе сил, вдохновения, благодарных учеников и побольше времени на себя. Я тобой очень горжусь
            и очень тебя люблю ❤️
          </p>
          <p className="pt-1 font-semibold text-rose-600 dark:text-rose-300">— Твой Артём</p>
        </div>
      </div>

      <video
        src="/video/teachers-day.mp4"
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-2xl bg-black shadow-lg"
      />
    </div>
  );
}
