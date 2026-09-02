#!/usr/bin/env python3
"""Gera tests/fixtures/*.xlsx derivando do arquivo real.

Preserva a riqueza estrutural do arquivo original (tema, estilos, tabela,
comentarios, vmlDrawing, customXml) e reescreve do zero o sharedStrings e o
sheetData, de modo que NENHUM dado real vaze para o repositorio.

A tecnica usada aqui e a mesma da escrita cirurgica do ADR-0004: descompactar,
alterar apenas as entradas necessarias, recompactar preservando o resto.

Uso: python3 tools/build_fixtures.py "CONTROLE DOS EMBARQUE.xlsx" [destino]

O destino padrao e tests/fixtures, e o script reescreve TODAS as fixtures de
uma vez. Como o arquivo real e uma planilha viva, regenerar sobre as versionadas
pode alterar estilos e quebrar testes que hoje passam. Para obter uma fixture
so, gere num diretorio temporario e copie a que interessa.

ATENCAO, medido em 02/09/2026: `formatado.xlsx` versionada NAO e mais o que este
script produz. Ela ganhou a mao uma coluna P `hidden="1"` e a formula `1+1` em
N9 — as duas exigidas por assercoes de tests/io/xlsx-surgeon.test.ts.
Sobrescreve-la com a saida daqui remove as duas em silencio. Compare antes de
copiar; nao copie o que voce nao mudou.
"""
import zipfile, sys, re, os, datetime

SRC = sys.argv[1] if len(sys.argv) > 1 else 'CONTROLE DOS EMBARQUE.xlsx'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'tests/fixtures'
SHEET = 'xl/worksheets/sheet1.xml'   # aba 2026

# styleId por cor, medidos por H-01. Reutilizamos estilos JA existentes no
# arquivo, o que garante que fillId, fonte e borda sejam reais.
ST = {
    'verdeA':   165,  # argb:FF00FF00  fillId 2
    'verdeB':   201,  # argb:FF00FF0D  fillId 12
    'azul':     181,  # argb:FF5B9BD5  fillId 8
    'roxoA':    183,  # argb:FFA74F7B  fillId 27
    'roxoB':    218,  # argb:FFA64D79  fillId 11
    'bege':     215,  # argb:FFFFE599  fillId 9
    'vermelho': 171,  # argb:FFFF0000  fillId 7
    'amarelo':  214,  # argb:FFFFFF00  fillId 10
    'branco':   279,  # theme:0        fillId 13
}
COLS = list('ABCDEFGHIJKLMNOP')

# Mapa coluna -> styleId, extraido de uma linha REAL de cada cor.
# Necessario porque o styleId carrega tambem o formato numerico: aplicar o
# styleId da coluna A (numFmtId=0) numa coluna de data faz o Excel exibir o
# serial cru em vez da data. Ver ADR-0004, "Negativas".
ROW_STYLES = {}


def load_row_styles(src):
    """Para cada cor, o styleId tipico de cada coluna no arquivo real.

    Usa o estilo mais frequente entre as celulas PREENCHIDAS daquela coluna.
    Amostrar uma linha unica nao serve: DOCS ENVIADOS so tem 20,7% de
    preenchimento, e uma linha modelo com a celula vazia traria numFmtId=0,
    fazendo o Excel exibir o serial cru em vez da data.
    """
    import xml.etree.ElementTree as ET
    from collections import Counter, defaultdict
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    root = ET.fromstring(src.read(SHEET))
    wanted = set(ST.values())
    tally = defaultdict(lambda: defaultdict(Counter))

    for row in root.findall('.//m:sheetData/m:row', ns):
        cells = {}
        for c in row.findall('m:c', ns):
            m = re.match(r'([A-Z]+)', c.get('r') or '')
            if m:
                filled = c.find('m:v', ns) is not None or c.find('m:is', ns) is not None
                cells[m.group(1)] = (int(c.get('s') or 0), filled)
        anchor = cells.get('A')
        if not anchor or anchor[0] not in wanted:
            continue
        for col, (sid, filled) in cells.items():
            if filled:
                tally[anchor[0]][col][sid] += 1

    for color_style in wanted:
        cols = tally.get(color_style)
        if not cols:
            raise SystemExit('cor sem linha modelo no arquivo real: %d' % color_style)
        ROW_STYLES[color_style] = {
            col: cnt.most_common(1)[0][0] for col, cnt in cols.items()}
        ROW_STYLES[color_style].setdefault('A', color_style)


EXTRA_XFS = []          # cellXf acrescentados; viram XML em write_fixture


