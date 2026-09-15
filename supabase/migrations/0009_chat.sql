-- 0009_chat.sql — История чатов с ассистентом Люси: диалоги и сообщения.

create table if not exists chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Новый чат',
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'model')),
  text            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists chat_messages_conv_idx on chat_messages(conversation_id, created_at);
