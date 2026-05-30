import { Routes, Route, Navigate } from 'react-router-dom'
import MaterialList from './pages/MaterialList'
import ImportMaterial from './pages/ImportMaterial'
import SentenceEditor from './pages/SentenceEditor'

function App() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <Routes>
        <Route path="/" element={<MaterialList />} />
        <Route path="/import" element={<ImportMaterial />} />
        <Route path="/edit/:materialId" element={<SentenceEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App