def fill_style_gaps(src):
    """Compoe o styleId faltante para colunas de data, por cor.

    Bege tem 9 linhas e branco tem 1: nenhuma delas preenche RG ou DOCS
    ENVIADOS, entao nao ha estilo tipico a copiar. A composicao aqui e o
    algoritmo de TD-05.1 (H-27): manter fonte, borda e formato numerico da
    coluna, trocando apenas o fillId pelo da cor; reutilizar um cellXf
    existente se houver, e so acrescentar quando nao houver.
    """
    import xml.etree.ElementTree as ET
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sr = ET.fromstring(src.read('xl/styles.xml'))
    xfs = [dict(x.attrib) for x in sr.findall('./m:cellXfs/m:xf', ns)]

    def key(a):
        return tuple(a.get(k, '0') for k in
                     ('numFmtId', 'fontId', 'fillId', 'borderId', 'xfId'))

    index = {key(a): i for i, a in enumerate(xfs)}

    # estilo de referencia de cada coluna de data: o de qualquer cor que a tenha
    ref = {}
    for col in ('I', 'K', 'O'):
        for cols in ROW_STYLES.values():
            sid = cols.get(col)
            if sid is not None and xfs[sid].get('numFmtId', '0') != '0':
                ref[col] = sid
                break

    criados = 0
    for color_style, cols in ROW_STYLES.items():
        fill = xfs[color_style].get('fillId', '0')
        for col in ('I', 'K', 'O'):
            sid = cols.get(col)
            if sid is not None and xfs[sid].get('numFmtId', '0') != '0':
                continue                       # ja tem formato de data
            if col not in ref:
                raise SystemExit('nenhuma cor tem formato de data na coluna %s' % col)
            novo = dict(xfs[ref[col]])
            novo['fillId'] = fill
            novo['applyFill'] = '1'
            k = key(novo)
            if k in index:
                cols[col] = index[k]           # reutiliza
            else:
                xfs.append(novo)
                index[k] = len(xfs) - 1
                EXTRA_XFS.append(novo)
                cols[col] = len(xfs) - 1
                criados += 1
    print('  estilos de data compostos: %d reutilizados, %d acrescentados'
          % (sum(1 for c in ROW_STYLES.values() for x in 'IKO') - criados, criados))


def assert_date_formats(src):
    """Falha alto se as colunas de data nao herdarem um numFmt de data."""
    import xml.etree.ElementTree as ET
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sr = ET.fromstring(src.read('xl/styles.xml'))
    custom = {int(x.get('numFmtId')): x.get('formatCode')
              for x in sr.findall('.//m:numFmts/m:numFmt', ns)}
    xfs = [int(x.get('numFmtId', 0)) for x in sr.findall('./m:cellXfs/m:xf', ns)]
    xfs += [int(a.get('numFmtId', 0)) for a in EXTRA_XFS]   # os compostos
    builtin_date = set(range(14, 23)) | set(range(45, 48))

    def is_date(sid):
        n = xfs[sid] if sid < len(xfs) else 0
        if n in builtin_date:
            return True
        code = custom.get(n)
        return bool(code and re.search(r'[dmy]', re.sub(r'\[[^\]]*\]|"[^"]*"', '', code), re.I))

    problemas = []
    for color, cols in ROW_STYLES.items():
        for col in ('I', 'K', 'O'):          # ETA2, RG, DOCS ENVIADOS
            sid = cols.get(col)
            if sid is None or not is_date(sid):
                problemas.append('cor %d, coluna %s (styleId %s)' % (color, col, sid))
    if problemas:
        raise SystemExit('colunas de data sem formato de data:\n  ' +
                         '\n  '.join(problemas))
    print('  formatos de data conferidos nas colunas I, K e O')
def assert_general_styles(src):
    """Falha alto se o estilo da coluna A de alguma cor tiver formato numerico.

    A fixture data-vazia.xlsx depende de que esse estilo seja mesmo
    numFmtId=0: se herdasse formato de data, o cenario de A-56 sumiria da
    fixture e o teste de H-24 passaria sem exercitar nada.
    """
    import xml.etree.ElementTree as ET
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sr = ET.fromstring(src.read('xl/styles.xml'))
    xfs = [int(x.get('numFmtId', 0)) for x in sr.findall('./m:cellXfs/m:xf', ns)]

    problemas = ['cor %d (styleId %s, numFmtId %d)'
                 % (color, cols.get('A', color), xfs[cols.get('A', color)])
                 for color, cols in ROW_STYLES.items()
                 if xfs[cols.get('A', color)] != 0]
    if problemas:
        raise SystemExit('estilo Geral com formato numerico:\n  ' +
                         '\n  '.join(problemas))
    print('  estilo Geral conferido na coluna A das %d cores' % len(ROW_STYLES))


class AsGeneral:
    """Marca uma celula de coluna de data que deve receber o estilo Geral da
    linha, em vez do estilo de data tipico da coluna.

    E o cenario de A-56: na planilha real, DOCS ENVIADOS nunca preenchida fica
    com numFmtId=0, e gravar um serial ali faz o Excel exibir o numero cru.
    Nenhuma outra fixture reproduz isso — em todas, as colunas de data ja saem
    formatadas —, o que deixaria o criterio de aceite de H-24 sem teste.
    """
    __slots__ = ('value',)

    def __init__(self, value=None):
        self.value = value


HEADERS = ['REF', 'CLT', 'IMPORTADOR', 'BL', 'AGENTE', 'CNTR', 'NAVIO', 'ETA',
           'ETA2', 'MERCADORIA', 'RG', 'STATUS', 'Coluna 13', 'R$ ENVIADO',
           'DOCS ENVIADOS', 'Coluna1']
