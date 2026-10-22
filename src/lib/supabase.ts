import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kbkvmywpeqodndyzegwu.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3ZteXdwZXFvZG5keXplZ3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MzcwMDksImV4cCI6MjEwODIxMzAwOX0.Odr7Gnt59DMYlY4nEx_cU8-VgazwoSmR4sxF_7gfgcY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DbUser = {
  id?: string;
  nombre: string;
  cedula: string;
  metodo_contacto: "email" | "phone";
  contacto: string;
  municipio: string;
  rol: string;
  fecha_registro?: string;
};

export type DbProduct = {
  id: number;
  nombre: string;
  categoria: string;
  municipio: string;
  vendedor: string;
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
  vendedor_nombre: string;
  estado?: string;
  fecha_solicitud?: string;
};

