import type { StoreSettings } from '../types/db'
import { normalizeWhatsApp } from './phone'
import { publicImageUrl } from './supabase'
import { assetUrl } from './site'

export const DEFAULT_HERO_TITLE = 'Seu estilo, seu conforto, sua Global Tricot.'
export const DEFAULT_HERO_SUBTITLE = 'Descubra peças que combinam estilo, versatilidade e personalidade.'
export const DEFAULT_ABOUT =
  'A Global Tricot reúne peças de tricô e moda feminina, com atendimento direto pelo WhatsApp. Escolha o que gostou no site e finalize o pedido na conversa com a loja.'

/** Valores da loja já prontos para uso (com padrões seguros quando algo não foi preenchido). */
export interface StoreInfo {
  name: string
  logoUrl: string
  heroImageUrl: string | null
  heroTitle: string
  heroSubtitle: string
  about: string
  /** Número normalizado (55 + DDD + número) ou null se ausente/inválido. */
  whatsapp: string | null
  whatsappRaw: string | null
  instagramUrl: string | null
  city: string | null
  location: string | null
  email: string | null
  contactInfo: string | null
  deliveryEnabled: boolean
  pickupEnabled: boolean
  deliveryInfo: string | null
  pickupInfo: string | null
  greeting: string | null
  closing: string | null
}

const t = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null)

export function resolveStore(s: StoreSettings | null): StoreInfo {
  const wa = normalizeWhatsApp(s?.whatsapp_number)
  return {
    name: t(s?.store_name) ?? 'Global Tricot',
    logoUrl: publicImageUrl(s?.logo_path) ?? assetUrl('logo-instagram.jpg'),
    heroImageUrl: publicImageUrl(s?.hero_image_path),
    heroTitle: t(s?.hero_title) ?? DEFAULT_HERO_TITLE,
    heroSubtitle: t(s?.hero_subtitle) ?? DEFAULT_HERO_SUBTITLE,
    about: t(s?.about_text) ?? DEFAULT_ABOUT,
    whatsapp: wa.ok ? wa.value : null,
    whatsappRaw: t(s?.whatsapp_number),
    instagramUrl: t(s?.instagram_url),
    city: t(s?.city),
    location: t(s?.location_text),
    email: t(s?.contact_email),
    contactInfo: t(s?.contact_info),
    deliveryEnabled: s?.delivery_enabled ?? true,
    pickupEnabled: s?.pickup_enabled ?? true,
    deliveryInfo: t(s?.delivery_info),
    pickupInfo: t(s?.pickup_info),
    greeting: t(s?.order_greeting),
    closing: t(s?.order_closing),
  }
}
