import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { CartProvider } from './context/CartContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import StoreLayout from './components/layout/StoreLayout'
import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import NotFoundPage from './pages/NotFoundPage'
import { Spinner } from './components/ui/Feedback'

// O painel é carregado sob demanda: visitantes da loja não baixam esse código.
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const RequireAdmin = lazy(() => import('./components/admin/RequireAdmin'))
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'))
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const ResetPasswordPage = lazy(() => import('./pages/admin/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'))
const ProductFormPage = lazy(() => import('./pages/admin/ProductFormPage'))
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'))

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function AdminRoot() {
  return (
    <AuthProvider>
      <Suspense fallback={<Spinner label="Carregando painel" className="min-h-screen" />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsProvider>
        <CartProvider>
          <ToastProvider>
            <ScrollToTop />
            <Routes>
              <Route element={<StoreLayout />}>
                <Route index element={<HomePage />} />
                <Route path="catalogo" element={<CatalogPage />} />
                <Route path="produto/:slug" element={<ProductPage />} />
                <Route path="sacola" element={<CartPage />} />
                <Route path="finalizar" element={<Suspense fallback={<Spinner />}><CheckoutPage /></Suspense>} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              <Route path="admin" element={<AdminRoot />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="redefinir-senha" element={<ResetPasswordPage />} />
                <Route element={<RequireAdmin />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="produtos" element={<AdminProductsPage />} />
                    <Route path="produtos/novo" element={<ProductFormPage />} />
                    <Route path="produtos/:id" element={<ProductFormPage />} />
                    <Route path="categorias" element={<AdminCategoriesPage />} />
                    <Route path="configuracoes" element={<AdminSettingsPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </CartProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
