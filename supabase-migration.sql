-- ============================================================
-- MIGRACIÓN A SUPABASE AUTH - Red de Productores de Urabá
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabla perfiles (extiende auth.users)
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  cedula text unique,
  municipio text,
  rol text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. RLS en perfiles
alter table public.perfiles enable row level security;

-- Política: usuario ve/edita solo su perfil (idempotente)
do $$
begin
  create policy "perfiles_own" on public.perfiles
    for all using (auth.uid() = id);
exception when duplicate_object then
  null;
end $$;

-- 3. Función helper: actualizar updated_at automáticamente
create or replace function public.handle_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger para actualizar updated_at en perfiles
drop trigger if exists perfiles_updated_at on public.perfiles;
create trigger perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.handle_updated_at();

-- 4. Trigger mejorado: crear perfil automático al registrarse (maneja nulos y defaults)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text;
  v_cedula text;
  v_municipio text;
  v_rol text;
begin
  -- Extraer metadata con valores por defecto si son nulos
  v_nombre := coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), 'Usuario sin nombre');
  v_cedula := nullif(new.raw_user_meta_data->>'cedula', '');
  v_municipio := nullif(new.raw_user_meta_data->>'municipio', '');
  v_rol := nullif(new.raw_user_meta_data->>'rol', '');

  insert into public.perfiles (id, nombre, cedula, municipio, rol)
  values (new.id, v_nombre, v_cedula, v_municipio, v_rol)
  on conflict (id) do update set
    nombre = excluded.nombre,
    cedula = excluded.cedula,
    municipio = excluded.municipio,
    rol = excluded.rol,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Actualizar tabla productos: agregar vendedor_id (FK a auth.users), pausado y updated_at
alter table public.productos
  add column if not exists vendedor_id uuid references auth.users on delete set null,
  add column if not exists pausado boolean default false,
  add column if not exists updated_at timestamp with time zone default now();

-- Índice para consultas rápidas por vendedor
create index if not exists idx_productos_vendedor_id on public.productos(vendedor_id);

-- Trigger updated_at para productos
drop trigger if exists productos_updated_at on public.productos;
create trigger productos_updated_at
  before update on public.productos
  for each row execute function public.handle_updated_at();

-- 6. RLS en productos
alter table public.productos enable row level security;

-- Todos pueden ver productos publicados (no pausados)
do $$
begin
  create policy "productos_public_read" on public.productos
    for select using (pausado = false or auth.uid() = vendedor_id);
exception when duplicate_object then
  null;
end $$;

-- Solo vendedor autenticado puede insertar sus productos
do $$
begin
  create policy "productos_vendedor_insert" on public.productos
    for insert with check (auth.uid() = vendedor_id);
exception when duplicate_object then
  null;
end $$;

-- Solo vendedor puede actualizar/borrar sus productos
do $$
begin
  create policy "productos_vendedor_update" on public.productos
    for update using (auth.uid() = vendedor_id);
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "productos_vendedor_delete" on public.productos
    for delete using (auth.uid() = vendedor_id);
exception when duplicate_object then
  null;
end $$;

-- 7. Actualizar tabla solicitudes_contacto: agregar comprador_id y updated_at
alter table public.solicitudes_contacto
  add column if not exists comprador_id uuid references auth.users on delete set null,
  add column if not exists updated_at timestamp with time zone default now();

-- Trigger updated_at para solicitudes_contacto
drop trigger if exists solicitudes_contacto_updated_at on public.solicitudes_contacto;
create trigger solicitudes_contacto_updated_at
  before update on public.solicitudes_contacto
  for each row execute function public.handle_updated_at();

-- 8. RLS en solicitudes_contacto
alter table public.solicitudes_contacto enable row level security;

-- Comprador ve sus solicitudes, vendedor ve las de sus productos
do $$
begin
  create policy "solicitudes_participantes" on public.solicitudes_contacto
    for select using (
      auth.uid() = comprador_id
      or auth.uid() in (select vendedor_id from productos where id = producto_id)
    );
exception when duplicate_object then
  null;
end $$;

-- Comprador autenticado puede crear solicitudes
do $$
begin
  create policy "solicitudes_comprador_insert" on public.solicitudes_contacto
    for insert with check (auth.uid() = comprador_id);
exception when duplicate_object then
  null;
end $$;

-- Vendedor puede actualizar estado de solicitudes de sus productos
do $$
begin
  create policy "solicitudes_vendedor_update" on public.solicitudes_contacto
    for update using (
      auth.uid() in (select vendedor_id from productos where id = producto_id)
    );
exception when duplicate_object then
  null;
end $$;

-- 9. Tabla mensajes para chat en tiempo real
create table if not exists public.mensajes (
  id bigserial primary key,
  producto_id integer not null references public.productos(id) on delete cascade,
  remitente_id uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null,
  leido boolean default false,
  creado_en timestamp with time zone default now()
);

-- Índices para consultas rápidas
create index if not exists idx_mensajes_producto on public.mensajes(producto_id, creado_en desc);
create index if not exists idx_mensajes_conversacion on public.mensajes(remitente_id, destinatario_id, producto_id);

-- RLS en mensajes
alter table public.mensajes enable row level security;

-- Los participantes de la conversación pueden ver los mensajes
do $$
begin
  create policy "mensajes_participantes" on public.mensajes
    for select using (
      auth.uid() = remitente_id or auth.uid() = destinatario_id
    );
exception when duplicate_object then
  null;
end $$;

-- Los participantes pueden insertar mensajes (solo como remitente)
do $$
begin
  create policy "mensajes_insert" on public.mensajes
    for insert with check (
      auth.uid() = remitente_id
    );
exception when duplicate_object then
  null;
end $$;

-- Los participantes pueden marcar como leído (solo destinatario puede poner leido=true)
do $$
begin
  create policy "mensajes_update_leido" on public.mensajes
    for update using (
      auth.uid() = destinatario_id
    ) with check (
      auth.uid() = destinatario_id and leido = true
    );
exception when duplicate_object then
  null;
end $$;

-- Realtime: habilitar publicación de cambios (idempotente)
do $$
begin
  alter publication supabase_realtime add table public.mensajes;
exception when duplicate_object then
  -- La tabla ya está en la publicación, ignorar
  null;
end $$;

-- 9. Storage bucket para imágenes de productos
insert into storage.buckets (id, name, public) values ('productos', 'productos', true)
on conflict (id) do nothing;

-- RLS en storage.objects para bucket productos
do $$
begin
  create policy "productos_images_public" on storage.objects
    for select using (bucket_id = 'productos');
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "productos_images_vendedor" on storage.objects
    for insert with check (
      bucket_id = 'productos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "productos_images_vendedor_update" on storage.objects
    for update using (
      bucket_id = 'productos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy "productos_images_vendedor_delete" on storage.objects
    for delete using (
      bucket_id = 'productos'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then
  null;
end $$;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- Ejecutar para confirmar:
-- select * from public.perfiles limit 5;
-- select * from public.productos limit 5;
-- select * from pg_policies where tablename in ('perfiles', 'productos', 'solicitudes_contacto', 'mensajes');
-- select * from information_schema.triggers where event_object_schema = 'public';

-- Verificar triggers de updated_at:
-- select * from information_schema.triggers
-- where event_object_table in ('perfiles', 'productos', 'solicitudes_contacto')
-- and trigger_name like '%updated_at%';

-- Verificar trigger de nuevo usuario:
-- select * from information_schema.triggers
-- where event_object_table = 'users' and trigger_name = 'on_auth_user_created';