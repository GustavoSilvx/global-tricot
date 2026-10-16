import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SettingsProvider } from '../context/SettingsContext'
import { CartProvider } from '../context/CartContext'
import { ToastProvider } from '../context/ToastContext'
import type { StoreSettings } from '../types/db'

export const baseSettings: StoreSettings = {
  id: 1, store_name: 'Global Tricot', logo_path: null, hero_image_path: null, hero_title: null, hero_subtitle: null,
  about_text: null, whatsapp_number: '5581999999999', instagram_url: 'https://www.instagram.com/globaltrico/', city: 'Toritama - PE',
  location_text: null, contact_email: null, contact_info: null, delivery_enabled: true, pickup_enabled: true,
  delivery_info: null, pickup_info: null, order_greeting: null, order_closing: null, updated_at: '2026-01-01T00:00:00Z',
}

/** Renderiza uma página dentro de roteador + configurações + carrinho + avisos. */
export function renderPage(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider>
        <CartProvider>
          <ToastProvider>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<p>outra rota</p>} />
            </Routes>
          </ToastProvider>
        </CartProvider>
      </SettingsProvider>
    </MemoryRouter>,
  )
}