EPOCH = datetime.date(1899, 12, 30)


def serial(iso):
    y, m, d = map(int, iso.split('-'))
    return (datetime.date(y, m, d) - EPOCH).days


class Strings:
    """sharedStrings construido do zero: so entra o que escrevemos aqui."""
    def __init__(self):
        self.items, self.index = [], {}

    def idx(self, text):
        if text not in self.index:
            self.index[text] = len(self.items)
            self.items.append(text)
        return self.index[text]

    def xml(self):
        def esc(t):
            return (t.replace('&', '&amp;').replace('<', '&lt;')
                     .replace('>', '&gt;'))
        sis = ''.join(
            '<si><t%s>%s</t></si>' % (
                ' xml:space="preserve"' if t != t.strip() else '', esc(t))
            for t in self.items)
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'count="%d" uniqueCount="%d">%s</sst>' % (
                    len(self.items), len(self.items), sis))


def cell(ref, value, style, ss):
    """Monta um no <c>. value: str -> sharedString; int/float -> numerico;
    None -> celula vazia preservando o estilo."""
    s = ' s="%d"' % style if style else ''
    if value is None or value == '':
        return '<c r="%s"%s/>' % (ref, s)
    if isinstance(value, (int, float)):
        return '<c r="%s"%s><v>%s</v></c>' % (ref, s, value)
    return '<c r="%s"%s t="s"><v>%d</v></c>' % (ref, s, ss.idx(value))


def build_sheet_data(rows, ss):
    """rows: lista de (styleId da cor, {coluna: valor}). Linha 1 e o cabecalho.

    O styleId informado identifica a COR; o estilo aplicado a cada celula vem
    do mapa por coluna da linha modelo, para que o formato de data sobreviva.
    """
    out = ['<row r="1" spans="1:16">']
    for i, h in enumerate(HEADERS):
        out.append(cell('%s1' % COLS[i], h, 0, ss))
    out.append('</row>')
    for n, (style, vals) in enumerate(rows, start=2):
        by_col = ROW_STYLES.get(style, {})
        out.append('<row r="%d" spans="1:16">' % n)
        for col in COLS:
            if col in vals:
                value = vals[col]
                if isinstance(value, AsGeneral):
                    sid, value = by_col.get('A', style), value.value
                else:
                    sid = by_col.get(col, style)
                out.append(cell('%s%d' % (col, n), value, sid, ss))
        out.append('</row>')
    return '<sheetData>%s</sheetData>' % ''.join(out)


EMAIL = re.compile(rb'[\w.+-]+@[\w-]+\.[\w.-]+')


def sanitize(name, data):
    """Remove dado real de entradas que preservamos por sua estrutura."""
    if name in ('xl/comments1.xml', 'xl/threadedComments/threadedComment1.xml',
                'xl/persons/person.xml', 'docProps/core.xml', 'xl/workbook.xml',
                'xl/worksheets/_rels/sheet4.xml.rels') or name.startswith('customXml/'):
        data = EMAIL.sub(b'exemplo@exemplo.com', data)
        # Comentario tem DUAS formas, e ate 01/09/2026 so a primeira era coberta:
        # `<t>` e o legado, de xl/comments1.xml, e `<text>` e o encadeado, de
        # xl/threadedComments/. A lista acima ja citava a parte encadeada — o que
        # falhava era a regex, que mirava a tag errada —, e por isso as nove
        # fixtures versionadas carregaram texto real da planilha do operador.
        #
        # **As duas regras toleram atributo**, e essa e a licao do proprio
        # defeito: `<text>` sem tolerancia deixaria passar
        # `<text xml:space="preserve">`, que e o que o produtor emite quando o
        # comentario comeca ou termina com espaco. Regex mais estreita que a tag
        # que ela mira foi exatamente o que vazou.
        #
        # **Sem limiar de tamanho.** O `{4,}` anterior deixava passar comentario
        # de ate tres caracteres — iniciais de pessoa, por exemplo. O que se
        # exige e um caractere que nao seja espaco: assim `<text>` vazio ou so
        # com indentacao NAO casa, e isso importa porque em xl/comments1.xml o
        # `<text>` e um CT_Rst, de conteudo so-elemento (`<text><t>..</t></text>`)
        # — substituir dentro dele produziria conteudo misto invalido.
        COMENTARIO = rb'[^<]*[^<\s][^<]*'
        data = re.sub(rb'(<t(?:\s[^>]*)?>)' + COMENTARIO + rb'(</t>)',
                      rb'\1comentario de teste\2', data)
        data = re.sub(rb'(<text(?:\s[^>]*)?>)' + COMENTARIO + rb'(</text>)',
                      rb'\1comentario de teste\2', data)
        data = re.sub(rb'(displayName=")[^"]*(")', rb'\1Usuario Teste\2', data)
        data = re.sub(rb'(<dc:creator>)[^<]*(</dc:creator>)', rb'\1Teste\2', data)
        data = re.sub(rb'(<cp:lastModifiedBy>)[^<]*(</cp:lastModifiedBy>)', rb'\1Teste\2', data)
        # `x15ac:absPath` guarda a pasta de onde o arquivo foi salvo, e o Excel
        # a emite em xl/workbook.xml. O valor e substituido, e nao removido: ele
        # vive dentro de `mc:AlternateContent`, e mexer na estrutura de uma
        # fixture e o que a regra 9 existe para evitar.
        data = re.sub(rb'(<x15ac:absPath url=")[^"]*(")',
                      lambda m: m.group(1) + rb'C:\Exemplo' + b'\\' + m.group(2), data)
    return data


