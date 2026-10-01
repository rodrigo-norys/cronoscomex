import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, storyId } from '../../tools/abrir-historia.mjs'

/**
 * `tools/abrir-historia.mjs` sobre um repositorio git temporario — regra inviolavel 7.
 *
 * Cada caso fixa um dos defeitos que o shell injetado da skill tinha, medidos em
 * 01/10/2026: o contrato da rota saindo vazio, o caso de `| H-04, H-07 |` perdido
 * para as duas historias, e a matriz da `H-10` trazendo as linhas de `H-100` em diante.
 */

let root: string

function write(path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

const BACKLOG = [
  '## Épico E1 — Um',
  '',
  '### H-04 — Quatro',
  '',
  'Cor.',
  '',
  '### H-10 — Dez',
  '',
  'Serve `GET /api/indicators` e mexe em `src/http/routes/alerts.ts`.',
  'Cria `fooBar` e usa `existingName`.',
  '',
  '### H-101 — Cento e um',
  '',
  'Nada de rota.',
  '',
  '## Épico E2 — Dois',
  '',
  'Abertura do épico, que não é da H-101.',
].join('\n')

const QUALITY = [
  '### 1.3. Cobertura obrigatória por regra',
  '',
  '| Caso-limite | Valor concreto | Resultado esperado | História |',
  '|---|---|---|---|',
  '| caso simples | `1` | `um` | H-10 |',
  '| caso duplo | `"theme:9\\|tint"` | quarentena | H-04, H-10 |',
  '| caso de outra | `2` | `dois` | H-06 |',
  '',
  '## 2. Ingestão',
].join('\n')

const CONTRACTS = [
  '## 1. Rotas',
  '',
  '### `GET /api/indicators`',
  'contrato de indicadores',
  '',
  '### `GET /api/alerts`',
  'contrato de alertas',
  '',
  '### `GET /api/other`',
  'contrato que a H-10 não cita',
].join('\n')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'abrir-historia-'))
  execFileSync('git', ['init', '-q'], { cwd: root })
  write('docs/06-backlog.md', BACKLOG)
  write('docs/08-qualidade-operacao.md', QUALITY)
  write('docs/05-contratos-api.md', CONTRACTS)
  write(
    'docs/09-rastreabilidade.md',
    [
      '| H-10 | linha da dez |',
      '| H-101 | linha da cento e um |',
      'texto que cita H-10 e H-100',
    ].join('\n'),
  )
  write('src/domain/a.ts', 'export const existingName = 1\n')
  execFileSync('git', ['add', '-A'], { cwd: root })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('storyId — o argumento da skill pode ser texto livre', () => {
  it('pega o primeiro H-NN, e nenhum quando falta', () => {
    expect(storyId(['vamos', 'para', 'a', 'H-12'])).toBe('H-12')
    expect(storyId(['H-101'])).toBe('H-101')
    expect(storyId(['sem', 'historia'])).toBeNull()
  })
})

describe('render — as secoes da skill', () => {
  it('a historia vai ate o proximo titulo, sem levar a abertura do epico seguinte', () => {
    expect(render(root, 'historia', ['H-101'])).toBe('### H-101 — Cento e um\n\nNada de rota.')
  })

  it('o caso atribuido a duas historias aparece para as duas', () => {
    expect(render(root, 'casos', ['H-10']).split('\n')).toHaveLength(2)
    expect(render(root, 'casos', ['H-04'])).toContain('caso duplo')
  })

  it('sem caso, diz quantos casos existem e quantas historias eles cobrem', () => {
    expect(render(root, 'casos', ['H-101'])).toContain('os 3 casos cobrem 3 histórias')
    expect(render(root, 'total-casos', [])).toBe('3')
  })

  it('a matriz casa a historia como palavra inteira: H-10 nao traz H-101 nem H-100', () => {
    expect(render(root, 'matriz', ['H-10']).split('\n')).toEqual([
      '| H-10 | linha da dez |',
      'texto que cita H-10 e H-100',
    ])
  })

  it('identificador citado que o codigo nao tem aparece; o que tem, nao', () => {
    expect(render(root, 'identificadores', ['H-10'])).toBe('  fooBar')
  })

  it('o contrato traz as rotas citadas no texto e pelo nome do arquivo, e so elas', () => {
    const contract = render(root, 'contrato', ['H-10'])
    expect(contract).toContain('contrato de indicadores')
    expect(contract).toContain('contrato de alertas')
    expect(contract).not.toContain('contrato que a H-10 não cita')
  })

  it('argumento sem H-NN e historia inexistente dizem o que houve', () => {
    expect(render(root, 'historia', ['sem-id'])).toContain('informe H-NN')
    expect(render(root, 'historia', ['H-999'])).toBe('H-999 não existe em docs/06-backlog.md')
  })
})
