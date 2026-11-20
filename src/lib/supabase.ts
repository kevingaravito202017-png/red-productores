import { createClient } from "@supabase/supabase-js";

// Cliente para el navegador (client-side)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kbkvmywpeqodndyzegwu.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3ZteXdwZXFvZG5keXplZ3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MzcwMDksImV4cCI6MjEwODIxMzAwOX0.Odr7Gnt59DMYlY4nEx_cU8-VgazwoSmR4sxF_7gfgcY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Tipos actualizados para Supabase Auth
export type Perfil = {
  id: string; // UUID = auth.users.id
  nombre: string;
  cedula: string | null;
  municipio: string | null;
  rol: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DbProduct = {
  id: number;
  nombre: string;
  categoria: string;
  municipio: string;
  vendedor: string; // nombre legible (denormalizado)
  vendedor_id: string | null; // FK → auth.users.id
  precio_unitario: number;
  unidad_medida: string;
  cantidad_disponible: string;
  frescura?: string;
  imagen_url?: string | null;
  fecha_publicacion?: string;
};

export type DbSolicitud = {
  id?: number;
  producto_id?: number | null;
  comprador_nombre: string;
  comprador_contacto: string;
  comprador_id: string | null; // FK → auth.users.id
  vendedor_nombre: string;
  estado?: string;
  fecha_solicitud?: string;
};