def write_fixture(path, rows, note):
    src = zipfile.ZipFile(SRC)
    ss = Strings()
    sheet_data = build_sheet_data(rows, ss)
    last = len(rows) + 1

    sheet = src.read(SHEET).decode('utf-8')
    sheet = re.sub(r'<dimension ref="[^"]*"/>',
                   '<dimension ref="A1:P%d"/>' % last, sheet)
    sheet = re.sub(r'<sheetData>.*?</sheetData>', lambda m: sheet_data, sheet, flags=re.S)
    # a tabela do Excel cobre o intervalo; se ficar fora, o Excel reclama
    sheet = re.sub(r'(<tableParts.*?</tableParts>)', '', sheet, flags=re.S)
    # o original guarda a viewport da ultima edicao (topLeftCell E492,
    # activeCell D514). Herdada, a fixture abriria numa area vazia; o painel
    # congelado e preservado de proposito, so a posicao e reposta.
    sheet = re.sub(r'(<pane[^>]*topLeftCell=")[^"]*(")', r'\1E2\2', sheet)
    sheet = re.sub(r'(<selection pane="bottomRight" activeCell=")[^"]*("\s+sqref=")[^"]*(")',
                   r'\1A2\2A2\3', sheet)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as out:
        for item in src.infolist():
            n = item.filename
            if n in ('xl/tables/table1.xml', 'xl/worksheets/_rels/sheet1.xml.rels'):
                continue                                  # tabela removida
            if n == SHEET:
                out.writestr(item, sheet); continue
            if n == 'xl/sharedStrings.xml':
                out.writestr(item, ss.xml()); continue
            if n == 'xl/styles.xml' and EXTRA_XFS:
                d = src.read(n).decode('utf-8')
                novos = ''.join(
                    '<xf %s/>' % ' '.join('%s="%s"' % kv for kv in a.items())
                    for a in EXTRA_XFS)
                antigo = int(re.search(r'<cellXfs count="(\d+)"', d).group(1))
                d = re.sub(r'<cellXfs count="\d+"',
                           '<cellXfs count="%d"' % (antigo + len(EXTRA_XFS)), d)
                d = d.replace('</cellXfs>', novos + '</cellXfs>')
                out.writestr(item, d); continue
            if n in ('xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml',
                     'xl/worksheets/sheet4.xml'):
                d = src.read(n).decode('utf-8')
                d = re.sub(r'<dimension ref="[^"]*"/>', '<dimension ref="A1:A1"/>', d)
                d = re.sub(r'<sheetData>.*?</sheetData>', '<sheetData/>', d, flags=re.S)
                d = re.sub(r'<hyperlinks>.*?</hyperlinks>', '', d, flags=re.S)
                out.writestr(item, d); continue
            if n == '[Content_Types].xml':
                d = src.read(n).decode('utf-8')
                d = d.replace('<Override PartName="/xl/tables/table1.xml" '
                              'ContentType="application/vnd.openxmlformats-officedocument.'
                              'spreadsheetml.table+xml"/>', '')
                out.writestr(item, d); continue
            out.writestr(item, sanitize(n, src.read(n)))
    print('  %-34s %2d linhas  %s' % (os.path.basename(path), len(rows), note))


D = lambda iso: serial(iso)

