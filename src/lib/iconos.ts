import {
  Baby, Banknote, Bath, Beer, BookOpen, Briefcase, Building2, Bus, Car, CircleDollarSign, Coffee, Coins, CreditCard,
  Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, Hammer, Heart, HeartPulse, House, Landmark, LifeBuoy,
  Music, PawPrint, PiggyBank, Pill, Plane, Popcorn, QrCode, Receipt, Scissors, Shirt, ShoppingBag, ShoppingCart,
  Smartphone, Sparkles, Store, Tag, Target, Tv, Umbrella, UtensilsCrossed, Wallet, Wifi, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'
import type { TipoCuenta } from '../types'

/** Catálogo de iconos que el usuario puede elegir para categorías y fondos. */
export const ICONOS: Record<string, { icono: LucideIcon; nombre: string }> = {
  comida: { icono: UtensilsCrossed, nombre: 'Comida' },
  cafe: { icono: Coffee, nombre: 'Café' },
  super: { icono: ShoppingCart, nombre: 'Supermercado' },
  compras: { icono: ShoppingBag, nombre: 'Compras' },
  casa: { icono: House, nombre: 'Casa' },
  servicios: { icono: Zap, nombre: 'Servicios' },
  internet: { icono: Wifi, nombre: 'Internet' },
  celular: { icono: Smartphone, nombre: 'Celular' },
  transporte: { icono: Bus, nombre: 'Transporte' },
  auto: { icono: Car, nombre: 'Auto' },
  gasolina: { icono: Fuel, nombre: 'Gasolina' },
  viajes: { icono: Plane, nombre: 'Viajes' },
  salud: { icono: HeartPulse, nombre: 'Salud' },
  farmacia: { icono: Pill, nombre: 'Farmacia' },
  higiene: { icono: Bath, nombre: 'Higiene' },
  belleza: { icono: Scissors, nombre: 'Belleza' },
  gimnasio: { icono: Dumbbell, nombre: 'Gimnasio' },
  amor: { icono: Heart, nombre: 'Pareja' },
  regalos: { icono: Gift, nombre: 'Regalos' },
  ropa: { icono: Shirt, nombre: 'Ropa' },
  educacion: { icono: GraduationCap, nombre: 'Educación' },
  libros: { icono: BookOpen, nombre: 'Libros' },
  suscripciones: { icono: Tv, nombre: 'Suscripciones' },
  ocio: { icono: Popcorn, nombre: 'Ocio' },
  juegos: { icono: Gamepad2, nombre: 'Juegos' },
  musica: { icono: Music, nombre: 'Música' },
  salidas: { icono: Beer, nombre: 'Salidas' },
  mascotas: { icono: PawPrint, nombre: 'Mascotas' },
  hijos: { icono: Baby, nombre: 'Hijos' },
  trabajo: { icono: Briefcase, nombre: 'Trabajo' },
  negocio: { icono: Store, nombre: 'Negocio' },
  reparaciones: { icono: Wrench, nombre: 'Reparaciones' },
  herramientas: { icono: Hammer, nombre: 'Herramientas' },
  impuestos: { icono: Receipt, nombre: 'Impuestos' },
  deudas: { icono: HandCoins, nombre: 'Deudas' },
  ahorro: { icono: PiggyBank, nombre: 'Ahorro' },
  inversion: { icono: Coins, nombre: 'Inversión' },
  emergencias: { icono: LifeBuoy, nombre: 'Emergencias' },
  seguro: { icono: Umbrella, nombre: 'Seguro' },
  metas: { icono: Target, nombre: 'Metas' },
  extras: { icono: Sparkles, nombre: 'Extras' },
  otros: { icono: Tag, nombre: 'Otros' },
}

const PISTAS: [RegExp, string][] = [
  [/comida|aliment|restaur|almuerzo|cena/i, 'comida'],
  [/caf[eé]/i, 'cafe'],
  [/super|mercado|despensa/i, 'super'],
  [/compra/i, 'compras'],
  [/casa|hogar|alquiler|renta|vivienda/i, 'casa'],
  [/luz|agua|gas\b|servicio|electric/i, 'servicios'],
  [/internet|wifi/i, 'internet'],
  [/celular|tel[eé]fono|m[oó]vil/i, 'celular'],
  [/transporte|micro|taxi|bus|pasaje/i, 'transporte'],
  [/auto|carro|veh[ií]culo/i, 'auto'],
  [/gasolina|combustible/i, 'gasolina'],
  [/viaje|vacacion/i, 'viajes'],
  [/salud|m[eé]dic|doctor|hospital/i, 'salud'],
  [/farmacia|medicina|remedio/i, 'farmacia'],
  [/higiene|aseo|limpieza/i, 'higiene'],
  [/belleza|peluquer|barber/i, 'belleza'],
  [/gimnasio|gym|deporte/i, 'gimnasio'],
  [/amor|pareja|novi/i, 'amor'],
  [/regalo/i, 'regalos'],
  [/ropa|vestimenta|calzado/i, 'ropa'],
  [/educaci|colegio|universidad|curso/i, 'educacion'],
  [/libro/i, 'libros'],
  [/suscrip|netflix|spotify|streaming/i, 'suscripciones'],
  [/ocio|cine|entreten/i, 'ocio'],
  [/juego/i, 'juegos'],
  [/salida|fiesta|bar\b/i, 'salidas'],
  [/mascota|perro|gato/i, 'mascotas'],
  [/hij|beb[eé]|ni[ñn]o/i, 'hijos'],
  [/trabajo|oficina/i, 'trabajo'],
  [/negocio/i, 'negocio'],
  [/repara|manten/i, 'reparaciones'],
  [/impuesto/i, 'impuestos'],
  [/deuda|pr[eé]stamo|cr[eé]dito/i, 'deudas'],
  [/ahorro/i, 'ahorro'],
  [/inversi/i, 'inversion'],
  [/emergencia|imprevisto/i, 'emergencias'],
  [/seguro/i, 'seguro'],
  [/meta|objetivo/i, 'metas'],
  [/gasto/i, 'super'],
  [/extra/i, 'extras'],
]

/** Sugiere una clave de icono a partir del nombre. */
export function sugerirIcono(nombre: string): string {
  return PISTAS.find(([re]) => re.test(nombre))?.[1] ?? 'otros'
}

export function iconoDe(item: { nombre: string; icono?: string }): LucideIcon {
  return ICONOS[item.icono ?? '']?.icono ?? ICONOS[sugerirIcono(item.nombre)].icono
}

export const ICONO_CUENTA: Record<TipoCuenta, LucideIcon> = {
  Banco: Landmark,
  Efectivo: Banknote,
  Billetera: Wallet,
  Otro: CircleDollarSign,
}

export function iconoMetodo(nombre: string): LucideIcon {
  if (/efectivo/i.test(nombre)) return Banknote
  if (/qr|transfer/i.test(nombre)) return QrCode
  if (/tarjeta|d[eé]bito|cr[eé]dito/i.test(nombre)) return CreditCard
  return Building2
}
