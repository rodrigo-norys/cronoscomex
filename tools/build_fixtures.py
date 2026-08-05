#!/usr/bin/env python3
"""Gera tests/fixtures/*.xlsx derivando do arquivo real.

Preserva a riqueza estrutural do arquivo original (tema, estilos, tabela,
comentarios, vmlDrawing, customXml) e reescreve do zero o sharedStrings e o
sheetData, de modo que NENHUM dado real vaze para o repositorio.

A tecnica usada aqui e a mesma da escrita cirurgica do ADR-0004: descompactar,
alterar apenas as entradas necessarias, recompactar preservando o resto.

Uso: python3 tools/build_fixtures.py "CONTROLE DOS EMBARQUE.xlsx"
"""
import zipfile, sys, re, os, datetime

SRC = sys.argv[1] if len(sys.argv) > 1 else 'CONTROLE DOS EMBARQUE.xlsx'
OUT = 'tests/fixtures'
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
# serial cru (46236) em vez de 29/ago. Ver ADR-0004, "Negativas".
ROW_STYLES = {}


def load_row_styles(src):
    """Para cada cor, o styleId tipico de cada coluna no arquivo real.

    Usa o estilo mais frequente entre as celulas PREENCHIDAS daquela coluna.
    Amostrar uma linha unica nao serve: DOCS ENVIADOS so tem 20,7% de
    preenchimento, e uma linha modelo com a celula vazia traria numFmtId=0,
    fazendo o Excel exibir 46236 em vez de 29/ago.
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
                out.append(cell('%s%d' % (col, n), vals[col],
                                by_col.get(col, style), ss))
        out.append('</row>')
    return '<sheetData>%s</sheetData>' % ''.join(out)


EMAIL = re.compile(rb'[\w.+-]+@[\w-]+\.[\w.-]+')


def sanitize(name, data):
    """Remove dado real de entradas que preservamos por sua estrutura."""
    if name in ('xl/comments1.xml', 'xl/threadedComments/threadedComment1.xml',
                'xl/persons/person.xml', 'docProps/core.xml',
                'xl/worksheets/_rels/sheet4.xml.rels') or name.startswith('customXml/'):
        data = EMAIL.sub(b'exemplo@exemplo.com', data)
        data = re.sub(rb'(<t[^>]*>)[^<]{4,}(</t>)', rb'\1comentario de teste\2', data)
        data = re.sub(rb'(displayName=")[^"]*(")', rb'\1Usuario Teste\2', data)
        data = re.sub(rb'(<dc:creator>)[^<]*(</dc:creator>)', rb'\1Teste\2', data)
        data = re.sub(rb'(<cp:lastModifiedBy>)[^<]*(</cp:lastModifiedBy>)', rb'\1Teste\2', data)
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
   (163, {'A':'FT999.26','B':'COR DESCONHECIDA','I':D('2026-08-10'),'L':''}),
 ], 'as 9 chaves reais + 1 cor fora do mapa'),

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

print('Gerando fixtures a partir de %r\n' % SRC)
_src = zipfile.ZipFile(SRC)
load_row_styles(_src)
print('  estilos por coluna agregados de %d cores' % len(ROW_STYLES))
fill_style_gaps(_src)
assert_date_formats(_src)
print()
for name, (rows, note) in FIXTURES.items():
    write_fixture(os.path.join(OUT, name), rows, note)
print('\nOK -> %s/' % OUT)