FIXTURES = {
 'basico.xlsx': ([
   (ST['verdeA'], {'A':'FT001.26','B':'CLIENTE A','C':'IMPORTADORA X','D':'BL0001',
                   'E':'AGENTE UM','F':'CNTR0001','G':'NAVIO ALFA','H':'RIO',
                   'I':D('2026-08-01'),'J':'BAZAR','K':D('2026-08-05'),
                   'L':'DESEMBARAÇADA','M':'BOLETO OK','O':D('2026-07-20')}),
   (ST['branco'], {'A':'FT002.26','B':'CLIENTE B','C':'IMPORTADORA Y','D':'BL0002',
                   'E':'AGENTE DOIS','F':'CNTR0002','G':'NAVIO BETA','H':'SC',
                   'I':D('2026-08-10'),'J':'ESCOVAS','L':'','M':'N/A'}),
   (ST['azul'],   {'A':'FT003.26','B':'CLIENTE C','C':'IMPORTADORA Z','D':'BL0003',
                   'E':'AGENTE UM','F':'CNTR0003','G':'NAVIO ALFA','H':'MULTIRIO',
                   'I':D('2026-08-15'),'J':'TRAVESSEIRO','L':'AG BL ORIGINAL'}),
 ], 'uma linha por categoria de status'),

 'cores.xlsx': ([
   (ST[k], {'A':'FT%03d.26'%i,'B':'CLIENTE %d'%i,'I':D('2026-08-10'),'L':''})
   for i,k in enumerate(['verdeA','verdeB','azul','roxoA','roxoB','bege',
                         'vermelho','amarelo','branco'], start=101)
 ] + [
   # 169 -> fillId 6 -> argb:FFB7E1CD. Cor REAL do arquivo, e fora do mapa: e
   # ela que exercita COR_NAO_MAPEADA desde 02/09/2026. Antes o papel era do
   # estilo 163, que nao tem preenchimento nenhum — e ausencia de cor deixou de
   # ser pendencia quando a aplicacao passou a criar linha em branco.
   (169, {'A':'FT999.26','B':'COR DESCONHECIDA','I':D('2026-08-10'),'L':''}),
   # 163 -> fillId 0 -> patternType="none". A linha como o Excel a cria, e como
   # a insercao a escreve: sem cor, indefinida nos tres campos, sem quarentena.
   (163, {'A':'FT998.26','B':'SEM COR','I':D('2026-08-10'),'L':''}),
 ], 'as 9 chaves reais + 1 cor fora do mapa + 1 linha sem preenchimento'),

 'datas.xlsx': ([
   (ST['verdeA'], {'A':'FT201.26','I':D('2026-08-03'),'K':D('2026-08-03'),
                   'L':'DESEMBARAÇADA','O':D('2026-07-24')}),
   (ST['branco'], {'A':'FT202.26','I':'29/jul','L':''}),
   (ST['branco'], {'A':'FT203.26','I':'29/07/2026','L':''}),
   (ST['branco'], {'A':'FT204.26','I':'29/07','L':''}),
   (ST['branco'], {'A':'FT205.26','I':'','L':''}),
   (ST['branco'], {'A':'FT206.26','I':D('2026-08-18'),'L':''}),
   (ST['branco'], {'A':'FT207.26','I':D('2026-08-19'),'L':''}),
   (ST['verdeA'], {'A':'FT208.26','K':D('2026-07-20'),'O':D('2026-07-30'),
                   'L':'DESEMBARAÇADA'}),
 ], 'data real, texto com ano, texto sem ano, fronteiras de 15 dias'),

 'sujeira.xlsx': ([
   (ST['verdeA'], {'A':'FT301.26','B':'ACME LOG','L':'DESEMBARAÇADA','I':D('2026-08-01')}),
   (ST['verdeA'], {'A':'FT301.26','B':'acme log','L':'DESEMBARAÇADA','I':D('2026-08-02')}),
   (ST['verdeA'], {'A':'ft301.26 ','B':'  ACME LOG  ','L':'DESEMBARÇADA','I':D('2026-08-03')}),
   (ST['branco'], {'A':'','B':'CLIENTE SEM REF','G':'NAVIO GAMA'}),
   (ST['branco'], {}),
   (ST['branco'], {'A':'FT302.26','L':'   '}),
   (ST['branco'], {'A':'FT303.26','L':'DESEMBARAÇADO'}),
   (ST['branco'], {'A':'FT304.26','L':'DESEMBARAÇADA 03/02'}),
   (ST['amarelo'],{'A':'FT305.26','L':'DUIMP: 26BR0001247418-6 - CANAL AMARELO',
                   'K':D('2026-07-31')}),
   (ST['branco'], {'A':'FT306.26','B':'NAVIO ALFA','G':'NAVIO ALFA'}),
   (ST['branco'], {'A':'FT307.26','B':'NAVIO ALFHA','G':'NAVIO ALFHA'}),
 ], 'REF duplicada, REF ausente, linha vazia, variantes de grafia'),

 'so-ref.xlsx': ([
   (ST['branco'], {'A':'FT401.26'}),
   (ST['branco'], {'A':'FT402.26','M':'N/A'}),
   (ST['branco'], {'A':'FT403.26','B':'   ','C':'   '}),
   (ST['branco'], {'A':'FT404.26','L':''}),
 ], 'linha so com REF vs. linha com coluna fora de escopo'),

 'vazio.xlsx': ([], 'apenas o cabecalho, nenhuma linha de dados'),

 'data-vazia.xlsx': ([
   (ST['branco'], {'A':'FT501.26','B':'CLIENTE 501','I':D('2026-08-20'),
                   'L':'','O':AsGeneral()}),
   (ST['bege'],   {'A':'FT502.26','B':'CLIENTE 502','I':D('2026-08-21'),
                   'L':''}),
   (ST['verdeA'], {'A':'FT503.26','B':'CLIENTE 503','I':D('2026-08-22'),
                   'L':'DESEMBARAÇADA','O':D('2026-07-28')}),
   (ST['azul'],   {'A':'FT504.26','B':'CLIENTE 504','I':D('2026-08-23'),
                   'L':'','K':AsGeneral()}),
 ], 'A-56: coluna de data vazia com estilo Geral, e ausente do XML'),

 'formatado.xlsx': ([
   (ST[k], {'A':'FT%03d.26'%i,'B':'CLIENTE %d'%i,'C':'IMPORTADORA %d'%i,
            'D':'BL%04d'%i,'E':'AGENTE %d'%(i%3),'F':'CNTR%04d'%i,
            'G':'NAVIO %d'%(i%2),'H':['RIO','SC','MULTI','MULTIRIO','RO'][i%5],
            'I':D('2026-08-%02d'%((i%27)+1)),'J':'BAZAR','K':D('2026-08-%02d'%((i%27)+1)),
            'L':'DESEMBARAÇADA' if k.startswith('verde') else '',
            'M':'BOLETO OK','N':'OK 23/07','O':D('2026-07-%02d'%((i%27)+1)),
            'P':'' })
   for i,k in enumerate(['verdeA','verdeB','azul','roxoA','roxoB','bege',
                         'vermelho','amarelo','branco'], start=1)
 ], 'preservacao: tema, estilos, comentarios, vmlDrawing, customXml'),
}

