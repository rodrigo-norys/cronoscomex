import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('elemento #root nao encontrado em index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
