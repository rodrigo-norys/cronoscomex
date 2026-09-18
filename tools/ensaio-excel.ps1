# Muta uma COPIA da planilha pelo Excel de verdade, na sessao grafica do Windows.
#
# Existe porque o item 1 do ?4 de docs/ensaio-planilha/corpus-ensaio.md declara
# que o caminho "Excel altera -> zip -> sharedStrings -> reader -> sheet-schema"
# nunca rodou: as nove fixtures testam divergencia a partir de arrays sinteticos
# de cabecalho. Mutar o XML por script reproduziria o mesmo vies -- so o Excel
# real reescreve styles.xml, sharedStrings.xml e a Tabela1 a maneira dele.
#
# **Roda por schtasks /it, nunca por SSH direto.** Da Sessao 0 o COM do Excel
# falha em tudo, inclusive no SaveAs de uma pasta que ele mesmo criou, e a rule
# .claude/rules/operacao-windows.md registra o caso em que isso quase condenou
# codigo que estava correto. O gesto `controle` e justamente esse anteparo: se o
# Excel falha ao criar e reabrir arquivo PROPRIO, o defeito e do ambiente.
#
# Entrada: gesto.json ao lado deste arquivo. Saida: resultado.txt, uma linha
# chave=valor. ASCII puro: o PS 5.1 le UTF-8 sem BOM como ANSI, e um travessao
# dentro de string ja quebrou o parser de um script inteiro.
#
# Regra inviolavel 10: so a aba em escopo e tocada; as outras tres nao sao
# abertas, lidas nem nomeadas. Regra inviolavel 8: nenhum valor de celula de
# dado vai para o log -- so o cabecalho, que e estrutura.
$ErrorActionPreference = 'Stop'
$base  = $PSScriptRoot
$saida = Join-Path $base 'resultado.txt'
Set-Content -Path $saida -Value "inicio=$(Get-Date -Format o)" -Encoding ASCII
function Log($m) { Add-Content -Path $saida -Value $m -Encoding ASCII }