# --- Enriquecimento da fixture de preservacao -------------------------------
#
# formatado.xlsx nascia com cores, larguras e as entradas de zip ricas (tema,
# comentarios, customXml), mas SEM os elementos que vivem dentro do XML da
# propria aba: formatacao condicional, validacao de dados, autofiltro, coluna
# oculta e formula. Sao exatamente os que os defeitos do ExcelJS destroem
# (ADR-0004) e, sem eles, o primeiro criterio de aceite de H-24 passava vazio:
# assertaria a preservacao de elementos que nunca estiveram la.
#
# Roda sobre a fixture JA versionada e por isso NAO exige o arquivo real:
#   python3 tools/build_fixtures.py --enriquecer tests/fixtures/formatado.xlsx
#
# O esquema OOXML impoe a ordem dos filhos de <worksheet>: sheetData ->
# autoFilter -> mergeCells -> conditionalFormatting -> dataValidations ->
# pageMargins. Injetar fora de ordem faz o Excel pedir reparo ao abrir.

AUTO_FILTER = '<autoFilter ref="A1:P10"/>'

# dxfId 0 existe: a fixture herda os 18 dxfs do arquivo real.
CONDITIONAL_FORMATTING = (
    '<conditionalFormatting sqref="L2:L10">'
    '<cfRule type="containsText" dxfId="0" priority="1"'
    ' operator="containsText" text="DESEMBARA">'
    '<formula>NOT(ISERROR(SEARCH("DESEMBARA",L2)))</formula>'
    '</cfRule></conditionalFormatting>'
)

DATA_VALIDATIONS = (
    '<dataValidations count="1">'
    '<dataValidation type="list" allowBlank="1" showInputMessage="1"'
    ' showErrorMessage="1" sqref="H2:H10">'
    '<formula1>"RIO,SC,MULTI,MULTIRIO,RO"</formula1>'
    '</dataValidation></dataValidations>'
)

# Coluna P oculta. A entrada original cobria 16..16384 de uma vez; ocultar so a
# 16 exige parti-la, porque <col> nao pode se sobrepor.
COLUNA_ABERTA = '<col min="16" max="16384" width="9.140625" style="162"/>'
COLUNA_OCULTA = (
    '<col min="16" max="16" width="9.140625" style="162" hidden="1"'
    ' customWidth="1"/>'
    '<col min="17" max="16384" width="9.140625" style="162"/>'
)

CELULA_COM_FORMULA = 'N9'


def enriquecer_formatado(path):
    """Injeta na aba 2026 os elementos que vivem DENTRO do XML da planilha.

    Idempotente: rodar duas vezes nao duplica nada.
    """
    with zipfile.ZipFile(path) as src:
        entradas = [(i, src.read(i.filename)) for i in src.infolist()]

    saida, achou = [], False
    for info, data in entradas:
        if info.filename != SHEET:
            saida.append((info, data)); continue
        achou = True

        d = data.decode('utf-8')
        if 'conditionalFormatting' in d:
            print('  %s ja enriquecida, nada a fazer' % os.path.basename(path))
            return

        d = d.replace(COLUNA_ABERTA, COLUNA_OCULTA)

        alvo = re.search(r'<c r="%s"[^>]*?(?:/>|>.*?</c>)' % CELULA_COM_FORMULA, d)
        if not alvo:
            raise SystemExit('celula %s ausente da aba' % CELULA_COM_FORMULA)
        estilo = re.search(r's="(\d+)"', alvo.group(0))
        formula = '<c r="%s"%s><f>1+1</f><v>2</v></c>' % (
            CELULA_COM_FORMULA, ' s="%s"' % estilo.group(1) if estilo else '')
        d = d[:alvo.start()] + formula + d[alvo.end():]

        d = d.replace('</sheetData>', '</sheetData>' + AUTO_FILTER
                      + CONDITIONAL_FORMATTING + DATA_VALIDATIONS)
        saida.append((info, d.encode('utf-8')))

    if not achou:
        raise SystemExit('aba %s nao encontrada em %s' % (SHEET, path))

    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as out:
        for info, data in saida:
            out.writestr(info, data)
    print('  %s: autofiltro, formatacao condicional, validacao de dados,'
          ' coluna P oculta e formula em %s'
          % (os.path.basename(path), CELULA_COM_FORMULA))


