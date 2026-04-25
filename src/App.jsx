import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CardapioEditor = lazy(() => import('./pages/CardapioEditor'))
const PromocoesEditor = lazy(() => import('./pages/PromocoesEditor'))
const VeiculosEditor = lazy(() => import('./pages/VeiculosEditor'))
const RoupasEditor = lazy(() => import('./pages/RoupasEditor'))
const BusinessInfoEditor = lazy(() => import('./pages/BusinessInfoEditor'))
const AdminRestaurantes = lazy(() => import('./pages/AdminRestaurantes'))
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const GestaoClientesPage = lazy(() => import('./pages/GestaoClientesPage'))
const RelatorioSEOPage = lazy(() => import('./pages/RelatorioSEOPage'))

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/restaurante/:slug/cardapio" element={<CardapioEditor />} />
            <Route path="/restaurante/:slug/promocoes" element={<PromocoesEditor />} />
            <Route path="/restaurante/:slug/veiculos" element={<VeiculosEditor />} />
            <Route path="/restaurante/:slug/roupas" element={<RoupasEditor />} />
            <Route path="/restaurante/:slug/info" element={<BusinessInfoEditor />} />
            <Route path="/admin/restaurantes" element={<ProtectedRoute adminOnly><AdminRestaurantes /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute adminOnly><AdminUsuarios /></ProtectedRoute>} />
            <Route path="/admin/gestao" element={<ProtectedRoute adminOnly><GestaoClientesPage /></ProtectedRoute>} />
            <Route path="/admin/relatorio-seo/:slug" element={<ProtectedRoute adminOnly><RelatorioSEOPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
