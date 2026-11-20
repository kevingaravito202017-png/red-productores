import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Check, AlertCircle, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Verificar si hay una sesión de recovery activa
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("No hay sesión de recuperación activa. Solicita un nuevo enlace.");
      }
      setSessionChecked(true);
    };
    checkSession();

    // Escuchar cambios de auth (cuando el usuario hace click en el email)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setError("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres.");
    }
    if (password !== confirm) {
      return setError("Las contraseñas no coinciden.");
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setLoading(false);
    }
  }

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-3 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {success ? (
              <Check className="h-8 w-8 text-primary" />
            ) : (
              <Lock className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-primary">
            {success ? "¡Contraseña actualizada!" : "Nueva contraseña"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {success
              ? "Tu contraseña ha sido cambiada correctamente. Ya puedes iniciar sesión."
              : "Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres."}
          </p>
        </div>

        {error && (
          <div
            className={cn(
              "mb-6 p-4 rounded-lg text-sm font-medium",
              "bg-destructive/10 text-destructive border border-destructive/20",
            )}
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="new-password" className="text-base font-bold">
                Nueva contraseña
              </Label>
              <Input
                id="new-password"
                type="password"
                className="mt-2 h-12 text-base"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-base font-bold">
                Confirmar contraseña
              </Label>
              <Input
                id="confirm-password"
                type="password"
                className="mt-2 h-12 text-base"
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="h-14 w-full text-lg font-black" disabled={loading}>
              {loading ? (
                <>
                  <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Actualizando...
                </>
              ) : (
                "Guardar nueva contraseña"
              )}
            </Button>
          </form>
        )}

        {success && (
          <div className="space-y-3">
            <Button
              className="h-14 w-full text-lg font-black"
              onClick={() => (window.location.href = "/")}
            >
              <Mail className="mr-2 h-5 w-5" /> Ir a iniciar sesión
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Serás redirigido automáticamente en unos segundos...
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <ShieldCheck className="inline h-3 w-3" /> Tu información está segura.
        </p>
      </div>
    </div>
  );
}