if len(sys.argv) > 1 and sys.argv[1] == '--enriquecer':
    enriquecer_formatado(sys.argv[2] if len(sys.argv) > 2
                         else 'tests/fixtures/formatado.xlsx')
    raise SystemExit(0)


# --- Fixture da cadeia de calculo -------------------------------------------
#
# PD-05: a remocao de entrada em xl/calcChain.xml — incluindo o repasse do
# atributo `i` — so tinha teste sobre XML montado a mao DENTRO do teste. Nenhuma
# fixture trazia a cadeia: o [Content_Types].xml nao a declarava, e sem a
# declaracao o arquivo nem chega a ser um .xlsx valido com cadeia.
#
# Esta fixture fecha metade da lacuna — a cirurgia passa a ser exercida sobre um
# zip COMPLETO, com a cadeia declarada e relacionada. A outra metade ela NAO
# fecha, e a distincao custou caro: PD-05 pede um arquivo com formula SALVO PELO
# PROPRIO EXCEL, e este e montado por nos. Abri-lo no Excel prova que ele e
# valido, nao que reproduz o que o Excel emite — e foi justamente uma forma de
# cadeia ausente daqui que escondeu um defeito real (ver o bloco de H-24 em
# docs/06-backlog.md). A pendencia segue aberta.
#
# Deriva de basico.xlsx, ja versionada, e por isso NAO exige o arquivo real:
#   python3 tools/build_fixtures.py --formulas
#
# As formulas vao nas celulas de DATA da coluna I, que sao numericas: trocar
# celula de texto exigiria mexer no `count` de sharedStrings, que conta
# REFERENCIAS, e o assunto desta fixture e a cadeia, nao o pool de strings.
# Cada formula devolve exatamente o serial que ja estava la, entao a planilha
# abre no Excel mostrando as mesmas datas de antes.

CALC_CHAIN_PATH = 'xl/calcChain.xml'
CALC_CHAIN_TYPE = ('application/vnd.openxmlformats-officedocument.'
                   'spreadsheetml.calcChain+xml')
CALC_CHAIN_REL = ('http://schemas.openxmlformats.org/officeDocument/2006/'
                  'relationships/calcChain')
# sheetId da aba 2026 no workbook real, de onde as fixtures derivam.
SHEET_ID_2026 = 1

# (celula, celula de referencia, atributos extras na entrada da cadeia). A ordem
# e a da cadeia, e so a PRIMEIRA entrada carrega o atributo `i`: as seguintes o
# herdam. E exatamente esse repasse que o codigo de H-24 precisa fazer ao
# remover a primeira.
#
# A segunda entrada leva `l="1"` de proposito. O Excel emite `l`, `s`, `t` e `a`
# nessas entradas, e a primeira versao desta fixture usava so `r` — a MESMA
# forma do teste sintetico que ela deveria superar. Com isso ela nao alcancava o
# defeito que o revisor-xml encontrou: o repasse do `i` casava apenas a forma
# minima, e a perdia em toda cadeia produzida pelo Excel de verdade.
#
# O DESLOCAMENTO de cada formula e calculado dos seriais que estao nas celulas,
# nunca escrito a mao: `I2+9` codificado presumia as datas literais de
# FIXTURES['basico.xlsx'], e mudar uma delas deixaria a formula contradizendo o
# proprio cache — estado que o Excel nunca emite, numa fixture cuja unica razao
# de existir e ser substituta fiel de um arquivo dele. Nada ficaria vermelho:
# nenhuma assercao da suite le esses <v>. Achado do revisor-xml.
FORMULAS = [('I2', 'K2', ''), ('I3', 'I2', ' l="1"'), ('I4', 'I3', '')]


def _proxima_rel_id(rels):
    usados = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels)]
    return 'rId%d' % (max(usados) + 1 if usados else 1)


