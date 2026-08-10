"use client";

import { useEffect, useState } from "react";

/** 25 реальных интересных фактов об английском языке. */
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
  "Значок @ по-английски называется «at sign». В разных странах его зовут по-своему: у нас — «собака».",
  "Слово «alphabet» произошло от названий первых двух букв греческого алфавита — «альфа» и «бета».",
  "«Uncopyrightable» (15 букв) — самое длинное английское слово, где ни одна буква не повторяется.",
  "Палиндромы читаются одинаково в обе стороны: «level», «noon», «civic».",
  "«OK» — одно из самых узнаваемых слов на планете. Оно появилось в США в 1839 году.",
  "В среднем взрослый носитель английского знает от 20 000 до 35 000 слов.",
  "«Bookkeeper» — редкое слово, где три пары двойных букв идут подряд: oo-kk-ee.",
  "В английском алфавите 26 букв, но звуков в языке около 44.",
  "Слово «nice» когда-то означало «глупый» — за века его смысл полностью изменился.",
  "Буквы J, U и W — самые «молодые» в алфавите, они появились последними.",
];

const CHANGE_MS = 18000; // 15–20 сек

const POSES = 9;

/** Персонаж в 9 позах. В каждой позе видны обе руки. */
function Character({ pose }: { pose: number }) {
  const b = "url(#ef-body)";
  const stroke = { stroke: b, strokeWidth: 9, strokeLinecap: "round" as const, fill: "none" };

  // Левая и правая руки для каждой позы (обе всегда заданы).
  const arms: Record<number, React.ReactNode> = {
    0: ( // приветствие: левая машет вверх, правая опущена
      <>
        <path d="M40 70 Q22 66 26 48" {...stroke} />
        <path d="M80 72 q14 6 12 22" {...stroke} />
      </>
    ),
    1: ( // идея: правая вверх к лампочке, левая опущена
      <>
        <path d="M80 70 Q98 60 96 40" {...stroke} />
        <circle cx="96" cy="30" r="8" fill="oklch(0.85 0.16 90)" />
        <rect x="93" y="37" width="6" height="4" rx="1" fill="oklch(0.5 0.05 90)" />
        <path d="M40 72 q-14 6 -12 22" {...stroke} />
      </>
    ),
    2: ( // задумчивость: правая к подбородку, левая опущена
      <>
        <path d="M78 74 Q70 62 60 58" {...stroke} />
        <path d="M40 72 q-14 6 -12 22" {...stroke} />
      </>
    ),
    3: ( // радость: обе вверх
      <>
        <path d="M40 70 Q24 58 28 40" {...stroke} />
        <path d="M80 70 Q96 58 92 40" {...stroke} />
      </>
    ),
    4: ( // с книгой: обе вперёд + книга
      <>
        <path d="M40 74 q-6 10 -2 20" {...stroke} />
        <path d="M80 74 q6 10 2 20" {...stroke} />
        <g transform="translate(60,98)">
          <path d="M-20 0 L0 -4 L0 12 L-20 16 Z" fill="oklch(0.97 0.02 285)" stroke="oklch(0.5 0.1 285)" strokeWidth="1.5" />
          <path d="M20 0 L0 -4 L0 12 L20 16 Z" fill="oklch(0.97 0.02 285)" stroke="oklch(0.5 0.1 285)" strokeWidth="1.5" />
        </g>
      </>
    ),
    5: ( // peace: правая вверх «V», левая опущена
      <>
        <path d="M80 70 Q92 58 90 46" {...stroke} />
        <path d="M86 48 l4 -8" {...stroke} strokeWidth={5} />
        <path d="M92 48 l1 -9" {...stroke} strokeWidth={5} />
        <path d="M40 72 q-14 6 -12 22" {...stroke} />
      </>
    ),
    6: ( // показывает влево (на облако): левая вытянута, правая опущена
      <>
        <path d="M40 72 Q22 72 12 66" {...stroke} />
        <path d="M80 72 q14 6 12 22" {...stroke} />
      </>
    ),
    7: ( // руки в боки
      <>
        <path d="M42 72 Q26 78 40 92" {...stroke} />
        <path d="M78 72 Q94 78 80 92" {...stroke} />
      </>
    ),
    8: ( // пишет карандашом: правая вниз с карандашом, левая опущена
      <>
        <path d="M80 74 Q92 84 84 98" {...stroke} />
        <path d="M40 74 q-8 8 -4 18" {...stroke} />
        <g transform="rotate(35 86 100)">
          <rect x="83" y="92" width="6" height="18" rx="1" fill="oklch(0.8 0.15 85)" />
          <path d="M83 110 L89 110 L86 116 Z" fill="oklch(0.4 0.05 60)" />
        </g>
      </>
    ),
  };

  const mouthOpen = pose === 3;
  const mouthSmall = pose === 2;

  return (
    <svg viewBox="0 0 120 145" width="120" height="145" className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id="ef-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.24 285)" />
          <stop offset="1" stopColor="oklch(0.55 0.2 250)" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="136" rx="30" ry="5" fill="oklch(0.55 0.05 285 / 0.25)" />

      <g transform={pose === 3 ? "translate(0,-6)" : ""}>
        {/* ноги */}
        <rect x="46" y="104" width="9" height="20" rx="4" fill={b} />
        <rect x="65" y="104" width="9" height="20" rx="4" fill={b} />
        {/* тело */}
        <rect x="38" y="60" width="44" height="52" rx="20" fill={b} />
        {/* руки */}
        {arms[pose] ?? arms[0]}
        {/* голова */}
        <circle cx="60" cy="40" r="24" fill={b} />
        {/* глаза */}
        <circle cx="51" cy="38" r="4.5" fill="white" />
        <circle cx="69" cy="38" r="4.5" fill="white" />
        <circle cx={pose === 1 ? 52.5 : 51} cy="39" r="2.3" fill="oklch(0.2 0.02 285)" />
        <circle cx={pose === 1 ? 70.5 : 69} cy="39" r="2.3" fill="oklch(0.2 0.02 285)" />
        {/* рот */}
        {mouthOpen ? (
          <path d="M52 48 Q60 58 68 48 Q60 52 52 48 Z" fill="oklch(0.3 0.05 20)" />
        ) : mouthSmall ? (
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

  const pose = i % POSES;

  return (
    <section className="mt-12">
      <div className="flex items-end justify-end gap-2 sm:gap-3">
        <div
          key={i}
          className="relative max-w-md flex-1 animate-in fade-in slide-in-from-bottom-2 rounded-2xl rounded-br-sm border border-border bg-card p-4 text-sm shadow-md duration-500 sm:flex-none"
        >
          {/* хвостик облака справа — к персонажу */}
          <span className="absolute -right-2 bottom-3 size-4 rotate-45 border-r border-t border-border bg-card" />
          {FACTS[i]}
        </div>
        <Character pose={pose} />
      </div>
    </section>
  );
}
