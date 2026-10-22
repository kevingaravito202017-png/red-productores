import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Banana, Camera, Check, ChevronRight, CircleUserRound,
  HandCoins, Heart, HelpCircle, Home, Leaf, MapPin, MessageCircle, Mic, PackagePlus,
  Search, ShieldCheck, ShoppingBasket, SlidersHorizontal, Sprout, Store, Wheat, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuthDialog, type DemoUser } from "@/components/AuthDialog";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/red-productores-logo.jpeg.asset.json";
import platanoImage from "@/assets/product-platano.jpg";
import cacaoImage from "@/assets/product-cacao.jpg";
import canastaImage from "@/assets/product-canasta.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mercado local | Red de Productores de Urabá" },
      { name: "description", content: "Encuentra y publica cosechas locales de Urabá de forma directa y sencilla." },
      { property: "og:title", content: "Mercado local | Red de Productores de Urabá" },
      { property: "og:description", content: "Productores y compradores de Urabá conectados sin intermediarios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
});

const products = [
  { id: 1, name: "Plátano hartón", category: "Plátanos", place: "Chigorodó", seller: "Don Álvaro", price: "$2.200", unit: "kilo", amount: "180 kilos", image: platanoImage, freshness: "Cosechado hoy" },
  { id: 2, name: "Cacao de finca", category: "Cacao", place: "Apartadó", seller: "Finca La Esperanza", price: "$11.500", unit: "kilo", amount: "45 kilos", image: cacaoImage, freshness: "Disponible ahora" },
  { id: 3, name: "Canasta de cosecha", category: "Canastas", place: "Carepa", seller: "Asociación El Porvenir", price: "$38.000", unit: "canasta", amount: "22 canastas", image: canastaImage, freshness: "Entrega mañana" },
];

const categories = [
  { name: "Todos", icon: ShoppingBasket },
  { name: "Plátanos", icon: Banana },
  { name: "Frutas", icon: Leaf },
  { name: "Verduras", icon: Sprout },
  { name: "Granos", icon: Wheat },
];

