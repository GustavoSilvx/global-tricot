import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { friendlyError } from '../../lib/errors'
import { validateImageFile } from '../../lib/images'
import { formatWhatsApp, normalizeWhatsApp } from '../../lib/phone'
import { publicImageUrl } from '../../lib/supabase'
import { DEFAULT_HERO_SUBTITLE, DEFAULT_HERO_TITLE } from '../../lib/store'
import { saveStoreSettings } from '../../services/settings'
import { removeImages, uploadImage } from '../../services/storage'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Alert, Spinner } from '../../components/ui/Feedback'
import { DEFAULT_CLOSING } from '../../lib/whatsapp'

const schema = z.object({
  store_name: z.string().trim().min(1, 'Informe o nome comercial.').max(80),
  about_text: z.string().trim().max(2000),
  hero_title: z.string().trim().max(120),
  hero_subtitle: z.string().trim().max(240),
  whatsapp_number: z.string().trim().refine((v) => v === '' || normalizeWhatsApp(v).ok, 'Número inválido. Use DDD + número, ex.: (81) 99999-9999.'),
  instagram_url: z.string().trim().refine((v) => v === '' || /^https:\/\/\S+$/.test(v), 'Use o link completo, começando com https://'),
  city: z.string().trim().max(80),
  location_text: z.string().trim().max(160),
  contact_email: z.string().trim().refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'E-mail inválido.'),
  contact_info: z.string().trim().max(500),
  delivery_enabled: z.boolean(),
  pickup_enabled: z.boolean(),
  delivery_info: z.string().trim().max(500),
  pickup_info: z.string().trim().max(500),
  order_greeting: z.string().trim().max(300),
  order_closing: z.string().trim().max(600),
})
type Values = z.infer<typeof schema>

type ImgState = { path: string | null; file: File | null; preview: string | null }

