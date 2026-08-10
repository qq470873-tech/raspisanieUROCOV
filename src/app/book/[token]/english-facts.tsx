"use client";

import { useEffect, useState } from "react";

/** 15 реальных интересных фактов об английском языке. */
const FACTS = [
  "Буква E — самая частая в английском языке. А самое длинное слово без обычных гласных (a, e, i, o, u) — «rhythms».",
  "Слово «run» — рекордсмен: у него больше всего значений в английском, по Оксфордскому словарю их несколько сотен.",
  "Английский — язык неба. Все пилоты и авиадиспетчеры мира ведут переговоры по-английски, в какой бы стране ни находились.",
  "Фраза «The quick brown fox jumps over the lazy dog» содержит все 26 букв алфавита. Такие предложения называют панграммами.",
  "Слово «goodbye» когда-то было целой фразой «God be with ye» — «Бог да пребудет с тобой».",
  "К слову «orange» в английском нет точной рифмы — ни одно слово не рифмуется с ним идеально.",
  "Буквосочетание «ough» читается до восьми разных способов: though, through, cough, rough, thought…",
  "Значок & (амперсанд) когда-то считался 27-й «буквой» английского алфавита.",
  "Около 30% английских слов пришли из французского — после завоевания Англии в 1066 году.",
  "Английский — самый изучаемый язык в мире: его учат больше миллиарда человек.",
  "Точка над буквами «i» и «j» называется «tittle» (маленькая, но со своим именем!).",
  "Уильям Шекспир придумал сотни слов и выражений, например «eyeball» и «break the ice» — «растопить лёд».",
  "«Dreamt» — практически единственное распространённое английское слово, оканчивающееся на «-mt».",
  "Самое частое слово во всех английских текстах — «the».",
  "Во многих словах есть немые буквы: «knife», «gnome», «hour» — их пишут, но не произносят.",
];

const CHANGE_MS = 18000; // 15–20 сек

/** Персонаж в 5 позах. pose = 0..4 */
function Character({ pose }: { pose: number }) {
  return (
    <svg viewBox="0 0 120 140" width="96" height="112" className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id="ef-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.24 285)" />
          <stop offset="1" stopColor="oklch(0.55 0.2 250)" />
        </linearGradient>
      </defs>

      {/* тень */}
      <ellipse cx="60" cy="132" rx="30" ry="5" fill="oklch(0.55 0.05 285 / 0.25)" />

      {/* поза 3 — прыжок: приподнимаем всего персонажа */}
      <g transform={pose === 3 ? "translate(0,-6)" : ""}>
        {/* ноги */}
        <rect x="46" y="104" width="9" height="20" rx="4" fill="url(#ef-body)" />
        <rect x="65" y="104" width="9" height="20" rx="4" fill="url(#ef-body)" />

        {/* тело */}
        <rect x="38" y="60" width="44" height="52" rx="20" fill="url(#ef-body)" />

        {/* руки по позам */}
        {pose === 0 && (
          <>
            {/* приветствие */}
            <path d="M40 70 Q22 66 26 48" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M80 72 q14 6 12 22" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </>
        )}
        {pose === 1 && (
          <>
            {/* указывает вверх + лампочка */}
            <path d="M80 70 Q98 60 96 40" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <circle cx="96" cy="30" r="8" fill="oklch(0.85 0.16 90)" />
            <rect x="93" y="37" width="6" height="4" rx="1" fill="oklch(0.5 0.05 90)" />
            <path d="M40 72 q-14 6 -12 22" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </>
        )}
        {pose === 2 && (
          <>
            {/* задумчивость — рука к подбородку */}
            <path d="M78 74 Q70 62 60 58" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M40 72 q-14 6 -12 22" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </>
        )}
        {pose === 3 && (
          <>
            {/* радость — обе руки вверх */}
            <path d="M40 70 Q24 58 28 40" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M80 70 Q96 58 92 40" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </>
        )}
        {pose === 4 && (
          <>
            {/* с книгой */}
            <path d="M40 74 q-6 8 -2 18" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M80 74 q6 8 2 18" stroke="url(#ef-body)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <g transform="translate(60,96)">
              <path d="M-20 0 L0 -4 L0 12 L-20 16 Z" fill="oklch(0.97 0.02 285)" stroke="oklch(0.5 0.1 285)" strokeWidth="1.5" />
              <path d="M20 0 L0 -4 L0 12 L20 16 Z" fill="oklch(0.97 0.02 285)" stroke="oklch(0.5 0.1 285)" strokeWidth="1.5" />
            </g>
          </>
        )}

        {/* голова */}
        <circle cx="60" cy="40" r="24" fill="url(#ef-body)" />
        {/* глаза */}
        <circle cx="51" cy="38" r="4.5" fill="white" />
        <circle cx="69" cy="38" r="4.5" fill="white" />
        <circle cx={pose === 1 ? 52.5 : 51} cy="39" r="2.3" fill="oklch(0.2 0.02 285)" />
        <circle cx={pose === 1 ? 70.5 : 69} cy="39" r="2.3" fill="oklch(0.2 0.02 285)" />
        {/* рот: улыбка / открытый (радость) / маленький (задумчивость) */}
        {pose === 3 ? (
          <path d="M52 48 Q60 58 68 48 Q60 52 52 48 Z" fill="oklch(0.3 0.05 20)" />
        ) : pose === 2 ? (
          <circle cx="60" cy="49" r="2.5" fill="oklch(0.3 0.05 20)" />
        ) : (
          <path d="M52 48 Q60 55 68 48" stroke="oklch(0.3 0.05 20)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        {/* румянец */}
        <circle cx="46" cy="46" r="3" fill="oklch(0.8 0.12 20 / 0.5)" />
        <circle cx="74" cy="46" r="3" fill="oklch(0.8 0.12 20 / 0.5)" />
      </g>
    </svg>
  );
}

export function EnglishFacts() {
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));

  useEffect(() => {
    const id = setInterval(() => setI((prev) => (prev + 1) % FACTS.length), CHANGE_MS);
    return () => clearInterval(id);
  }, []);

  const pose = i % 5;

  return (
    <section className="mt-12">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Интересное об английском
      </p>
      <div className="flex items-end justify-center gap-3">
        <Character pose={pose} />
        <div
          key={i}
          className="relative max-w-md animate-in fade-in slide-in-from-bottom-2 rounded-2xl rounded-bl-sm border border-border bg-card p-4 text-sm shadow-md duration-500"
        >
          {/* хвостик облака к персонажу */}
          <span className="absolute -left-2 bottom-3 size-4 rotate-45 border-b border-l border-border bg-card" />
          {FACTS[i]}
        </div>
      </div>
    </section>
  );
}
