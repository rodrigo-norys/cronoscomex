import { describe, expect, it, vi } from 'vitest'
import {
  FileDialogFailedError,
  FileDialogUnavailableError,
  openWorkbookDialog,
} from '../../src/app/file-dialog.ts'

/**
 * H-37. O dialogo em si nao e exercido aqui — ele exige Windows com sessao
 * grafica, e e o unico trecho que nenhum teste alcanca (`PD-06`, item 10).
 * O que estes casos cobrem e tudo o que fica ao redor dele: o que volta, o que
 * nao volta, e o que acontece quando a maquina nao tem como abrir a janela.
 *
 * O caminho viaja em base64 de UTF-8 de proposito: o console do Windows do
 * operador esta em code page 850, e o caminho do OneDrive corporativo tem
 * acento por natureza.
 */

/** O que o script do PowerShell escreveria no stdout para este caminho. */
function comoBase64(caminho: string): string {
  return Buffer.from(caminho, 'utf8').toString('base64')
}

describe('openWorkbookDialog', () => {
  it('devolve o caminho que o seletor escreveu', async () => {
    const escolhido = 'C:\\Users\\ana\\planilha.xlsx'

    const path = await openWorkbookDialog(() => Promise.resolve(comoBase64(escolhido)))

    expect(path).toBe(escolhido)
  })

  /**
   * O acento e os tres espacos sao o caso real: o caminho do OneDrive
   * corporativo do operador. Sem o transporte em bytes, a code page do console
   * comeria o acento e a aplicacao apontaria para um arquivo que nao existe.
   */
  it('preserva acento e espaco do caminho do OneDrive corporativo', async () => {
    const escolhido = 'C:\\Users\\ana\\OneDrive - Comércio Exterior\\CONTROLE DOS EMBARQUE.xlsx'

    const path = await openWorkbookDialog(() => Promise.resolve(comoBase64(escolhido)))

    expect(path).toBe(escolhido)
    expect(path).toContain('OneDrive - Comércio Exterior')
  })

  /** Cancelar e uma escolha, e nao uma falha: o script nao escreve nada. */
  it('devolve null quando o operador cancela, sem lancar', async () => {
    expect(await openWorkbookDialog(() => Promise.resolve(''))).toBeNull()
  })

  /** O console acrescenta quebra de linha; ela e ruido do transporte. */
  it('trata so-espaco no stdout como cancelamento', async () => {
    expect(await openWorkbookDialog(() => Promise.resolve('  \r\n'))).toBeNull()
  })

  it('recusa como indisponivel quando o powershell nao esta no PATH', async () => {
    const ausente = Object.assign(new Error('spawn powershell.exe ENOENT'), { code: 'ENOENT' })

    await expect(openWorkbookDialog(() => Promise.reject(ausente))).rejects.toBeInstanceOf(
      FileDialogUnavailableError,
    )
  })

  it('preserva a indisponibilidade que o invocador ja declarou', async () => {
    const recusa = new FileDialogUnavailableError('Esta maquina nao abre o seletor de arquivos.')

    await expect(openWorkbookDialog(() => Promise.reject(recusa))).rejects.toBe(recusa)
  })

  it('distingue falha do dialogo de indisponibilidade da maquina', async () => {
    const morreu = Object.assign(new Error('Command failed'), { code: 1 })

    await expect(openWorkbookDialog(() => Promise.reject(morreu))).rejects.toBeInstanceOf(
      FileDialogFailedError,
    )
  })

  /**
   * `Buffer.from(…, 'base64')` NAO rejeita entrada invalida — ela decodifica
   * lixo em silencio. Sem a conferencia de ida e volta, um `powershell.exe` que
   * escrevesse um aviso no stdout viraria um caminho inventado, que e
   * exatamente o que a regra inviolavel 3 proibe.
   */
  it('recusa saida que nao e base64, em vez de decodificar lixo', async () => {
    await expect(
      openWorkbookDialog(() => Promise.resolve('AVISO: modulo carregado de forma insegura')),
    ).rejects.toBeInstanceOf(FileDialogFailedError)
  })

  /**
   * Dois cliques no botao abririam dois dialogos empilhados: o operador fecharia
   * um e o segundo apareceria do nada, parecendo que o painel abriu a janela
   * sozinho.
   */
  it('coalesce cliques simultaneos num unico dialogo', async () => {
    let liberar: (value: string) => void = () => {}
    const runner = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          liberar = resolve
        }),
    )

    const primeiro = openWorkbookDialog(runner)
    const segundo = openWorkbookDialog(runner)
    liberar(comoBase64('C:\\planilha.xlsx'))

    expect(await primeiro).toBe('C:\\planilha.xlsx')
    expect(await segundo).toBe('C:\\planilha.xlsx')
    expect(runner).toHaveBeenCalledTimes(1)
  })

  /** O coalescing nao pode virar trava: fechado um dialogo, o proximo abre. */
  it('libera a proxima abertura depois de o dialogo fechar', async () => {
    const runner = vi.fn(() => Promise.resolve(comoBase64('C:\\planilha.xlsx')))

    await openWorkbookDialog(runner)
    await openWorkbookDialog(runner)

    expect(runner).toHaveBeenCalledTimes(2)
  })

  it('libera a proxima abertura mesmo depois de uma falha', async () => {
    const quebrado = vi.fn(() => Promise.reject(new Error('Command failed')))
    await expect(openWorkbookDialog(quebrado)).rejects.toBeInstanceOf(FileDialogFailedError)

    const bom = vi.fn(() => Promise.resolve(comoBase64('C:\\planilha.xlsx')))
    expect(await openWorkbookDialog(bom)).toBe('C:\\planilha.xlsx')
  })
})