export default function AdminSettingsPage() {
  const { settings, status, reload } = useSettings()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [logo, setLogo] = useState<ImgState>({ path: null, file: null, preview: null })
  const [hero, setHero] = useState<ImgState>({ path: null, file: null, preview: null })
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (status !== 'ready' && status !== 'error') return
    const s = settings
    reset({
      store_name: s?.store_name ?? 'Global Tricot', about_text: s?.about_text ?? '', hero_title: s?.hero_title ?? '', hero_subtitle: s?.hero_subtitle ?? '',
      whatsapp_number: s?.whatsapp_number ? formatWhatsApp(s.whatsapp_number) : '', instagram_url: s?.instagram_url ?? '', city: s?.city ?? '', location_text: s?.location_text ?? '',
      contact_email: s?.contact_email ?? '', contact_info: s?.contact_info ?? '', delivery_enabled: s?.delivery_enabled ?? true, pickup_enabled: s?.pickup_enabled ?? true,
      delivery_info: s?.delivery_info ?? '', pickup_info: s?.pickup_info ?? '', order_greeting: s?.order_greeting ?? '', order_closing: s?.order_closing ?? '',
    })
    setLogo({ path: s?.logo_path ?? null, file: null, preview: publicImageUrl(s?.logo_path) })
    setHero({ path: s?.hero_image_path ?? null, file: null, preview: publicImageUrl(s?.hero_image_path) })
  }, [status, settings, reset])

  const pick = (setter: (s: ImgState) => void, current: ImgState) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = validateImageFile(file)
    if (problem) return setError(problem)
    setError(null)
    if (current.file && current.preview) URL.revokeObjectURL(current.preview)
    setter({ path: current.path, file, preview: URL.createObjectURL(file) })
  }

  if (status === 'loading') return <Spinner label="Carregando configurações" />
  const wa = watch('whatsapp_number') ?? ''
  const waState = wa.trim() === '' ? null : normalizeWhatsApp(wa)

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    setSaving(true)
    const uploaded: string[] = []
    const stale: string[] = []
    try {
      let logoPath = logo.path
      let heroPath = hero.path
      if (logo.file) { logoPath = await uploadImage('store', 'branding', logo.file); uploaded.push(logoPath); if (settings?.logo_path) stale.push(settings.logo_path) }
      else if (!logo.preview && settings?.logo_path) { logoPath = null; stale.push(settings.logo_path) }
      if (hero.file) { heroPath = await uploadImage('store', 'branding', hero.file); uploaded.push(heroPath); if (settings?.hero_image_path) stale.push(settings.hero_image_path) }
      else if (!hero.preview && settings?.hero_image_path) { heroPath = null; stale.push(settings.hero_image_path) }

      const n = (s: string) => (s.trim() === '' ? null : s.trim())
      const waParsed = normalizeWhatsApp(v.whatsapp_number)
      await saveStoreSettings({
        store_name: v.store_name, logo_path: logoPath, hero_image_path: heroPath, about_text: n(v.about_text), hero_title: n(v.hero_title), hero_subtitle: n(v.hero_subtitle),
        whatsapp_number: v.whatsapp_number.trim() === '' ? null : waParsed.ok ? waParsed.value : null, instagram_url: n(v.instagram_url), city: n(v.city), location_text: n(v.location_text),
        contact_email: n(v.contact_email), contact_info: n(v.contact_info), delivery_enabled: v.delivery_enabled, pickup_enabled: v.pickup_enabled,
        delivery_info: n(v.delivery_info), pickup_info: n(v.pickup_info), order_greeting: n(v.order_greeting), order_closing: n(v.order_closing),
      })
      await removeImages(stale)
      await reload()
      toast.success('Configurações salvas.')
    } catch (e) {
      await removeImages(uploaded)
      setError(`${friendlyError(e, 'Não foi possível salvar as configurações.')} Seus dados continuam no formulário.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  })

  const imageField = (label: string, state: ImgState, setter: (s: ImgState) => void, hint: string, square?: boolean) => (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-4">
        {state.preview ? <img src={state.preview} alt={`Prévia: ${label}`} className={`${square ? 'h-20 w-20 rounded-full' : 'h-24 w-20 rounded-sm'} object-cover`} /> : <div className="rib-soft flex h-20 w-20 items-center justify-center rounded-sm text-center text-[11px] text-brand-dark/70">Padrão</div>}
        <div className="flex flex-col gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center rounded border border-ink/25 bg-white px-3 text-sm font-semibold hover:border-ink">{state.preview ? 'Trocar' : 'Enviar imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick(setter, state)} /></label>
          {state.preview && <button type="button" className="text-left text-sm font-semibold text-red-700" onClick={() => setter({ path: null, file: null, preview: null })}>Remover</button>}
        </div>
      </div>
      <p className="text-xs text-ink-soft">{hint}</p>
    </div>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
      <header><h1 className="text-3xl">Configurações da loja</h1><p className="text-sm text-ink-soft">Estas informações aparecem para todos os visitantes do site.</p></header>
      {error && <Alert tone="error">{error}</Alert>}
      {status === 'error' && <Alert tone="warning">Não foi possível carregar as configurações atuais. Ao salvar, os valores abaixo substituirão os salvos.</Alert>}

      <section className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6">
        <h2 className="text-2xl">Marca</h2>
        <Field label="Nome comercial" required error={errors.store_name?.message}><input className={inputClass} {...register('store_name')} /></Field>
        <div className="grid gap-6 sm:grid-cols-2">
          {imageField('Logo', logo, setLogo, 'Quadrada, a partir de 300 px. Sem logo enviado, o site usa a imagem do perfil do Instagram (baixa resolução).', true)}
          {imageField('Imagem do banner (opcional)', hero, setHero, 'Foto vertical ou quadrada de uma peça. Sem imagem, o banner usa só a textura de tricô.')}
        </div>
        <Field label="Chamada principal" error={errors.hero_title?.message} hint={`Padrão: ${DEFAULT_HERO_TITLE}`}><input className={inputClass} {...register('hero_title')} /></Field>
        <Field label="Subtítulo" error={errors.hero_subtitle?.message} hint={`Padrão: ${DEFAULT_HERO_SUBTITLE}`}><input className={inputClass} {...register('hero_subtitle')} /></Field>
        <Field label="Texto institucional (Sobre a loja)" error={errors.about_text?.message}><textarea rows={4} className={inputClass} {...register('about_text')} /></Field>
      </section>

      <section className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6">
        <h2 className="text-2xl">Contato</h2>
        <Field label="WhatsApp oficial da loja" error={errors.whatsapp_number?.message} hint="Com DDD. É para este número que os pedidos serão enviados.">
          <input inputMode="tel" placeholder="(81) 99999-9999" className={inputClass} {...register('whatsapp_number')} />
        </Field>
        {waState === null && <Alert tone="warning">Sem o número, os clientes não conseguem abrir a conversa com o pedido (só copiar o texto).</Alert>}
        {waState?.ok && <Alert tone="success">Os pedidos serão enviados para <strong>{formatWhatsApp(waState.value)}</strong>. Confira se é o número certo antes de salvar.</Alert>}
        <Field label="Link do Instagram" error={errors.instagram_url?.message}><input type="url" placeholder="https://www.instagram.com/..." className={inputClass} {...register('instagram_url')} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Cidade" error={errors.city?.message}><input className={inputClass} {...register('city')} /></Field>
          <Field label="Localização / endereço" error={errors.location_text?.message}><input className={inputClass} {...register('location_text')} /></Field>
        </div>
        <Field label="E-mail de contato" error={errors.contact_email?.message}><input type="email" className={inputClass} {...register('contact_email')} /></Field>
        <Field label="Outras informações de contato" error={errors.contact_info?.message} hint="Ex.: horário de atendimento."><textarea rows={2} className={inputClass} {...register('contact_info')} /></Field>
      </section>

      <section className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6">
        <h2 className="text-2xl">Recebimento e mensagem do pedido</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-brand" {...register('delivery_enabled')} /> Oferecemos entrega</label>
            <Field label="Informações sobre entrega" error={errors.delivery_info?.message}><textarea rows={3} className={inputClass} placeholder="Ex.: Entrega local e envios para todo o Brasil." {...register('delivery_info')} /></Field>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-brand" {...register('pickup_enabled')} /> Oferecemos retirada na loja</label>
            <Field label="Informações sobre retirada" error={errors.pickup_info?.message}><textarea rows={3} className={inputClass} {...register('pickup_info')} /></Field>
          </div>
        </div>
        <Field label="Abertura da mensagem" error={errors.order_greeting?.message} hint="Padrão: “Olá, [loja]! Gostaria de fazer um pedido.”"><input className={inputClass} {...register('order_greeting')} /></Field>
        <Field label="Fechamento da mensagem" error={errors.order_closing?.message} hint={`Padrão: ${DEFAULT_CLOSING.replace(/\n+/g, ' ')}`}><textarea rows={3} className={inputClass} {...register('order_closing')} /></Field>
      </section>

      <div className="flex gap-3"><Button type="submit" size="lg" loading={saving}>Salvar configurações</Button></div>
    </form>
  )
}