function Marketplace() {
  const [productList, setProductList] = useState(products);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [place, setPlace] = useState("Todo Urabá");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selected, setSelected] = useState<(typeof products)[number] | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [published, setPublished] = useState(false);
  const [listening, setListening] = useState(false);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("register");
  const [contactDone, setContactDone] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [pubForm, setPubForm] = useState({
    name: "",
    amount: "",
    price: "",
    notes: "",
    town: "Apartadó",
    phone: "",
  });

  const setPub = (key: keyof typeof pubForm, value: string) =>
    setPubForm((prev) => ({ ...prev, [key]: value }));

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .order("id", { ascending: false });

      if (data && data.length > 0) {
        const mapped = data.map((p) => ({
          id: p.id,
          name: p.nombre,
          category: p.categoria || "Plátanos",
          place: p.municipio,
          seller: p.vendedor,
          price: `$${Number(p.precio_unitario).toLocaleString("es-CO")}`,
          unit: p.unidad_medida,
          amount: p.cantidad_disponible,
          image:
            p.imagen_url ||
            (p.categoria === "Plátanos"
              ? platanoImage
              : p.categoria === "Cacao"
              ? cacaoImage
              : canastaImage),
          freshness: p.frescura || "Disponible ahora",
        }));
        setProductList(mapped);
      }
    } catch (err) {
      console.error("Error al obtener productos de Supabase:", err);
    }
  }

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("red_productores_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.warn("Error leyendo sesión local:", e);
    }
    fetchProducts();
  }, []);

  function openAuth(tab: "login" | "register") {
    setAuthTab(tab);
    setAuthOpen(true);
  }

  async function contactSeller() {
    if (!selected) return;
    if (!user) {
      openAuth("login");
      return;
    }

    try {
      await supabase.from("solicitudes_contacto").insert({
        producto_id: typeof selected.id === "number" ? selected.id : null,
        comprador_nombre: user.name,
        comprador_contacto: user.contact,
        vendedor_nombre: selected.seller,
        estado: "pendiente",
      });
    } catch (err) {
      console.warn("Aviso al guardar solicitud en Supabase:", err);
    }

    setContactDone(selected.seller);
  }

  const filtered = useMemo(() => productList.filter((product) => {
    const matchesQuery = `${product.name} ${product.seller} ${product.place}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "Todos" || product.category === category;
    const matchesPlace = place === "Todo Urabá" || product.place === place;
    return matchesQuery && matchesCategory && matchesPlace;
  }), [productList, query, category, place]);

  function startPublishing() {
    setMode("sell");
    setStep(1);
    setPublished(false);
    setPhoto(null);
    setPhotoError(false);
    setPubForm({
      name: "",
      amount: "",
      price: "",
      notes: "",
      town: user?.town || "Apartadó",
      phone: user?.contact || "",
    });
    setPublishOpen(true);
  }

  async function handlePublishNext() {
    if (step === 1) {
      if (!photo) {
        setPhotoError(true);
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      const priceNum = Number(pubForm.price.replace(/\D/g, "")) || 2500;
      try {
        await supabase.from("productos").insert({
          nombre: pubForm.name.trim() || "Cosecha fresca de Urabá",
          categoria: "Plátanos",
          municipio: pubForm.town,
          vendedor: user?.name || "Productor local",
          precio_unitario: priceNum,
          unidad_medida: "kilo",
          cantidad_disponible: pubForm.amount.trim() || "20 kilos",
          frescura: "Cosechado hoy",
          imagen_url: photo || null,
        });
        await fetchProducts();
      } catch (err) {
        console.warn("Aviso al publicar producto en Supabase:", err);
      }
      setPublished(true);
    }
  }

  function useVoiceSearch() {
    setListening(true);
    window.setTimeout(() => {
      setQuery("plátano");
      setListening(false);
      document.querySelector("#productos")?.scrollIntoView({ behavior: "smooth" });
    }, 900);
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:flex md:px-8">
          <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Ir al inicio">
            <img src={logoAsset.url} alt="Red de Productores Locales Urabá" className="h-12 w-12 shrink-0 rounded-full object-cover object-top" />
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-display text-base font-bold text-primary md:text-lg">Red de Productores</span>
              <span className="block text-xs font-extrabold uppercase text-accent">Locales · Urabá</span>
            </div>
          </button>
          <nav className="ml-auto hidden items-center gap-2 md:flex" aria-label="Navegación principal">
            <Button variant="ghost" className="h-11" onClick={() => document.querySelector("#productos")?.scrollIntoView()}>Comprar</Button>
            <Button variant="ghost" className="h-11" onClick={startPublishing}>Vender</Button>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setHelpOpen(true)} aria-label="Ayuda"><HelpCircle /></Button>
            {user ? (
              <Button variant="outline" className="h-11 gap-2" onClick={() => setProfileOpen(true)}>
                <CircleUserRound className="h-4 w-4" />
                <span className="font-bold">{user.name.split(" ")[0]}</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2 border-l border-border pl-2">
                <Button variant="ghost" className="h-11 font-bold text-foreground" onClick={() => openAuth("login")}>
                  Iniciar sesión
                </Button>
                <Button className="h-11 font-bold shadow-sm" onClick={() => openAuth("register")}>
                  Registrarse
                </Button>
              </div>
            )}
          </nav>
          <div className="flex items-center gap-1 md:hidden">
            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={() => setHelpOpen(true)} aria-label="Abrir ayuda"><HelpCircle /></Button>
            {user ? (
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-primary" onClick={() => setProfileOpen(true)} aria-label="Mi cuenta">
                <CircleUserRound className="h-6 w-6" />
              </Button>
            ) : (
              <Button size="sm" className="h-9 px-3 text-xs font-bold" onClick={() => openAuth("login")}>
                Ingresar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-secondary/30">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 md:grid-cols-[1.05fr_.95fr] md:px-8 md:py-14">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-card px-3 py-2 text-sm font-bold text-primary shadow-sm"><ShieldCheck className="h-5 w-5" /> Compra directa y de confianza</div>
              <h1 className="text-4xl font-bold leading-[1.05] text-primary sm:text-5xl lg:text-6xl">Del campo de Urabá directo a tus manos.</h1>
              <p className="mt-5 max-w-xl text-lg font-semibold leading-relaxed text-muted-foreground">Encuentra cosechas cercanas o publica lo que tienes para vender. Fácil, rápido y sin intermediarios.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Button className="h-16 justify-between px-5 text-lg font-extrabold shadow-lg" onClick={() => { setMode("buy"); document.querySelector("#productos")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <span className="flex items-center gap-3"><ShoppingBasket className="h-6 w-6" /> Quiero comprar</span><ArrowRight className="h-5 w-5" />
                </Button>
                <Button variant="outline" className="h-16 justify-between border-primary/30 bg-card px-5 text-lg font-extrabold text-primary shadow-sm" onClick={startPublishing}>
                  <span className="flex items-center gap-3"><PackagePlus className="h-6 w-6" /> Quiero vender</span><ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-card shadow-xl">
              <img src={platanoImage} alt="Productor local seleccionando plátanos frescos" width={1200} height={800} className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-3 bottom-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md bg-card/95 p-3 shadow-lg backdrop-blur">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-secondary-foreground"><HandCoins className="h-6 w-6" /></div>
                <div className="min-w-0"><p className="font-extrabold">Pago justo para quien cultiva</p><p className="truncate text-sm text-muted-foreground">Apoya a familias productoras de la región</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12" id="productos">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0"><p className="mb-1 text-sm font-extrabold uppercase text-accent">Mercado local</p><h2 className="text-3xl font-bold text-primary md:text-4xl">¿Qué estás buscando?</h2></div>
            <span className="hidden text-sm font-bold text-muted-foreground sm:block">{filtered.length} productos</span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="grid grid-cols-[minmax(0,1fr)_52px] items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
              <div className="flex min-w-0 items-center"><Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribe: plátano, yuca, cacao..." aria-label="Buscar productos" className="h-12 border-0 text-base shadow-none focus-visible:ring-0" />{query && <Button variant="ghost" size="icon" onClick={() => setQuery("")} aria-label="Borrar búsqueda"><X /></Button>}</div>
              <Button size="icon" className={cn("h-12 w-12 rounded-full", listening && "animate-pulse bg-accent")} onClick={useVoiceSearch} aria-label="Buscar con la voz"><Mic className="h-6 w-6" /></Button>
            </div>
            <label className="flex h-[70px] items-center gap-2 rounded-lg border border-border bg-card px-4 font-bold shadow-sm"><MapPin className="h-5 w-5 text-accent" /><select value={place} onChange={(event) => setPlace(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Filtrar por municipio"><option>Todo Urabá</option><option>Apartadó</option><option>Carepa</option><option>Chigorodó</option></select><SlidersHorizontal className="h-4 w-4" /></label>
          </div>
          {listening && <p className="mt-2 flex items-center gap-2 text-sm font-bold text-primary"><Mic className="h-4 w-4" /> Te escucho... di el producto que buscas</p>}

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Categorías">
            {categories.map(({ name, icon: Icon }) => <Button key={name} variant={category === name ? "default" : "outline"} className="h-12 shrink-0 gap-2 bg-card px-4 text-base data-[active=true]:bg-primary" data-active={category === name} onClick={() => setCategory(name)}><Icon className="h-5 w-5" />{name}</Button>)}
          </div>

          {filtered.length > 0 ? <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => <article key={product.id} className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="relative"><img src={product.image} alt={product.name} loading="lazy" width={1200} height={800} className="aspect-[4/3] w-full object-cover" /><Button variant="secondary" size="icon" className="absolute right-3 top-3 h-11 w-11 rounded-full shadow-md" onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} aria-label={favorites.includes(product.id) ? "Quitar de favoritos" : "Guardar en favoritos"}><Heart className={cn("h-5 w-5", favorites.includes(product.id) && "fill-accent text-accent")} /></Button><span className="absolute bottom-3 left-3 rounded-md bg-card/95 px-3 py-1.5 text-sm font-extrabold text-primary shadow">{product.freshness}</span></div>
              <div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-muted-foreground">{product.category}</p><h3 className="mt-1 text-2xl font-bold">{product.name}</h3></div><div className="shrink-0 text-right"><p className="text-xl font-black text-primary">{product.price}</p><p className="text-xs text-muted-foreground">por {product.unit}</p></div></div><p className="mt-3 flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-accent" />{product.place} · {product.seller}</p><p className="mt-2 text-sm text-muted-foreground">Disponibles: <strong className="text-foreground">{product.amount}</strong></p><Button className="mt-5 h-12 w-full justify-between text-base font-extrabold" onClick={() => setSelected(product)}>Ver producto <ChevronRight /></Button></div>
            </article>)}
          </div> : <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-10 text-center"><Search className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-3 text-xl font-bold">No encontramos ese producto</h3><p className="mt-1 text-muted-foreground">Prueba con otra palabra o elige “Todos”.</p><Button className="mt-5" onClick={() => { setQuery(""); setCategory("Todos"); setPlace("Todo Urabá"); }}>Ver todos los productos</Button></div>}
        </section>

        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-7xl gap-7 px-4 py-10 md:grid-cols-[1fr_auto] md:items-center md:px-8">
            <div><p className="text-sm font-extrabold uppercase text-secondary">Para productores</p><h2 className="mt-2 max-w-2xl text-3xl font-bold md:text-4xl">Publica tu cosecha en solo 3 pasos.</h2><p className="mt-3 max-w-xl text-primary-foreground/80">Toma una foto, cuenta qué vendes y dinos dónde estás. Nosotros te guiamos.</p></div>
            <Button variant="secondary" className="h-16 px-6 text-lg font-black" onClick={startPublishing}><PackagePlus className="h-6 w-6" /> Publicar producto</Button>
          </div>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl md:hidden" aria-label="Navegación móvil">
        <Button variant="ghost" className="h-14 flex-col gap-1 px-1 text-xs text-primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Home className="h-5 w-5" />Inicio</Button>
        <Button variant="ghost" className="h-14 flex-col gap-1 px-1 text-xs" onClick={() => document.querySelector("#productos")?.scrollIntoView()}><Search className="h-5 w-5" />Buscar</Button>
        <Button variant="ghost" className="h-14 flex-col gap-1 px-1 text-xs" onClick={startPublishing}><PackagePlus className="h-5 w-5" />Publicar</Button>
        <Button variant="ghost" className="h-14 flex-col gap-1 px-1 text-xs" onClick={() => setProfileOpen(true)}><CircleUserRound className="h-5 w-5" />Mi cuenta</Button>
      </nav>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-0"><DialogHeader className="sr-only"><DialogTitle>Detalle del producto</DialogTitle><DialogDescription>Información y contacto del producto seleccionado</DialogDescription></DialogHeader>{selected && <><img src={selected.image} alt={selected.name} width={1200} height={800} className="aspect-[16/9] w-full object-cover" /><div className="p-6"><span className="rounded-md bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">{selected.freshness}</span><div className="mt-4 flex items-start justify-between gap-4"><div><h2 className="text-3xl font-bold">{selected.name}</h2><p className="mt-2 flex items-center gap-2 font-bold"><MapPin className="h-5 w-5 text-accent" />{selected.place}</p></div><div className="text-right"><p className="text-2xl font-black text-primary">{selected.price}</p><p className="text-sm text-muted-foreground">por {selected.unit}</p></div></div><div className="mt-5 rounded-lg bg-muted p-4"><p className="font-extrabold">Vende: {selected.seller}</p><p className="mt-1 text-sm text-muted-foreground">Tiene {selected.amount} disponibles. Coordina directamente la cantidad, el pago y la entrega.</p></div><Button className="mt-5 h-14 w-full text-lg font-black" onClick={contactSeller}><MessageCircle className="h-6 w-6" /> Hablar con el productor</Button>{contactDone === selected.seller && user && <div role="status" className="mt-4 rounded-lg bg-secondary/40 p-4 text-sm"><p className="font-extrabold">¡Listo, {user.name.split(" ")[0]}!</p><p className="mt-1">Le avisamos a {selected.seller} que quieres comprar. Te contactará a tu {user.method === "phone" ? "celular" : "correo"}: <strong>{user.contact}</strong>.</p></div>}{!user && <p className="mt-3 text-center text-sm font-bold text-muted-foreground">Para hablar con el productor debes crear una cuenta o ingresar.</p>}<p className="mt-3 text-center text-xs text-muted-foreground">Prototipo: no se realizará ningún cobro.</p></div></>}</DialogContent></Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle className="text-2xl">{published ? "¡Tu producto está listo!" : "Publica tu cosecha"}</DialogTitle><DialogDescription>{published ? "Los compradores ya podrán encontrarlo en el mercado." : `Paso ${step} de 3 · Te tomará menos de 2 minutos`}</DialogDescription></DialogHeader>{published ? <div className="py-6 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-secondary text-secondary-foreground"><Check className="h-10 w-10" /></div><h3 className="mt-5 text-2xl font-bold">Publicación completada</h3><p className="mt-2 text-muted-foreground">Tu cosecha ya quedó guardada en la base de datos de Supabase.</p><Button className="mt-6 h-12 w-full" onClick={() => setPublishOpen(false)}>Volver al mercado</Button></div> : <><div className="flex gap-2 py-2" aria-label={`Paso ${step} de 3`}>{[1,2,3].map((number) => <div key={number} className={cn("h-2 flex-1 rounded-full", number <= step ? "bg-primary" : "bg-muted")} />)}</div>{step === 1 && <div className="space-y-5"><label htmlFor="product-photo" className={cn("relative grid min-h-48 w-full cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed bg-secondary/20 p-5 text-primary transition hover:bg-secondary/40", photoError ? "border-destructive" : "border-primary/35")}>{photo ? <><img src={photo} alt="Foto del producto" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute bottom-3 rounded-md bg-card/95 px-3 py-1 text-sm font-bold"><Check className="mr-1 inline h-4 w-4" />Foto lista · toca para cambiarla</span></> : <span className="text-center"><Camera className="mx-auto h-12 w-12" /><strong className="mt-3 block text-lg">Toca aquí para tomar la foto</strong><small className="mt-1 block text-muted-foreground">Obligatorio · Una foto clara ayuda a vender mejor</small></span>}<input id="product-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto(URL.createObjectURL(f)); setPhotoError(false); } }} /></label>{photoError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-bold text-destructive">Debes tomar una foto del producto para continuar.</p>}<div><Label htmlFor="product-name" className="text-base font-bold">¿Qué producto vendes?</Label><Input id="product-name" className="mt-2 h-12 text-base" placeholder="Ejemplo: plátano hartón" value={pubForm.name} onChange={(e) => setPub("name", e.target.value)} /></div></div>}{step === 2 && <div className="space-y-5"><div><Label htmlFor="amount" className="text-base font-bold">¿Cuánto tienes disponible?</Label><Input id="amount" className="mt-2 h-12 text-base" placeholder="Ejemplo: 50 kilos" value={pubForm.amount} onChange={(e) => setPub("amount", e.target.value)} /></div><div><Label htmlFor="price" className="text-base font-bold">Precio por kilo o unidad</Label><Input id="price" className="mt-2 h-12 text-base" inputMode="numeric" placeholder="Ejemplo: 2.500" value={pubForm.price} onChange={(e) => setPub("price", e.target.value)} /></div><div><Label htmlFor="notes" className="text-base font-bold">¿Quieres contar algo más? <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="notes" className="mt-2 min-h-24 text-base" placeholder="Ejemplo: recién cosechado, puedo llevarlo a Apartadó" value={pubForm.notes} onChange={(e) => setPub("notes", e.target.value)} /></div></div>}{step === 3 && <div className="space-y-5"><div><Label htmlFor="town" className="text-base font-bold">¿En qué municipio estás?</Label><select id="town" className="mt-2 h-12 w-full rounded-md border border-input bg-card px-3 text-base" value={pubForm.town} onChange={(e) => setPub("town", e.target.value)}><option>Apartadó</option><option>Carepa</option><option>Chigorodó</option><option>Turbo</option><option>Mutatá</option></select></div><div><Label htmlFor="phone" className="text-base font-bold">Número para recibir mensajes</Label><Input id="phone" className="mt-2 h-12 text-base" inputMode="tel" placeholder="Ejemplo: 300 123 4567" value={pubForm.phone} onChange={(e) => setPub("phone", e.target.value)} /></div><div className="rounded-lg bg-muted p-4 text-sm"><strong className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Tú decides con quién hablar</strong><p className="mt-1 text-muted-foreground">Nunca compartas claves ni códigos de seguridad.</p></div></div>}<div className="mt-3 grid grid-cols-2 gap-3"><Button variant="outline" className="h-12" disabled={step === 1} onClick={() => setStep((current) => current - 1)}><ArrowLeft /> Atrás</Button><Button className="h-12" onClick={handlePublishNext}>{step < 3 ? <>Continuar <ArrowRight /></> : <>Publicar <Check /></>}</Button></div></>}</DialogContent></Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent><DialogHeader><DialogTitle className="text-2xl">¿Cómo podemos ayudarte?</DialogTitle><DialogDescription>Elige lo que quieres hacer y te llevamos al lugar correcto.</DialogDescription></DialogHeader><div className="grid gap-3"><Button className="h-16 justify-start text-base" onClick={() => { setHelpOpen(false); document.querySelector("#productos")?.scrollIntoView(); }}><ShoppingBasket className="h-6 w-6" /> Quiero buscar alimentos</Button><Button variant="outline" className="h-16 justify-start text-base" onClick={() => { setHelpOpen(false); startPublishing(); }}><Store className="h-6 w-6" /> Quiero publicar mi cosecha</Button><div className="rounded-lg bg-muted p-4"><p className="font-bold">Consejo</p><p className="mt-1 text-sm text-muted-foreground">Puedes tocar el micrófono y decir en voz alta el producto que buscas.</p></div></div></DialogContent></Dialog>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialTab={authTab} reason={selected ? `Para hablar con ${selected.seller} necesitas una cuenta. Es rápido y gratis.` : undefined} onSuccess={(u) => { setUser(u); setAuthOpen(false); if (selected) setContactDone(selected.seller); }} />
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogContent><DialogHeader><DialogTitle className="text-2xl">Mi cuenta</DialogTitle><DialogDescription>{user ? "Estos son tus datos en la Red." : "Ingresa para hablar con productores y compradores."}</DialogDescription></DialogHeader>{user ? <div className="space-y-3"><div className="rounded-lg bg-muted p-5"><CircleUserRound className="h-10 w-10 text-primary" /><p className="mt-2 text-xl font-bold">{user.name}</p><p className="text-sm text-muted-foreground">{user.role} · {user.town}</p><p className="mt-2 text-sm">{user.method === "phone" ? "Celular" : "Correo"}: <strong>{user.contact}</strong></p></div><Button variant="outline" className="h-12 w-full" onClick={() => { localStorage.removeItem("red_productores_user"); setUser(null); setContactDone(null); setProfileOpen(false); }}>Cerrar sesión</Button></div> : <div className="grid gap-3 sm:grid-cols-2"><Button className="h-14 text-base font-bold" onClick={() => { setProfileOpen(false); openAuth("login"); }}><CircleUserRound className="mr-2 h-5 w-5" /> Iniciar sesión</Button><Button variant="outline" className="h-14 text-base font-bold" onClick={() => { setProfileOpen(false); openAuth("register"); }}>Registrarse</Button></div>}</DialogContent></Dialog>
    </div>
  );
}
