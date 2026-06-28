import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Games from './pages/Games'
import Ranking from './pages/Ranking'
import Login from './pages/Login'
import Play from './pages/Play'
import Overlay from './pages/Overlay'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/play" element={<Play />} />
      <Route path="/overlay/:token" element={<Overlay />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="games" element={<Games />} />
        <Route path="ranking" element={<Ranking />} />
      </Route>
    </Routes>
  )
}
