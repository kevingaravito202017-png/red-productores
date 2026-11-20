"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2, Check, CheckCheck, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";

interface ChatProps {
  productoId: number;
  miUserId: string;
  otroUserId: string;
  otroNombre: string;
  onClose?: () => void;
  className?: string;
}

export function Chat({
  productoId,
  miUserId,
  otroUserId,
  otroNombre,
  onClose,
  className,
}: ChatProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Tipos locales
  interface Mensaje {
    id: number;
    producto_id: number;
    remitente_id: string;
    destinatario_id: string;
    contenido: string;
    leido: boolean;
    creado_en: string;
  }

  // Cargar mensajes iniciales
  useEffect(() => {
    cargarMensajes();

    // Suscribirse a cambios en tiempo real
    channelRef.current = supabase
      .channel(`chat_${productoId}_${miUserId}_${otroUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes",
          filter: `producto_id=eq.${productoId}`,
        },
        (payload) => {
          const nuevo = payload.new as Mensaje;
          // Solo agregar si es de esta conversación (entre miUserId y otroUserId)
          if (
            (nuevo.remitente_id === miUserId && nuevo.destinatario_id === otroUserId) ||
            (nuevo.remitente_id === otroUserId && nuevo.destinatario_id === miUserId)
          ) {
            setMensajes((prev) => {
              // Evitar duplicados
              if (prev.some((m) => m.id === nuevo.id)) return prev;
              return [...prev, nuevo].sort(
                (a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime(),
              );
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensajes",
          filter: `producto_id=eq.${productoId}`,
        },
        (payload) => {
          const actualizado = payload.new as Mensaje;
          setMensajes((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [productoId, miUserId, otroUserId]);

  async function cargarMensajes() {
    setCargando(true);
    try {
      const { data, error: err } = await supabase
        .from("mensajes")
        .select("*")
        .eq("producto_id", productoId)
        .or(
          `and(remitente_id.eq.${miUserId},destinatario_id.eq.${otroUserId}),and(remitente_id.eq.${otroUserId},destinatario_id.eq.${miUserId})`,
        )
        .order("creado_en", { ascending: true });

      if (err) throw err;
      setMensajes(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando mensajes";
      setError(message);
      console.error("Chat error:", err);
    } finally {
      setCargando(false);
    }
  }

  // Marcar mensajes como leídos cuando los recibimos
  useEffect(() => {
    const noLeidos = mensajes.filter(
      (m) => m.destinatario_id === miUserId && m.remitente_id === otroUserId && !m.leido,
    );
    if (noLeidos.length > 0) {
      marcarComoLeidos(noLeidos.map((m) => m.id));
    }
  }, [mensajes, miUserId, otroUserId]);

  async function marcarComoLeidos(ids: number[]) {
    if (ids.length === 0) return;
    try {
      await supabase.from("mensajes").update({ leido: true }).in("id", ids);
    } catch (err) {
      console.warn("Error marcando leídos:", err);
    }
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoMensaje.trim() || enviando) return;

    const contenido = nuevoMensaje.trim();
    setNuevoMensaje("");
    setEnviando(true);

    try {
      const { error } = await supabase.from("mensajes").insert({
        producto_id: productoId,
        remitente_id: miUserId,
        destinatario_id: otroUserId,
        contenido,
      });
      if (error) throw error;
      // El mensaje aparecerá via realtime
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error enviando mensaje";
      setError(message);
      setNuevoMensaje(contenido); // Restaurar para reintentar
    } finally {
      setEnviando(false);
    }
  }

  // Auto-scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [mensajes]);

  function formatHora(fechaStr: string) {
    return new Date(fechaStr).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const esMio = (msg: Mensaje) => msg.remitente_id === miUserId;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header del chat */}
      <div className="flex items-center justify-between border-b border-border bg-background p-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
          <MessageCircle className="h-6 w-6 text-primary" />
          <div>
            <p className="font-bold">{otroNombre}</p>
            <p className="text-xs text-muted-foreground">Chat del producto</p>
          </div>
        </div>
      </div>

      {/* Área de mensajes */}
      <ScrollArea className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollAreaRef}>
        {cargando ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-sm text-destructive p-4">
            {error}
            <Button variant="ghost" size="sm" className="mt-2" onClick={cargarMensajes}>
              Reintentar
            </Button>
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No hay mensajes aún</p>
            <p className="text-xs">Escribe el primer mensaje abajo</p>
          </div>
        ) : (
          mensajes.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2 animate-fade-in",
                esMio(msg) ? "justify-end" : "justify-start",
              )}
            >
              {!esMio(msg) && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 self-end">
                  {otroNombre.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={cn("flex flex-col gap-1 max-w-[75%]", esMio(msg) ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2 text-sm",
                    esMio(msg)
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.contenido}</p>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-[10px] px-1",
                    esMio(msg) ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  <span>{formatHora(msg.creado_en)}</span>
                  {esMio(msg) &&
                    (msg.leido ? (
                      <CheckCheck className="h-3 w-3 text-green-400" />
                    ) : (
                      <Check className="h-3 w-3 text-primary-foreground/50" />
                    ))}
                </div>
              </div>
              {esMio(msg) && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 self-end">
                  {miUserId ? "Yo" : "?"}
                </div>
              )}
            </div>
          ))
        )}
      </ScrollArea>

      {/* Input de mensaje */}
      <form onSubmit={enviarMensaje} className="border-t border-border p-3 bg-background">
        <div className="flex gap-2">
          <Input
            type="text"
            value={nuevoMensaje}
            onChange={(e) => setNuevoMensaje(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 h-11"
            disabled={enviando}
            maxLength={1000}
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11"
            disabled={!nuevoMensaje.trim() || enviando}
          >
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Estilos de animación (inyectados globalmente o en CSS)
// @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
// .animate-fade-in { animation: fade-in 0.3s ease-out; }
