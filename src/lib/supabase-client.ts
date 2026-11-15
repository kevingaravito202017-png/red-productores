// Cliente Supabase unificado (Browser + SSR compatible)
// Funciona en TanStack Start (Vinxi/h3) usando cookies estándar

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kbkvmywpeqodndyzegwu.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3ZteXdwZXFvZG5keXplZ3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MzcwMDksImV4cCI6MjEwODIxMzAwOX0.Odr7Gnt59DMYlY4nEx_cU8-VgazwoSmR4sxF_7gfgcY";

// Cliente para el navegador (client-side)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(key);
      },
      setItem: (key, value) => {
        if (typeof window === "undefined") return;
        localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        if (typeof window === "undefined") return;
        localStorage.removeItem(key);
      },
    },
  },
});

// Cliente para Server-Side Rendering (SSR) en TanStack Start
// Se usa en loaders/actions del router
export function createSupabaseServerClient(
  getCookie: (name: string) => string | undefined,
  setCookie: (name: string, value: string, options: CookieOptions) => void,
  removeCookie: (name: string, options: CookieOptions) => void,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, options);
      },
    },
    cookies: {
      get(name: string) {
        return getCookie(name);
      },
      set(name: string, value: string, options: CookieOptions) {
        setCookie(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        removeCookie(name, options);
      },
    },
  });
}

// Helper para obtener cookies en loaders de TanStack Start
export function getRequestCookies(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = new Map<string, string>();

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length) {
      cookies.set(name, rest.join("="));
    }
  });

  return {
    get: (name: string) => cookies.get(name),
    set: (name: string, value: string, options: CookieOptions) => {
      // En loaders no podemos setear cookies directamente
      // Se hace via response headers
    },
    remove: (name: string, options: CookieOptions) => {
      // En loaders no podemos setear cookies directamente
    },
  };
}

// Tipos
export type Perfil = {
  id: string;
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
  vendedor: string;
  vendedor_id: string | null;
  precio_unitario: number;
  unidad_medida: string;
  cantidad_disponible: string;
  frescura?: string;
  imagen_url?: string | null;
  fecha_publicacion?: string;
  pausado?: boolean;
  updated_at?: string;
};

export type DbSolicitud = {
  id?: number;
  producto_id?: number | null;
  comprador_nombre: string;
  comprador_contacto: string;
  comprador_id: string | null;
  vendedor_nombre: string;
  estado?: string;
  fecha_solicitud?: string;
  updated_at?: string;
};
