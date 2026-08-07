import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * A porta da API tem UMA fonte: `config/app.json`, a mesma que o servidor le.
 *
 * Antes, `5173` estava escrito aqui e em `DEFAULTS.port` do `config.ts` — e o
 * Vite tambem usa `5173` por padrao. Os tres coincidiam, e a cadeia so
 * funcionava por acidente de ordem: subindo o servidor primeiro, o Vite achava
 * a porta ocupada e deslizava para `5174`. Na ordem inversa, o Vite tomava a
 * `5173`, o servidor morria com `EADDRINUSE`, e o proxy passava a apontar para
 * o proprio Vite — que devolve HTML onde a casca espera JSON. O sintoma seria
 * "Sem contato com o servidor", apontando para a causa errada.
 *
 * `strictPort` fecha a outra metade: porta ocupada agora falha alto, em vez de
 * escolher outra em silencio e deixar o endereco do navegador desatualizado.
 */
const FALLBACK_API_PORT = 5173
const DEV_PORT = 5174

function apiPort(): number {
  // `config/app.json` esta no .gitignore e pode nao existir numa clonagem
  // limpa; o padrao do servidor vale igual, e o `dev` nao deve quebrar por isso.
  const configPath = resolve(import.meta.dirname, '../config/app.json')
  if (!existsSync(configPath)) return FALLBACK_API_PORT

  try {
    const { port } = JSON.parse(readFileSync(configPath, 'utf8')) as { port?: unknown }
    return typeof port === 'number' ? port : FALLBACK_API_PORT
  } catch {
    return FALLBACK_API_PORT
  }
}

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: DEV_PORT,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort()}` },
  },
})
