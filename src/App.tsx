import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import MarketDetail from './pages/MarketDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/market/:outcomeId" element={<MarketDetail />} />
    </Routes>
  )
}
