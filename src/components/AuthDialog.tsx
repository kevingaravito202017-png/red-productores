import { useEffect, useState } from "react";
import { Mail, Phone, ShieldCheck, Lock, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase, type Perfil } from "@/lib/supabase-client";

// Tipo de usuario autenticado (combina auth + perfil)
export type AuthUser = {
  id: string; // UUID from auth.users
  email: string | null;
  phone: string | null;
  perfil: Perfil | null;
};

const towns = [
  "Apartadó",
  "Carepa",
  "Chigorodó",
  "Turbo",
  "Mutatá",
  "Necoclí",
  "San Juan de Urabá",
  "Arboletes",
  "San Pedro de Urabá",
];
const roles = [
  "Productor / campesino",
  "Restaurante",
  "Tienda",
  "Comedor comunitario",
  "Consumidor",
];

export function AuthDialog({
  open,
  onOpenChange,
  onSuccess,
  reason,
  initialTab = "login",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: AuthUser) => void;
  reason?: string | undefined;
  initialTab?: "login" | "register" | "reset";
}) {
  const [tab, setTab] = useState<"login" | "register" | "reset">(initialTab);
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [form, setForm] = useState({
    name: "",
    document: "",
    contact: "",
    town: "Apartadó",
    role: "Productor / campesino",
    password: "",
    confirm: "",
    terms: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError("");
    }
  }, [open, initialTab]);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function fetchPerfil(userId: string): Promise<Perfil | null> {
    const { data, error } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Error fetching perfil:", error.message);
      return null;
    }
    return data;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const contact = form.contact.trim();
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
      return setError("Escribe un correo válido. Ejemplo: nombre@correo.com");
    if (method === "phone" && contact.replace(/\D/g, "").length !== 10)
      return setError("El celular debe tener 10 números. Ejemplo: 300 123 4567");
    if (form.password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");
    if (form.name.trim().length < 3) return setError("Escribe tu nombre completo.");
    if (form.document.replace(/\D/g, "").length < 6)
      return setError("Escribe tu número de cédula.");
    if (form.password !== form.confirm) return setError("Las contraseñas no coinciden.");
    if (!form.terms) return setError("Debes aceptar el uso de tus datos para continuar.");

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: method === "email" ? contact : undefined,
        phone: method === "phone" ? contact : undefined,
        password: form.password,
        options: {
          data: {
            nombre: form.name.trim(),
            cedula: form.document.trim(),
            municipio: form.town,
            rol: form.role,
          },
        },
      });

      if (authError) throw authError;

      // Esperar un poco a que el trigger cree el perfil
      await new Promise((r) => setTimeout(r, 500));

      const perfil = data.user ? await fetchPerfil(data.user.id) : null;

      const authUser: AuthUser = {
        id: data.user?.id || "",
        email: data.user?.email || null,
        phone: data.user?.phone || null,
        perfil,
      };

      onSuccess(authUser);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      if (message.includes("already registered") || message.includes("already exists")) {
        setError("Este correo/celular ya está registrado. Intenta iniciar sesión.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const contact = form.contact.trim();
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
      return setError("Escribe un correo válido. Ejemplo: nombre@correo.com");
    if (method === "phone" && contact.replace(/\D/g, "").length !== 10)
      return setError("El celular debe tener 10 números. Ejemplo: 300 123 4567");
    if (form.password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres.");

    setLoading(true);

    try {
      // Para phone, Supabase Auth usa signInWithPassword con phone como "email" param
      // o signInWithOtp. Usamos signInWithPassword para simplicidad.
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: method === "email" ? contact : undefined,
        phone: method === "phone" ? contact : undefined,
        password: form.password,
      });

      if (authError) throw authError;

      const perfil = data.user ? await fetchPerfil(data.user.id) : null;

      const authUser: AuthUser = {
        id: data.user?.id || "",
        email: data.user?.email || null,
        phone: data.user?.phone || null,
        perfil,
      };

      onSuccess(authUser);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      if (message.includes("Invalid login credentials")) {
        setError("Credenciales incorrectas. Verifica tu contraseña.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const contact = form.contact.trim();
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
      return setError("Escribe un correo válido. Ejemplo: nombre@correo.com");
    if (method === "phone" && contact.replace(/\D/g, "").length !== 10)
      return setError("El celular debe tener 10 números. Ejemplo: 300 123 4567");

    setLoading(true);

    try {
      if (method === "email") {
        const { error } = await supabase.auth.resetPasswordForEmail(contact, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForPhone(contact);
        if (error) throw error;
      }

      setError("");
      alert(
        method === "email"
          ? "Se envió un enlace de recuperación a tu correo. Revisa tu bandeja de entrada (y spam)."
          : "Se envió un código de recuperación por SMS a tu celular.",
      );
      setTab("login");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const submitHandler =
    tab === "register" ? handleRegister : tab === "reset" ? handleResetPassword : handleLogin;

  const field = "mt-2 h-12 text-base";
  const isLoginOrRegister = tab !== "reset";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {tab === "register"
              ? "Crea tu cuenta"
              : tab === "reset"
                ? "Recuperar contraseña"
                : "Ingresa a tu cuenta"}
          </DialogTitle>
          <DialogDescription>
            {reason ??
              (tab === "reset"
                ? "Te enviaremos un enlace o código para restablecer tu contraseña."
                : "Necesitas una cuenta para continuar.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1 mb-4">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={cn(
                "h-11 rounded-md font-bold",
                tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
              )}
            >
              {t === "register" ? "Soy nuevo" : "Ya tengo cuenta"}
            </button>
          ))}
        </div>

        {tab !== "reset" && (
          <p
            className="text-xs text-center text-muted-foreground mb-4"
            onClick={() => {
              setTab("reset");
              setError("");
            }}
            style={{ cursor: "pointer" }}
          >
            <RotateCw className="inline h-3 w-3" /> ¿Olvidaste tu contraseña?
          </p>
        )}

        <form onSubmit={submitHandler} className="space-y-4">
          <div>
            <p className="text-base font-bold">¿Cómo quieres ingresar?</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={method === "phone" ? "default" : "outline"}
                className="h-14 text-base"
                onClick={() => {
                  setMethod("phone");
                  set("contact", "");
                }}
              >
                <Phone /> Celular
              </Button>
              <Button
                type="button"
                variant={method === "email" ? "default" : "outline"}
                className="h-14 text-base"
                onClick={() => {
                  setMethod("email");
                  set("contact", "");
                }}
              >
                <Mail /> Correo
              </Button>
            </div>
          </div>

          {isLoginOrRegister && tab === "register" && (
            <>
              <div>
                <Label htmlFor="a-name" className="text-base font-bold">
                  Nombre completo
                </Label>
                <Input
                  id="a-name"
                  className={field}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ejemplo: María Pérez Gómez"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="a-doc" className="text-base font-bold">
                  Número de cédula
                </Label>
                <Input
                  id="a-doc"
                  className={field}
                  inputMode="numeric"
                  value={form.document}
                  onChange={(e) => set("document", e.target.value)}
                  placeholder="Ejemplo: 1045123456"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="a-contact" className="text-base font-bold">
              {method === "phone" ? "Número de celular" : "Correo electrónico"}
            </Label>
            <Input
              id="a-contact"
              className={field}
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
              inputMode={method === "phone" ? "tel" : "email"}
              type={method === "phone" ? "tel" : "email"}
              placeholder={
                method === "phone" ? "Ejemplo: 300 123 4567" : "Ejemplo: maria@correo.com"
              }
              autoComplete={method === "email" ? "email" : "tel"}
            />
          </div>

          {isLoginOrRegister && tab === "register" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="a-town" className="text-base font-bold">
                  Municipio
                </Label>
                <select
                  id="a-town"
                  value={form.town}
                  onChange={(e) => set("town", e.target.value)}
                  className="mt-2 h-12 w-full rounded-md border border-input bg-card px-3 text-base"
                >
                  {towns.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="a-role" className="text-base font-bold">
                  Yo soy
                </Label>
                <select
                  id="a-role"
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  className="mt-2 h-12 w-full rounded-md border border-input bg-card px-3 text-base"
                >
                  {roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(isLoginOrRegister || tab === "register") && (
            <div>
              <Label htmlFor="a-pass" className="text-base font-bold">
                Contraseña
              </Label>
              <Input
                id="a-pass"
                type="password"
                className={field}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete={tab === "register" ? "new-password" : "current-password"}
              />
            </div>
          )}

          {tab === "register" && (
            <div>
              <Label htmlFor="a-pass2" className="text-base font-bold">
                Repite la contraseña
              </Label>
              <Input
                id="a-pass2"
                type="password"
                className={field}
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          {tab === "register" && (
            <label className="flex items-start gap-3 rounded-lg bg-muted p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
                checked={form.terms}
                onChange={(e) => set("terms", e.target.checked)}
              />
              <span>
                Acepto que mis datos se usen para conectarme con compradores y productores de Urabá.
              </span>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm font-bold text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="h-14 w-full text-lg font-black" disabled={loading}>
            {loading ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {tab === "register"
                  ? "Creando cuenta..."
                  : tab === "reset"
                    ? "Enviando..."
                    : "Ingresando..."}
              </>
            ) : tab === "register" ? (
              "Crear cuenta y continuar"
            ) : tab === "reset" ? (
              "Enviar instrucciones"
            ) : (
              "Ingresar"
            )}
          </Button>

          {tab !== "reset" && (
            <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Tu información está segura y solo se usa para la
              Red.
            </p>
          )}
        </form>

        {tab === "reset" && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              className="text-sm"
              onClick={() => {
                setTab("login");
                setError("");
              }}
            >
              <Lock className="mr-2 h-4 w-4" /> Volver a iniciar sesión
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
