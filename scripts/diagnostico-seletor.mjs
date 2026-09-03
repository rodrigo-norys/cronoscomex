import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * Isola, camada por camada, por que o seletor de arquivos de `H-37` nao abriu.
 *
 * Existe porque o unico ambiente onde o dialogo roda de verdade — Windows com
 * sessao grafica — e o unico que nenhum teste alcanca (`PD-06`, item 10). Na
 * primeira maquina Windows o sintoma foi o cursor girando sem janela nenhuma, e
 * um sintoma so nao distingue quatro causas: PowerShell ausente, WinForms
 * indisponivel, dialogo abrindo atras de tudo, ou processo preso.
 *
 * Cada passo abaixo falha sozinho e diz qual e a proxima pergunta. Rode NA
 * MAQUINA WINDOWS, a partir da pasta do projeto:
 *
 *     node scripts\diagnostico-seletor.mjs
 *
 * Nao toca a planilha, nao grava configuracao e nao usa a aplicacao: chama o
 * PowerShell direto, do mesmo jeito que `src/app/file-dialog.ts` chama.
 */

const PASSOS = []

function passo(nome, detalhe) {
  PASSOS.push({ nome, detalhe })
  console.log(`\n[${PASSOS.length}] ${nome}`)
  if (detalhe) console.log(`    ${detalhe}`)
}

function ok(mensagem) {
  console.log(`    OK: ${mensagem}`)
}

function falhou(mensagem) {
  console.log(`    FALHOU: ${mensagem}`)
}

