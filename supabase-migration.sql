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

-- Política: usuario ve/edita solo su perfil
create policy "perfiles_own" on public.perfiles
  for all using (auth.uid() = id);

-- 3. Trigger: crear perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, cedula, municipio, rol)
  values (
    new.id,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'cedula',
    new.raw_user_meta_data->>'municipio',
    new.raw_user_meta_data->>'rol'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Actualizar tabla productos: agregar vendedor_id (FK a auth.users) y pausado
alter table public.productos
  add column if not exists vendedor_id uuid references auth.users on delete set null,
  add column if not exists pausado boolean default false;

-- Índice para consultas rápidas por vendedor
create index if not exists idx_productos_vendedor_id on public.productos(vendedor_id);

-- 5. RLS en productos
alter table public.productos enable row level security;

-- Todos pueden ver productos publicados
create policy "productos_public_read" on public.productos
  for select using (true);

-- Solo vendedor autenticado puede insertar sus productos
create policy "productos_vendedor_insert" on public.productos
  for insert with check (auth.uid() = vendedor_id);

-- Solo vendedor puede actualizar/borrar sus productos
create policy "productos_vendedor_update" on public.productos
  for update using (auth.uid() = vendedor_id);

create policy "productos_vendedor_delete" on public.productos
  for delete using (auth.uid() = vendedor_id);

-- 6. Actualizar tabla solicitudes_contacto: agregar comprador_id
alter table public.solicitudes_contacto
  add column if not exists comprador_id uuid references auth.users on delete set null;

-- 7. RLS en solicitudes_contacto
alter table public.solicitudes_contacto enable row level security;

-- Comprador ve sus solicitudes, vendedor ve las de sus productos
create policy "solicitudes_participantes" on public.solicitudes_contacto
  for select using (
    auth.uid() = comprador_id
    or auth.uid() in (select vendedor_id from productos where id = producto_id)
  );

-- Comprador autenticado puede crear solicitudes
create policy "solicitudes_comprador_insert" on public.solicitudes_contacto
  for insert with check (auth.uid() = comprador_id);

-- 8. Tabla mensajes para chat en tiempo real
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
create policy "mensajes_participantes" on public.mensajes
  for select using (
    auth.uid() = remitente_id or auth.uid() = destinatario_id
  );

-- Los participantes pueden insertar mensajes
create policy "mensajes_insert" on public.mensajes
  for insert with check (
    auth.uid() = remitente_id
  );

-- Los participantes pueden marcar como leído
create policy "mensajes_update_leido" on public.mensajes
  for update using (
    auth.uid() = destinatario_id
  ) with check (
    auth.uid() = destinatario_id and leido = true
  );

-- Realtime: habilitar publicación de cambios
alter publication supabase_realtime add table public.mensajes;

-- 9. Storage bucket para imágenes de productos (opcional)
-- insert into storage.buckets (id, name, public) values ('productos', 'productos', true);
-- create policy "productos_images_public" on storage.objects for select using (bucket_id = 'productos');
-- create policy "productos_images_vendedor" on storage.objects for insert with check (bucket_id = 'productos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- Ejecutar para confirmar:
-- select * from public.perfiles limit 5;
-- select * from public.productos limit 5;
-- select * from pg_policies where tablename in ('perfiles', 'productos', 'solicitudes_contacto');