$xl = $null
$wb = $null
try {
  $g = Get-Content (Join-Path $base 'gesto.json') -Raw | ConvertFrom-Json
  Log "gesto=$($g.gesto)"
  Log "sessao=$([System.Diagnostics.Process]::GetCurrentProcess().SessionId)"
  Log "interativo=$([Environment]::UserInteractive)"

  $xl = New-Object -ComObject Excel.Application
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  Log "excel_versao=$($xl.Version)"

  if ($g.gesto -eq 'controle') {
    $alvo = Join-Path $base 'controle.xlsx'
    if (Test-Path $alvo) { Remove-Item $alvo -Force }
    $novo = $xl.Workbooks.Add()
    $novo.Worksheets.Item(1).Range('A1').Value2 = 'controle'
    $novo.SaveAs($alvo, 51)
    $novo.Close($false)
    $re = $xl.Workbooks.Open($alvo)
    Log "controle_saved_apos_open=$($re.Saved)"
    Log "controle_valor=$($re.Worksheets.Item(1).Range('A1').Value2)"
    $re.Close($false)
    Log "ok=1"
  }
  else {
    $wb = $xl.Workbooks.Open($g.arquivo)
    # Reparar e modificar em memoria: a pasta abre SUJA. Saved=True logo apos o
    # Open significa que o Excel carregou o arquivo sem alterar um byte, e e o
    # sinal que substitui o banner amarelo, inexistente em execucao headless.
    Log "saved_apos_open=$($wb.Saved)"
    Log "abas=$($wb.Worksheets.Count)"

    $ws = $wb.Worksheets.Item($g.aba)
    Log "aba_alvo=$($ws.Name)"
    Log "ultima_linha=$($ws.UsedRange.Rows.Count)"
    Log "ultima_coluna=$($ws.UsedRange.Columns.Count)"
    Log "tabelas=$($ws.ListObjects.Count)"
    if ($ws.ListObjects.Count -gt 0) {
      Log "tabela1_nome=$($ws.ListObjects.Item(1).Name)"
      Log "tabela1_ref=$($ws.ListObjects.Item(1).Range.Address($false,$false))"
    }

    switch ($g.gesto) {
      'inserir-coluna'     { $ws.Columns.Item([int]$g.coluna).Insert(-4161) | Out-Null; Log "inseriu_em=$($g.coluna)" }
      'apagar-coluna'      { $ws.Columns.Item([int]$g.coluna).Delete() | Out-Null; Log "apagou_coluna=$($g.coluna)" }
      'inserir-linha'      { $ws.Rows.Item([int]$g.linha).Insert(-4121) | Out-Null; Log "inseriu_linha=$($g.linha)" }
      'apagar-linha'       { $ws.Rows.Item([int]$g.linha).Delete() | Out-Null; Log "apagou_linha=$($g.linha)" }
      'renomear-cabecalho' {
        Log "cabecalho_antes=$($ws.Cells.Item(1, [int]$g.coluna).Value2)"
        $ws.Cells.Item(1, [int]$g.coluna).Value2 = $g.texto
        Log "cabecalho_depois=$($g.texto)"
      }
      'limpar-cabecalho' {
        Log "cabecalho_antes=$($ws.Cells.Item(1, [int]$g.coluna).Value2)"
        $ws.Cells.Item(1, [int]$g.coluna).ClearContents() | Out-Null
      }
      'mover-coluna' {
        # Cortar e inserir e o gesto do operador que ARRASTA a coluna, e produz
        # XML diferente de apagar-e-inserir feitos em separado.
        $ws.Columns.Item([int]$g.coluna).Cut() | Out-Null
        $ws.Columns.Item([int]$g.destino).Insert(-4161) | Out-Null
        Log "moveu=$($g.coluna)->$($g.destino)"
      }
      'editar-celula' {
        $ws.Cells.Item([int]$g.linha, [int]$g.coluna).Value2 = $g.texto
        Log "editou=L$($g.linha)C$($g.coluna)"
      }
      'renomear-aba'  { $ws.Name = $g.texto; Log "aba_nova=$($g.texto)" }
      'criar-aba' {
        # Depois da ultima aba, e nao antes: a posicao muda a ordem em
        # xl/workbook.xml, e o risco R-14 e sobre a aba do ANO seguinte, que o
        # operador acrescenta no fim.
        $nova = $wb.Worksheets.Add([System.Reflection.Missing]::Value, $wb.Worksheets.Item($wb.Worksheets.Count))
        $nova.Name = $g.texto
        $nova.Cells.Item(1, 1).Value2 = 'REF'
        Log "aba_criada=$($g.texto)"
        Log "abas_depois=$($wb.Worksheets.Count)"
      }
      'pintar-celula' {
        # Pinta A..L da linha com uma cor arbitraria, que e como o operador
        # marca uma linha inteira. `texto` e o RGB em hexadecimal; o COM do Excel
        # espera BGR decimal, e inverter os pares aqui evita que quem chama
        # precise saber disso.
        $rgb = $g.texto
        $r = [Convert]::ToInt32($rgb.Substring(0,2),16)
        $vd = [Convert]::ToInt32($rgb.Substring(2,2),16)
        $b = [Convert]::ToInt32($rgb.Substring(4,2),16)
        $faixa = $ws.Range($ws.Cells.Item([int]$g.linha,1), $ws.Cells.Item([int]$g.linha,12))
        $faixa.Interior.Color = $r + ($vd * 256) + ($b * 65536)
        Log "pintou=L$($g.linha) rgb=$rgb"
      }
      'mover-linha' {
        # Recortar e inserir e como o operador REORDENA: a relacao do ?5 diz que
        # o conjunto de processos nao muda, so o `sourceRow`.
        $ws.Rows.Item([int]$g.linha).Cut() | Out-Null
        $ws.Rows.Item([int]$g.destino).Insert(-4121) | Out-Null
        Log "moveu_linha=$($g.linha)->$($g.destino)"
      }
      'salvar-com-senha' {
        # O unico jeito de obter um .xlsx CIFRADO de verdade: o Excel o grava
        # como container OLE2, e nenhuma fixture do repositorio tem essa forma.
        $destino = $g.texto
        if (Test-Path $destino) { Remove-Item $destino -Force }
        $wb.SaveAs($destino, 51, 'ensaio')
        Log "gravou_com_senha=$destino"
      }
      'abrir-apenas'  { Log "nenhuma_mutacao=1" }
      'segurar' {
        # Abre e SEGURA por N segundos, para que outra conexao exerca a escrita
        # com o arquivo travado. E o unico jeito de alcancar 409 EXCEL_ABERTO e
        # de observar o lock ~$ de P-15 com o Excel de verdade.
        Log "segurando=1"
        Log "lock_esperado=$(Split-Path $g.arquivo -Parent)\~`$$(Split-Path $g.arquivo -Leaf)"
        Start-Sleep -Seconds ([int]$g.segundos)
        Log "soltou=1"
      }
      'salvar-apenas' { Log "so_salva=1" }
      default         { throw "gesto desconhecido: $($g.gesto)" }
    }

    if ($g.gesto -ne 'abrir-apenas') {
      $wb.Save()
      Log "salvou=1"
    }
    $cab = @()
    for ($c = 1; $c -le 20; $c++) { $cab += [string]$ws.Cells.Item(1, $c).Value2 }
    Log "cabecalho_final=$($cab -join '|')"
    $wb.Close($false)
    $wb = $null
    Log "ok=1"
  }
}
catch {
  Log "erro=$($_.Exception.Message)"
  Log "ok=0"
}
finally {
  if ($wb -ne $null) { try { $wb.Close($false) } catch {} }
  if ($xl -ne $null) { try { $xl.Quit() } catch {} }
  Log "fim=$(Get-Date -Format o)"
}