def gerar_formulas(origem='tests/fixtures/basico.xlsx',
                   destino='tests/fixtures/formulas.xlsx'):
    """Cria uma fixture com formulas E a cadeia de calculo que as indexa."""
    with zipfile.ZipFile(origem) as src:
        entradas = [(i, src.read(i.filename)) for i in src.infolist()]

    saida = []
    for info, data in entradas:
        nome = info.filename

        if nome == SHEET:
            d = data.decode('utf-8')

            def celula(xml, referencia):
                achado = re.search(r'<c r="%s"[^>]*?(?:/>|>.*?</c>)' % referencia, xml)
                if not achado:
                    raise SystemExit('celula %s ausente da aba' % referencia)
                return achado

            # Os seriais sao lidos ANTES de qualquer substituicao: `I3` referencia
            # `I2`, que nesse ponto ja teria virado formula, e o <v> continuaria
            # la — mas ler tudo de uma vez torna a ordem irrelevante.
            def serial_de(referencia):
                bruto = celula(d, referencia).group(0)
                # Celula numerica nao declara `t=`: o tipo padrao ja e numero.
                # Qualquer `t=` presente significa outra coisa — `s` guarda o
                # INDICE do pool de strings em <v>, e somar deslocamento a ele
                # daria #VALUE! no Excel com o int() engolindo o indice sem
                # reclamar; `b`, `str` e `e` quebram de outros jeitos.
                if re.search(r'\st="', bruto):
                    raise SystemExit('celula %s nao e numerica' % referencia)
                valor = re.search(r'<v>([^<]*)</v>', bruto)
                if not valor or not re.fullmatch(r'-?\d+', valor.group(1)):
                    raise SystemExit('celula %s nao guarda um serial inteiro' % referencia)
                return int(valor.group(1))

            for ref, base, _ in FORMULAS:
                if ref == base:
                    raise SystemExit('%s referenciaria a si mesma' % ref)

            seriais = {ref: serial_de(ref) for ref, _, _ in FORMULAS}
            seriais.update({base: serial_de(base) for _, base, _ in FORMULAS})

            for referencia, base, _ in FORMULAS:
                alvo = celula(d, referencia)
                bruto = alvo.group(0)
                if '<f' in bruto:
                    print('  %s ja tem formula, nada a fazer'
                          % os.path.basename(destino))
                    return
                estilo = re.search(r's="(\d+)"', bruto)
                delta = seriais[referencia] - seriais[base]
                d = d[:alvo.start()] + '<c r="%s"%s><f>%s%+d</f><v>%d</v></c>' % (
                    referencia,
                    ' s="%s"' % estilo.group(1) if estilo else '',
                    base,
                    delta,
                    seriais[referencia],
                ) + d[alvo.end():]
            saida.append((info, d.encode('utf-8')))
            continue

        if nome == '[Content_Types].xml':
            d = data.decode('utf-8')
            if 'calcChain' not in d:
                d = d.replace('</Types>', '<Override PartName="/%s"'
                              ' ContentType="%s"/></Types>'
                              % (CALC_CHAIN_PATH, CALC_CHAIN_TYPE))
            saida.append((info, d.encode('utf-8')))
            continue

        if nome == 'xl/_rels/workbook.xml.rels':
            d = data.decode('utf-8')
            if 'calcChain' not in d:
                d = d.replace('</Relationships>', '<Relationship Id="%s"'
                              ' Type="%s" Target="calcChain.xml"/></Relationships>'
                              % (_proxima_rel_id(d), CALC_CHAIN_REL))
            saida.append((info, d.encode('utf-8')))
            continue

        saida.append((info, data))

    cadeia = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' \
             '<calcChain xmlns="http://schemas.openxmlformats.org/' \
             'spreadsheetml/2006/main">%s</calcChain>' % ''.join(
                 '<c r="%s"%s%s/>' % (
                     ref, ' i="%d"' % SHEET_ID_2026 if n == 0 else '', extras)
                 for n, (ref, _, extras) in enumerate(FORMULAS))

    # `writestr` com nome em str carimba a hora de parede, e a fixture deixaria
    # de ser byte-reproduzivel: regenerar produziria diff binario integral no
    # git, sem uma unica mudanca de conteudo. As outras entradas carregam o
    # ZipInfo copiado da origem; esta precisa de um explicito, com a mesma data
    # que o zipfile usa por padrao. Achado do revisor-xml.
    entrada_cadeia = zipfile.ZipInfo(CALC_CHAIN_PATH, date_time=(1980, 1, 1, 0, 0, 0))
    entrada_cadeia.compress_type = zipfile.ZIP_DEFLATED
    entrada_cadeia.external_attr = 0o600 << 16

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as out:
        for info, data in saida:
            out.writestr(info, data)
        out.writestr(entrada_cadeia, cadeia)

    print('  %-34s %d formulas, cadeia declarada e relacionada'
          % (os.path.basename(destino), len(FORMULAS)))


if len(sys.argv) > 1 and sys.argv[1] == '--formulas':
    gerar_formulas(*sys.argv[2:4])
    raise SystemExit(0)

print('Gerando fixtures a partir de %r\n' % SRC)
_src = zipfile.ZipFile(SRC)
load_row_styles(_src)
print('  estilos por coluna agregados de %d cores' % len(ROW_STYLES))
fill_style_gaps(_src)
assert_date_formats(_src)
assert_general_styles(_src)
print()
for name, (rows, note) in FIXTURES.items():
    write_fixture(os.path.join(OUT, name), rows, note)

# Derivada, e nao gerada do arquivo real: precisa vir DEPOIS de basico.xlsx, e
# no caminho padrao. Fora dele, regenerar as fixtures deixaria formulas.xlsx
# apontando para uma basico.xlsx que nao existe mais — e os seriais que ela
# copia para o cache das formulas silenciosamente errados.
gerar_formulas(os.path.join(OUT, 'basico.xlsx'), os.path.join(OUT, 'formulas.xlsx'))
print('\nOK -> %s/' % OUT)
