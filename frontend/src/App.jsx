import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout.jsx'
import Upload from './pages/Upload.jsx'
import Result from './pages/Result.jsx'
import Download from './pages/Download.jsx'
import Privacy from './pages/Privacy.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/"           element={<Upload />} />
            <Route path="/result"     element={<Result />} />
            <Route path="/f/:id"      element={<Download />} />
            <Route path="/privacy"    element={<Privacy />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </BrowserRouter>
  )
}