async function powershell(script, timeout, opcoes = {}) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const inicio = Date.now()
  try {
    const { stdout, stderr } = await run(
      'powershell.exe',
      ['-NoProfile', '-STA', '-EncodedCommand', encoded],
      { timeout, ...opcoes },
    )
    return { ms: Date.now() - inicio, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (cause) {
    return { ms: Date.now() - inicio, erro: cause }
  }
}

console.log('=== diagnostico do seletor de arquivos (H-37) ===')
console.log(`plataforma: ${process.platform} ${process.arch}`)
console.log(`node:       ${process.version}`)

if (process.platform !== 'win32') {
  console.log('\nEste diagnostico so tem sentido em Windows. Nada a fazer aqui.')
  process.exit(0)
}

passo('powershell.exe responde?', 'se falhar aqui, o seletor nunca poderia funcionar')
const eco = await powershell('[Console]::Out.Write("vivo")', 15_000)
if (eco.erro) {
  falhou(`${eco.erro.code ?? ''} ${eco.erro.message}`)
  console.log('\n>>> O PowerShell nao respondeu. O resto do diagnostico nao se aplica.')
  process.exit(1)
}
ok(`respondeu "${eco.stdout}" em ${eco.ms} ms`)

passo('System.Windows.Forms carrega?', 'e a biblioteca que desenha o dialogo')
const forms = await powershell(
  'Add-Type -AssemblyName System.Windows.Forms; [Console]::Out.Write("carregou")',
  30_000,
)
if (forms.erro) {
  falhou(`${forms.erro.message}\n${forms.erro.stderr ?? ''}`)
  console.log('\n>>> Sem WinForms nao ha dialogo. Me mande esta saida.')
  process.exit(1)
}
ok(`carregou em ${forms.ms} ms`)

passo('a sessao tem area de trabalho?', 'processo sem estacao grafica nunca mostra janela')
// O `Add-Type` e obrigatorio AQUI tambem: cada chamada de `powershell()` e um
// processo novo, entao o carregamento do passo 2 nao atravessa. Sem ele o passo
// reprovava com `TypeNotFound` — um falso negativo que dizia "sem area de
// trabalho" quando a causa era o proprio diagnostico. Medido em 31/08/2026, na
// maquina do operador: e justamente este passo que separa "nao tem desktop" de
// "tem desktop e o dialogo falha", e quebrado ele tirava do diagnostico o poder
// de isolar.
const desktop = await powershell(
  `
Add-Type -AssemblyName System.Windows.Forms
[Console]::Out.Write([System.Windows.Forms.SystemInformation]::UserInteractive)
`,
  15_000,
)
// TRES estados, e nao dois: `False` e a resposta que significa "nao ha area de
// trabalho", e ate 02/09/2026 ela era rotulada OK — o unico passo capaz de
// separar "nao tem desktop" de "tem desktop e o dialogo falha" aprovava a
// resposta ruim. Fundir o ramo de erro com o `False` reintroduziria o falso
// negativo curado em 31/08/2026, quando TypeNotFound dizia "sem area de
// trabalho" com a causa sendo o proprio diagnostico.
let temDesktop = null
if (desktop.erro) {
  falhou(`nao deu para medir: ${desktop.erro.message}`)
  console.log('>>> Estado desconhecido. O passo 4 ainda vale, mas leia o resultado dele com ressalva.')
} else if (desktop.stdout === 'True') {
  temDesktop = true
  ok('UserInteractive = True')
} else {
  temDesktop = false
  falhou(`UserInteractive = ${desktop.stdout} — esta sessao nao tem area de trabalho`)
  console.log('>>> Proxima pergunta: voce esta rodando por SSH? SSH cai na Sessao 0, que nao tem desktop por design.')
  console.log('>>> Rode da sessao grafica do console, ou alcance-a por `schtasks /ru <usuario> /it`.')
}

passo(
  'o dialogo abre?  <<< OLHE A TELA AGORA',
  'uma janela de escolher arquivo deve aparecer. Escolha um .xlsx OU cancele.',
)
console.log('    (o limite e de 60 segundos)')
const dialogo = await powershell(
  `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$owner = New-Object System.Windows.Forms.Form
$owner.FormBorderStyle = 'None'
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Opacity = 0
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.Show()
$owner.Activate()
[System.Windows.Forms.Application]::DoEvents()
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Escolha a planilha do painel'
$dialog.Filter = 'Planilha do Excel (*.xlsx)|*.xlsx'
try {
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($dialog.FileName)))
  }
} finally { $owner.Close(); $owner.Dispose() }
`,
  60_000,
)

if (dialogo.erro) {
  const morto = dialogo.erro.killed === true
  falhou(
    morto
      ? `nada aconteceu em ${Math.round(dialogo.ms / 1000)} s e o processo foi encerrado`
      : `${dialogo.erro.message}\n${dialogo.erro.stderr ?? ''}`,
  )
  console.log(
    morto
      ? '\n>>> Se NENHUMA janela apareceu: o dialogo nao chega ao primeiro plano.\n' +
          '>>> Se ela apareceu e voce nao mexeu: e so o limite de tempo, e esta tudo bem.'
      : '\n>>> Me mande esta saida.',
  )
  if (temDesktop === false) {
    console.log('>>> Era esperado: o passo 3 ja disse que esta sessao nao tem area de trabalho.')
    console.log('>>> Isto NAO e defeito de H-37.')
  }
  process.exit(1)
}

if (dialogo.stdout === '') {
  ok(`cancelado pelo operador, em ${Math.round(dialogo.ms / 1000)} s — o caminho normal de cancelar`)
} else {
  const caminho = Buffer.from(dialogo.stdout, 'base64').toString('utf8')
  ok(`escolhido em ${Math.round(dialogo.ms / 1000)} s`)
  console.log(`    caminho: ${caminho}`)

  // A conferencia anterior era `caminho === Buffer.from(caminho,'utf8').toString('utf8')`,
  // que e a identidade para toda string JS — imprimia `true` inclusive sobre
  // caminho ja corrompido, e era a unica ferramenta que responderia ao item
  // "caminho com espacos e acentos" de PD-06. As tres abaixo respondem de fato,
  // e sao independentes: a primeira e a mesma de `src/app/file-dialog.ts`, e
  // pega lixo decodificado de base64 invalido; a segunda mostra ao operador
  // quais nao-ASCII chegaram; a terceira e a unica prova de ponta a ponta —
  // acento mangled em qualquer camada produz base64 valido de bytes errados,
  // passa na primeira, e so falha ao tocar o sistema de arquivos.
  console.log(`    base64 fecha: ${Buffer.from(caminho, 'utf8').toString('base64') === dialogo.stdout}`)

  const naoAscii = [...caminho].filter((c) => c.codePointAt(0) > 0x7f)
  const espacos = [...caminho].filter((c) => c === ' ').length
  console.log(
    `    nao-ASCII: ${
      naoAscii.length === 0
        ? 'nenhum'
        : naoAscii.map((c) => `${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
    } · espacos: ${espacos}`,
  )
  console.log(`    o caminho existe em disco: ${existsSync(caminho)}`)
}

console.log('\n=== fim ===')
