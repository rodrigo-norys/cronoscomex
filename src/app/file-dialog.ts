import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * O seletor de arquivos do SISTEMA, aberto pelo servidor.
 *
 * **O navegador nao entrega caminho, e nao ha contorno.** `<input type="file">`
 * devolve o conteudo e o nome, e o `value` vira `C:\fakepath\<nome>`; a File
 * System Access API tambem nao expoe caminho. E isolamento de seguranca do
 * navegador. A aplicacao precisa do caminho no disco porque grava
 * cirurgicamente naquele arquivo do OneDrive — um upload seria uma copia solta,
 * com a escrita voltando para o lugar errado.
 *
 * Quem abre a janela e este processo, que roda na maquina do operador (RNF-29:
 * so loopback). **Ele nao valida nada:** quem diz se o caminho serve e
 * `checkWorkbookPath`, e conferir aqui tambem criaria uma segunda regra que
 * divergiria da primeira no dia em que uma das duas mudasse.
 */

export class FileDialogUnavailableError extends Error {
  override readonly name = 'FileDialogUnavailableError'
}

export class FileDialogFailedError extends Error {
  override readonly name = 'FileDialogFailedError'
}

/**
 * Quem de fato abre a janela, e devolve o caminho em BASE64 de UTF-8 — vazio
 * quando o operador cancelou.
 *
 * Ponto de injecao: o dialogo em si e a unica parte que nenhum teste alcanca,
 * porque exige Windows com sessao grafica. Tudo o mais — cancelamento, recusa,
 * acento, dois cliques — fica testado sobre um invocador de mentira. E a licao
 * de `PD-06` aplicada antes do fato: a aplicacao nunca subiu em Windows desde
 * `H-30` por um defeito num trecho que nenhum teste tocava.
 */
export type DialogRunner = () => Promise<string>

/**
 * O operador escolhendo um arquivo leva segundos; cinco minutos era o tempo de
 * ir tomar um cafe. **Caiu para dois em 19/08/2026**, quando o dialogo nao
 * apareceu na primeira maquina Windows e o unico sinal foi o cursor girando: o
 * limite deixou de ser generosidade com quem escolhe e passou a ser o teto de
 * quanto tempo um defeito pode ficar mudo.
 */
const DIALOG_TIMEOUT_MS = 2 * 60_000

/**
 * O caminho volta em base64, e nao como texto.
 *
 * O console do Windows na maquina do operador esta em code page 850, e o
 * caminho do OneDrive corporativo tem acento e espaco por natureza —
 * `OneDrive - Comércio Exterior`, `Área de Trabalho`. Transportar bytes elimina a code page da conta, em vez de
 * depender de acertar `OutputEncoding` dos dois lados.
 *
 * **O dono do dialogo precisa ser uma janela DE VERDADE.** Um `Form` construido
 * e nunca mostrado nao tem handle nem entrada na barra de tarefas: o dialogo
 * nasce sem pai visivel, atras de tudo e sem como ser alcancado, e o operador ve
 * o cursor girando sem nada na tela — medido na primeira maquina Windows,
 * 19/08/2026. Por isso `Show()` e `Activate()`, com o `Form` de 1 px e opacidade
 * zero: ele existe para o Windows e nao para quem olha.
 */
const WINDOWS_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$owner = New-Object System.Windows.Forms.Form
$owner.Text = 'CronosComex'
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
$dialog.Multiselect = $false
$dialog.RestoreDirectory = $true

try {
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($dialog.FileName)))
  }
} finally {
  $owner.Close()
  $owner.Dispose()
}
`

/**
 * `-EncodedCommand` recebe UTF-16LE em base64, que e a forma canonica de passar
 * script ao PowerShell sem depender de aspas — o script tem `'`, `$` e `\`, e
 * qualquer um deles quebraria em `-Command`.
 *
 * `-STA` e obrigatorio: `OpenFileDialog.ShowDialog()` exige apartment STA, e o
 * PowerShell 7 usa MTA por padrao. `powershell.exe` e o 5.1, presente em todo
 * Windows; `pwsh` pode nao estar instalado.
 */
async function runWindowsDialog(): Promise<string> {
  if (process.platform !== 'win32') {
    throw new FileDialogUnavailableError(
      'Esta maquina nao abre o seletor de arquivos. Digite o caminho da planilha.',
    )
  }

  const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-EncodedCommand', encoded],
    // A opcao windowsHide do Node fica de FORA. Ela cria o processo com
    // CREATE_NO_WINDOW, e um processo sem janela nenhuma tem dificuldade de
    // trazer um dialogo ao primeiro plano — que e exatamente o sintoma medido em
    // 19/08/2026. O console piscando um instante e preco barato por uma janela
    // que aparece.
    { timeout: DIALOG_TIMEOUT_MS },
  )
  return stdout
}

/**
 * Uma janela por vez.
 *
 * Dois cliques no botao devolvem a MESMA promessa, em vez de abrir dois
 * dialogos empilhados — o operador fecharia um e o segundo apareceria do nada,
 * parecendo que o painel abriu a janela sozinho.
 */
let pending: Promise<string | null> | null = null

export async function openWorkbookDialog(
  runner: DialogRunner = runWindowsDialog,
): Promise<string | null> {
  if (pending !== null) return pending

  pending = selectOnce(runner)
  try {
    return await pending
  } finally {
    pending = null
  }
}

async function selectOnce(runner: DialogRunner): Promise<string | null> {
  let raw: string
  try {
    // O `trim` mora aqui, e nao no invocador: a quebra de linha que o console
    // acrescenta e ruido do transporte, e todo invocador deve ser lido igual.
    raw = (await runner()).trim()
  } catch (cause) {
    if (cause instanceof FileDialogUnavailableError) throw cause
    // `powershell.exe` ausente do PATH e indisponibilidade, nao falha: a saida e
    // a mesma de rodar fora do Windows — digitar o caminho.
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileDialogUnavailableError(
        'Esta maquina nao abre o seletor de arquivos. Digite o caminho da planilha.',
      )
    }
    // `execFile` mata o processo ao estourar o limite, e a mensagem crua seria
    // "Command failed" — que nao diz ao operador nem o que houve nem o que fazer.
    if ((cause as { killed?: boolean }).killed === true) {
      throw new FileDialogFailedError(
        'A janela de escolha de arquivo nao respondeu a tempo e foi fechada. ' +
          'Se ela nao apareceu, digite o caminho da planilha no campo.',
      )
    }
    throw new FileDialogFailedError(
      `O seletor de arquivos nao pode ser aberto: ${(cause as Error).message}`,
    )
  }

  // Cancelar e uma escolha, e nao uma falha: o script nao escreve nada.
  if (raw === '') return null

  const decoded = Buffer.from(raw, 'base64').toString('utf8')
  // Ida e volta: `Buffer.from(…, 'base64')` nao rejeita entrada invalida, ela
  // decodifica lixo em silencio. Sem esta conferencia, um `powershell.exe` que
  // escrevesse um aviso no stdout viraria um caminho inventado (regra 3).
  if (decoded === '' || Buffer.from(decoded, 'utf8').toString('base64') !== raw) {
    throw new FileDialogFailedError('O seletor devolveu uma resposta que nao da para interpretar.')
  }
  return decoded
}
