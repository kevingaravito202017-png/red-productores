import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  PackagePlus,
  Trash2,
  Eye,
  EyeOff,
  MessageCircle,
  BarChart2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Users,
  ShoppingBasket,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
  Receipt,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";
import { Chat } from "@/components/Chat";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ventas" | "compras">("ventas");

  // Verificar autenticación al montar
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.navigate("/");
      }
    };
    checkAuth();
  }, [router]);
  const [myProducts, setMyProducts] = useState<ProductWithStats[]>([]);
  const [myRequests, setMyRequests] = useState<ContactRequest[]>([]);
  const [myPurchases, setMyPurchases] = useState<PurchaseRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    pausedProducts: 0,
    totalUnits: 0,
    totalRequests: 0,
    pendingRequests: 0,
    uniqueBuyers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pausingId, setPausingId] = useState<number | null>(null);
  const [viewRequest, setViewRequest] = useState<ContactRequest | null>(null);
  const [chatRequest, setChatRequest] = useState<ContactRequest | null>(null);
  const [chatPurchase, setChatPurchase] = useState<PurchaseRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    loadDashboardData();

    let userId: string | null = null;

    // Obtener user ID inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      userId = user?.id || null;
      if (user) setCurrentUser({ id: user.id });
      if (userId) setupRealtime(userId);
    });

    // Escuchar cambios de auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      userId = session?.user?.id || null;
      if (session?.user) setCurrentUser({ id: session.user.id });
      if (userId) setupRealtime(userId);
    });

    function setupRealtime(uid: string) {
      const productsChannel = supabase
        .channel("my_products_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "productos",
            filter: `vendedor_id=eq.${uid}`,
          },
          () => loadDashboardData(),
        )
        .subscribe();

      const requestsChannel = supabase
        .channel("my_requests_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "solicitudes_contacto",
            filter: `comprador_id=eq.${uid}`,
          },
          () => loadDashboardData(),
        )
        .subscribe();

      const sellerRequestsChannel = supabase
        .channel("seller_requests_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "solicitudes_contacto",
          },
          () => loadDashboardData(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(productsChannel);
        supabase.removeChannel(requestsChannel);
        supabase.removeChannel(sellerRequestsChannel);
      };
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      // 1. Obtener mis productos con stats
      const { data: products, error: productsError } = await supabase
        .from("productos")
        .select("*")
        .eq("vendedor_id", userId)
        .order("fecha_publicacion", { ascending: false });

      if (productsError) throw productsError;

      // 2. Obtener solicitudes de mis productos (como vendedor)
      const productIds = products?.map((p) => p.id) || [];
      let requests: ContactRequest[] = [];

      if (productIds.length > 0) {
        const { data: reqs, error: reqError } = await supabase
          .from("solicitudes_contacto")
          .select("*")
          .in("producto_id", productIds)
          .order("fecha_solicitud", { ascending: false });

        if (reqError) throw reqError;
        requests = reqs || [];
      }

      // 3. Obtener mis compras (solicitudes donde soy comprador)
      const { data: purchases, error: purchasesError } = await supabase
        .from("solicitudes_contacto")
        .select(
          `
          *,
          productos:producto_id (
            id,
            nombre,
            categoria,
            municipio,
            vendedor,
            vendedor_id,
            precio_unitario,
            unidad_medida,
            cantidad_disponible,
            imagen_url,
            frescura
          )
        `,
        )
        .eq("comprador_id", userId)
        .order("fecha_solicitud", { ascending: false });

      if (purchasesError) throw purchasesError;

      // 4. Calcular estadísticas
      const activeProducts = products?.filter((p) => !p.pausado).length || 0;
      const pausedProducts = products?.filter((p) => p.pausado).length || 0;
      const totalUnits =
        products?.reduce((sum, p) => {
          const num = parseInt(p.cantidad_disponible?.replace(/\D/g, "") || "0");
          return sum + (isNaN(num) ? 0 : num);
        }, 0) || 0;
      const pendingRequests = requests.filter((r) => r.estado === "pendiente").length;
      const uniqueBuyers = new Set(requests.map((r) => r.comprador_id || r.comprador_contacto))
        .size;

      setMyProducts(products || []);
      setMyRequests(requests);
      setMyPurchases(purchases || []);
      setStats({
        totalProducts: products?.length || 0,
        activeProducts,
        pausedProducts,
        totalUnits,
        totalRequests: requests.length,
        pendingRequests,
        uniqueBuyers,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error cargando dashboard";
      setError(message);
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function togglePause(productId: number, currentlyPaused: boolean) {
    setPausingId(productId);
    try {
      const { error } = await supabase
        .from("productos")
        .update({ pausado: !currentlyPaused })
        .eq("id", productId);
      if (error) throw error;
      await loadDashboardData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error actualizando producto";
      alert(message);
    } finally {
      setPausingId(null);
    }
  }

  async function deleteProduct(productId: number) {
    if (!confirm("¿Eliminar esta cosecha permanentemente?")) return;
    setDeletingId(productId);
    try {
      const { error } = await supabase.from("productos").delete().eq("id", productId);
      if (error) throw error;
      await loadDashboardData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error eliminando producto";
      alert(message);
    } finally {
      setDeletingId(null);
    }
  }

  function getStatusBadge(estado: string) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pendiente: "default",
      contactado: "secondary",
      cerrado: "outline",
      cancelado: "destructive",
    };
    const labels: Record<string, string> = {
      pendiente: "Pendiente",
      contactado: "Contactado",
      cerrado: "Cerrado",
      cancelado: "Cancelado",
    };
    return <Badge variant={variants[estado] || "outline"}>{labels[estado] || estado}</Badge>;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function parseAmount(amountStr: string): number {
    const num = parseInt(amountStr?.replace(/\D/g, "") || "0");
    return isNaN(num) ? 0 : num;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold">Error cargando dashboard</h2>
              <p className="mt-2 text-muted-foreground">{error}</p>
              <Button className="mt-6" onClick={loadDashboardData}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-bold text-primary">Mi Panel</h1>
              <p className="text-xs text-muted-foreground">Gestiona tus cosechas y contactos</p>
            </div>
          </div>
          <Button className="h-11 gap-2" onClick={() => (window.location.href = "/#productos")}>
            <PackagePlus className="h-5 w-5" /> Publicar nueva
          </Button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="mx-auto max-w-7xl px-4 pb-4">
        <div className="flex justify-center">
          <div className="flex gap-1 bg-muted p-1 rounded-lg" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "ventas"}
              onClick={() => setActiveTab("ventas")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                activeTab === "ventas"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingBasket className="mr-2 h-4 w-4 inline" /> Mis Ventas
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "compras"}
              onClick={() => setActiveTab("compras")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                activeTab === "compras"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingBag className="mr-2 h-4 w-4 inline" /> Mis Compras
            </button>
          </div>
        </div>
      </div>

      {activeTab === "ventas" && (
        <main className="mx-auto max-w-7xl px-4 py-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Cosechas activas"
              value={stats.activeProducts}
              icon={<ShoppingBasket className="h-6 w-6 text-green-600" />}
              subtitle={`${stats.pausedProducts} pausadas`}
            />
            <StatCard
              title="Total ofrecido"
              value={`${stats.totalUnits.toLocaleString("es-CO")} unidades`}
              icon={<PackagePlus className="h-6 w-6 text-blue-600" />}
              subtitle={`${stats.totalProducts} productos publicados`}
            />
            <StatCard
              title="Solicitudes"
              value={stats.totalRequests}
              icon={<MessageCircle className="h-6 w-6 text-orange-600" />}
              subtitle={`${stats.pendingRequests} pendientes`}
            />
            <StatCard
              title="Clientes únicos"
              value={stats.uniqueBuyers}
              icon={<Users className="h-6 w-6 text-purple-600" />}
              subtitle="Han contactado"
            />
          </div>

          {/* Mis Cosechas */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Mis Cosechas</h2>
              <Button className="h-11 gap-2" onClick={() => (window.location.href = "/#productos")}>
                <PackagePlus className="h-5 w-5" /> Nueva cosecha
              </Button>
            </div>

            {myProducts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <PackagePlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No tienes cosechas publicadas</h3>
                  <p className="mt-1 text-muted-foreground">
                    Publica tu primera cosecha para empezar a vender
                  </p>
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => (window.location.href = "/#productos")}
                  >
                    <PackagePlus className="h-5 w-5" /> Publicar ahora
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onTogglePause={() => togglePause(product.id, product.pausado || false)}
                    onDelete={() => deleteProduct(product.id)}
                    isPausing={pausingId === product.id}
                    isDeleting={deletingId === product.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Solicitudes recibidas */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Solicitudes de compradores</h2>

            {myRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No hay solicitudes aún</h3>
                  <p className="text-muted-foreground">
                    Cuando alguien quiera comprar, aparecerá aquí
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onView={() => setViewRequest(request)}
                    onChat={() => setChatRequest(request)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {activeTab === "compras" && (
        <main className="mx-auto max-w-7xl px-4 py-6">
          {/* Mis Compras */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Mis Compras</h2>
              <Button
                variant="outline"
                className="h-11 gap-2"
                onClick={() => (window.location.href = "/#productos")}
              >
                <ShoppingBag className="h-5 w-5" /> Explorar mercado
              </Button>
            </div>

            {myPurchases.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No has realizado compras aún</h3>
                  <p className="mt-1 text-muted-foreground">
                    Cuando contactes a un vendedor, tu solicitud aparecerá aquí
                  </p>
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => (window.location.href = "/#productos")}
                  >
                    <ShoppingBag className="h-5 w-5" /> Ir al mercado
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {myPurchases.map((purchase) => (
                  <PurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    onView={() => setViewRequest(purchase)}
                    onChat={() => setChatPurchase(purchase)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* Dialog ver solicitud */}
      <Dialog open={!!viewRequest} onOpenChange={(open) => !open && setViewRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de solicitud</DialogTitle>
            <DialogDescription>Información del comprador interesado</DialogDescription>
          </DialogHeader>
          {viewRequest && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="font-bold">{viewRequest.comprador_nombre}</p>
                <p className="text-sm text-muted-foreground">{viewRequest.comprador_contacto}</p>
                <Badge variant="outline" className="mt-2">
                  Producto: {viewRequest.producto_id ? `#${viewRequest.producto_id}` : "General"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={viewRequest.estado === "pendiente" ? "default" : "secondary"}>
                  {viewRequest.estado}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(viewRequest.fecha_solicitud)}
                </span>
              </div>
              <Button className="w-full" onClick={() => setViewRequest(null)}>
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Chat */}
      <Dialog open={!!chatRequest} onOpenChange={(open) => !open && setChatRequest(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          {chatRequest && currentUser && (
            <Chat
              productoId={chatRequest.producto_id || 0}
              miUserId={currentUser.id}
              otroUserId={chatRequest.comprador_id || ""}
              otroNombre={chatRequest.comprador_nombre}
              onClose={() => setChatRequest(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componentes auxiliares
interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  pausedProducts: number;
  totalUnits: number;
  totalRequests: number;
  pendingRequests: number;
  uniqueBuyers: number;
}

interface ProductWithStats {
  id: number;
  nombre: string;
  categoria: string;
  municipio: string;
  vendedor: string;
  vendedor_id: string;
  precio_unitario: number;
  unidad_medida: string;
  cantidad_disponible: string;
  frescura?: string;
  imagen_url?: string | null;
  fecha_publicacion?: string;
  pausado?: boolean;
}

interface ContactRequest {
  id: number;
  producto_id: number | null;
  comprador_nombre: string;
  comprador_contacto: string;
  comprador_id: string | null;
  vendedor_nombre: string;
  estado: string;
  fecha_solicitud?: string;
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ProductCard({
  product,
  onTogglePause,
  onDelete,
  isPausing,
  isDeleting,
}: {
  product: ProductWithStats;
  onTogglePause: () => void;
  onDelete: () => void;
  isPausing: boolean;
  isDeleting: boolean;
}) {
  const image =
    product.imagen_url ||
    (product.categoria === "Plátanos"
      ? "/src/assets/product-platano.jpg"
      : product.categoria === "Cacao"
        ? "/src/assets/product-cacao.jpg"
        : "/src/assets/product-canasta.jpg");

  return (
    <Card className={cn(product.pausado && "opacity-60 border-amber-200")}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
        <img src={image} alt={product.nombre} className="w-full h-full object-cover" />
        {product.pausado && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge className="text-lg px-3 py-1" variant="secondary">
              <EyeOff className="mr-1 h-4 w-4" /> PAUSADO
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Badge variant="outline" className="mb-1">
              {product.categoria}
            </Badge>
            <h3 className="font-bold truncate">{product.nombre}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {product.municipio}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-primary">
              ${Number(product.precio_unitario).toLocaleString("es-CO")}
            </p>
            <p className="text-xs text-muted-foreground">por {product.unidad_medida}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Disponible: <strong>{product.cantidad_disponible}</strong>
          </span>
          <span className="text-muted-foreground">{formatDate(product.fecha_publicacion)}</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onTogglePause}
            disabled={isPausing}
          >
            {isPausing ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : product.pausado ? (
              <>
                <Eye className="mr-1 h-4 w-4" /> Activar
              </>
            ) : (
              <>
                <EyeOff className="mr-1 h-4 w-4" /> Pausar
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-9 px-3"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestCard({
  request,
  onView,
  onChat,
}: {
  request: ContactRequest;
  onView: () => void;
  onChat: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 pr-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold">{request.comprador_nombre}</p>
              <Badge variant="outline">{request.estado}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> {request.comprador_contacto}
            </p>
            {request.producto_id && (
              <p className="mt-1 text-xs text-muted-foreground">Producto #{request.producto_id}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(request.fecha_solicitud)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onView}>
              Ver detalle
            </Button>
            {request.comprador_id && (
              <Button variant="default" size="sm" onClick={onChat}>
                <MessageCircle className="mr-1 h-4 w-4" /> Chat
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Tipos adicionales para compras
interface PurchaseRequest {
  id: number;
  producto_id: number | null;
  comprador_nombre: string;
  comprador_contacto: string;
  comprador_id: string | null;
  vendedor_nombre: string;
  estado: string;
  fecha_solicitud?: string;
  productos?: {
    id: number;
    nombre: string;
    categoria: string;
    municipio: string;
    vendedor: string;
    vendedor_id: string;
    precio_unitario: number;
    unidad_medida: string;
    cantidad_disponible: string;
    imagen_url?: string | null;
    frescura?: string;
  } | null;
}

function PurchaseCard({
  purchase,
  onView,
  onChat,
}: {
  purchase: PurchaseRequest;
  onView: () => void;
  onChat: () => void;
}) {
  const product = purchase.productos;
  const image =
    product?.imagen_url ||
    (product?.categoria === "Plátanos"
      ? "/src/assets/product-platano.jpg"
      : product?.categoria === "Cacao"
        ? "/src/assets/product-cacao.jpg"
        : "/src/assets/product-canasta.jpg");

  return (
    <Card>
      <CardContent className="pt-4 pb-4 pr-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted">
              <img
                src={image}
                alt={product?.nombre || "Producto"}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold">{product?.nombre || "Producto"}</p>
                <Badge variant="outline">{purchase.estado}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {product?.municipio || "—"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" /> Vendedor: {purchase.vendedor_nombre}
              </p>
              {product && (
                <p className="mt-1 text-lg font-black text-primary">
                  ${Number(product.precio_unitario).toLocaleString("es-CO")} /{" "}
                  {product.unidad_medida}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(purchase.fecha_solicitud)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onView}>
              Ver detalle
            </Button>
            {purchase.vendedor_id && product?.vendedor_id && (
              <Button variant="default" size="sm" onClick={onChat}>
                <MessageCircle className="mr-1 h-4 w-4" /> Chat
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
