import { useState } from "react";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DemoUser = {
  name: string;
  document: string;
  method: "email" | "phone";
  contact: string;
  town: string;
  role: string;
};

const towns = ["Apartadó", "Carepa", "Chigorodó", "Turbo", "Mutatá", "Necoclí", "San Juan de Urabá", "Arboletes", "San Pedro de Urabá"];
const roles = ["Productor / campesino", "Restaurante", "Tienda", "Comedor comunitario", "Consumidor"];

export function AuthDialog({ open, onOpenChange, onSuccess, reason }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: DemoUser) => void;
  reason?: string | undefined;
}) {
  const [tab, setTab] = useState<"login" | "register">("register");
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [form, setForm] = useState({ name: "", document: "", contact: "", town: towns[0], role: roles[0], password: "", confirm: "", terms: false });
  const [error, setError] = useState("");

  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const contact = form.contact.trim();
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return setError("Escribe un correo válido. Ejemplo: nombre@correo.com");
    if (method === "phone" && contact.replace(/\D/g, "").length !== 10) return setError("El celular debe tener 10 números. Ejemplo: 300 123 4567");
    if (form.password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (tab === "register") {
      if (form.name.trim().length < 3) return setError("Escribe tu nombre completo.");
      if (form.document.replace(/\D/g, "").length < 6) return setError("Escribe tu número de cédula.");
      if (form.password !== form.confirm) return setError("Las contraseñas no coinciden.");
      if (!form.terms) return setError("Debes aceptar el uso de tus datos para continuar.");
    }
    onSuccess({
      name: tab === "register" ? form.name.trim() : "Usuario de la Red",
      document: form.document,
      method,
      contact,
      town: form.town,
      role: form.role,
    });
  }

  const field = "mt-2 h-12 text-base";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{tab === "register" ? "Crea tu cuenta" : "Ingresa a tu cuenta"}</DialogTitle>
          <DialogDescription>{reason ?? "Necesitas una cuenta para continuar."}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          {(["register", "login"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(""); }} className={cn("h-11 rounded-md font-bold", tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
              {t === "register" ? "Soy nuevo" : "Ya tengo cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="text-base font-bold">¿Cómo quieres ingresar?</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button type="button" variant={method === "phone" ? "default" : "outline"} className="h-14 text-base" onClick={() => { setMethod("phone"); set("contact", ""); }}><Phone /> Celular</Button>
              <Button type="button" variant={method === "email" ? "default" : "outline"} className="h-14 text-base" onClick={() => { setMethod("email"); set("contact", ""); }}><Mail /> Correo</Button>
            </div>
          </div>

          {tab === "register" && <>
            <div><Label htmlFor="a-name" className="text-base font-bold">Nombre completo</Label><Input id="a-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ejemplo: María Pérez Gómez" autoComplete="name" /></div>
            <div><Label htmlFor="a-doc" className="text-base font-bold">Número de cédula</Label><Input id="a-doc" className={field} inputMode="numeric" value={form.document} onChange={(e) => set("document", e.target.value)} placeholder="Ejemplo: 1045123456" /></div>
          </>}

          <div>
            <Label htmlFor="a-contact" className="text-base font-bold">{method === "phone" ? "Número de celular" : "Correo electrónico"}</Label>
            <Input id="a-contact" className={field} value={form.contact} onChange={(e) => set("contact", e.target.value)} inputMode={method === "phone" ? "tel" : "email"} type={method === "phone" ? "tel" : "email"} placeholder={method === "phone" ? "Ejemplo: 300 123 4567" : "Ejemplo: maria@correo.com"} />
          </div>

          {tab === "register" && <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="a-town" className="text-base font-bold">Municipio</Label><select id="a-town" value={form.town} onChange={(e) => set("town", e.target.value)} className="mt-2 h-12 w-full rounded-md border border-input bg-card px-3 text-base">{towns.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><Label htmlFor="a-role" className="text-base font-bold">Yo soy</Label><select id="a-role" value={form.role} onChange={(e) => set("role", e.target.value)} className="mt-2 h-12 w-full rounded-md border border-input bg-card px-3 text-base">{roles.map((r) => <option key={r}>{r}</option>)}</select></div>
          </div>}

          <div><Label htmlFor="a-pass" className="text-base font-bold">Contraseña</Label><Input id="a-pass" type="password" className={field} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
          {tab === "register" && <div><Label htmlFor="a-pass2" className="text-base font-bold">Repite la contraseña</Label><Input id="a-pass2" type="password" className={field} value={form.confirm} onChange={(e) => set("confirm", e.target.value)} /></div>}

          {tab === "register" && <label className="flex items-start gap-3 rounded-lg bg-muted p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--primary)]" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} /><span>Acepto que mis datos se usen para conectarme con compradores y productores de Urabá.</span></label>}

          {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}

          <Button type="submit" className="h-14 w-full text-lg font-black">{tab === "register" ? "Crear cuenta y continuar" : "Ingresar"}</Button>
          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Demostración: tus datos no se guardan.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
