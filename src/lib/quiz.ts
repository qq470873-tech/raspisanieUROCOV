/**
 * Тренажёр английского. Вопросы ориентированы на программу российской школы
 * (УМК «Английский в фокусе» / Spotlight и Enjoy English), уровни — по классам.
 */

export type QuizQuestion = { q: string; options: string[]; answer: number };
export type QuizLevel = { id: string; title: string; grades: string; questions: QuizQuestion[] };

export const QUIZ_LEVELS: QuizLevel[] = [
  {
    id: "1-4",
    title: "Начальный",
    grades: "2–4 класс",
    questions: [
      { q: "Как по-английски «кошка»?", options: ["cat", "dog", "cow", "hen"], answer: 0 },
      { q: "«Синий» — это…", options: ["green", "blue", "red", "black"], answer: 1 },
      { q: "«Собака» по-английски?", options: ["dog", "frog", "fox", "pig"], answer: 0 },
      { q: "Сколько будет «three»?", options: ["2", "3", "5", "10"], answer: 1 },
      { q: "«Мама» по-английски?", options: ["sister", "mother", "brother", "father"], answer: 1 },
      { q: "Выбери «яблоко».", options: ["apple", "orange", "banana", "lemon"], answer: 0 },
      { q: "«Дом» по-английски?", options: ["house", "mouse", "horse", "rose"], answer: 0 },
      { q: "Как сказать «Привет!»?", options: ["Bye", "Hello", "Please", "Sorry"], answer: 1 },
      { q: "«Пять» — это…", options: ["four", "five", "nine", "one"], answer: 1 },
      { q: "Какого цвета трава? Как «зелёный»?", options: ["green", "brown", "blue", "white"], answer: 0 },
    ],
  },
  {
    id: "5-6",
    title: "Средний",
    grades: "5–6 класс",
    questions: [
      { q: "She ___ to school every day.", options: ["go", "goes", "going", "went"], answer: 1 },
      { q: "Множественное число «child»?", options: ["childs", "children", "childes", "child"], answer: 1 },
      { q: "«Вчера» по-английски?", options: ["tomorrow", "yesterday", "today", "now"], answer: 1 },
      { q: "I ___ from Russia.", options: ["am", "is", "are", "be"], answer: 0 },
      { q: "The book is ___ the table.", options: ["in", "on", "at", "of"], answer: 1 },
      { q: "Где вопросительное слово?", options: ["blue", "what", "table", "run"], answer: 1 },
      { q: "He ___ like fish. (не любит)", options: ["doesn't", "don't", "isn't", "aren't"], answer: 0 },
      { q: "Противоположность «big»?", options: ["tall", "small", "long", "old"], answer: 1 },
      { q: "Множественное число «box»?", options: ["boxs", "boxes", "box", "boxen"], answer: 1 },
      { q: "How ___ are you? (сколько лет)", options: ["much", "old", "many", "long"], answer: 1 },
    ],
  },
  {
    id: "7-9",
    title: "Продвинутый",
    grades: "7–9 класс",
    questions: [
      { q: "Past Simple от «go»?", options: ["goed", "went", "gone", "going"], answer: 1 },
      { q: "Сравнительная степень «good»?", options: ["gooder", "better", "best", "more good"], answer: 1 },
      { q: "I have ___ finished my homework.", options: ["yet", "already", "since", "ago"], answer: 1 },
      { q: "Present Perfect: I ___ him before.", options: ["saw", "have seen", "seeing", "sees"], answer: 1 },
      { q: "If it ___, we'll stay home.", options: ["rains", "will rain", "rained", "rain"], answer: 0 },
      { q: "Пассив: English ___ all over the world.", options: ["speaks", "is spoken", "speak", "spoken"], answer: 1 },
      { q: "3-я форма глагола «write»?", options: ["writed", "wrote", "written", "writing"], answer: 2 },
      { q: "You ___ wear a uniform. (обязан)", options: ["must", "can", "may", "would"], answer: 0 },
      { q: "Синоним «happy»?", options: ["sad", "glad", "angry", "tired"], answer: 1 },
      { q: "She said she ___ tired.", options: ["is", "was", "be", "being"], answer: 1 },
    ],
  },
];
