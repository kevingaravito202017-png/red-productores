// Cliente Supabase para Server-Side Rendering (SSR)
// Usa cookies httpOnly para manejar la sesión de forma segura

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers"; // TanStack Start usa API similar a Next.js

// NOTA: En TanStack Start, el servidor se maneja diferente.
// Este archivo es para referencia. La implementación real está en server.ts

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (e) {
          // En Server Components no se pueden setear cookies
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch (e) {
          // En Server Components no se pueden setear cookies
        }
      },
    },
  });
}
