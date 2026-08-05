#!/usr/bin/env python3
"""H-01 — Perfilamento da planilha real. Somente stdlib."""
import zipfile, json, sys, re, hashlib
from collections import Counter, defaultdict
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
R_ID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

BUILTIN_DATE_FMT = set(range(14, 23)) | set(range(45, 48)) | {27, 30, 36, 50, 57}

path = sys.argv[1]
z = zipfile.ZipFile(path)

# ---------- sharedStrings ----------
shared = []
if 'xl/sharedStrings.xml' in z.namelist():
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in root.findall('m:si', NS):
        shared.append(''.join(t.text or '' for t in si.iter(
            '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))

# ---------- styles ----------
sroot = ET.fromstring(z.read('xl/styles.xml'))
num_fmts = {}
for nf in sroot.findall('.//m:numFmts/m:numFmt', NS):
    num_fmts[int(nf.get('numFmtId'))] = nf.get('formatCode')

fills = []
for f in sroot.findall('./m:fills/m:fill', NS):
    pf = f.find('m:patternFill', NS)
    if pf is None:
        fills.append({'pattern': None}); continue
    entry = {'pattern': pf.get('patternType')}
    fg = pf.find('m:fgColor', NS)
    if fg is not None:
        entry['fg'] = {k: v for k, v in fg.attrib.items()}
    fills.append(entry)

cell_xfs = []
for xf in sroot.findall('./m:cellXfs/m:xf', NS):
    cell_xfs.append({'numFmtId': int(xf.get('numFmtId', 0)),
                     'fillId': int(xf.get('fillId', 0)),
                     'applyFill': xf.get('applyFill')})

def style_key(style_id):
    """TD-05: chave de estilo literal, sem resolver RGB."""
    if style_id is None or style_id >= len(cell_xfs):
        return 'none'
    fill = fills[cell_xfs[style_id]['fillId']] if cell_xfs[style_id]['fillId'] < len(fills) else {'pattern': None}
    if not fill.get('pattern') or fill['pattern'] == 'none':
        return 'none'
    fg = fill.get('fg')
    if not fg:
        return 'none'
    if 'rgb' in fg:
        return 'argb:' + fg['rgb'].upper()
    if 'theme' in fg:
        tint = float(fg.get('tint', 0.0))
        return 'theme:%s|tint:%.4f' % (fg['theme'], tint)
    if 'indexed' in fg:
        return 'indexed:' + fg['indexed']
    return 'none'

def is_date_fmt(num_fmt_id):
    if num_fmt_id in BUILTIN_DATE_FMT:
        return True
    code = num_fmts.get(num_fmt_id)
    if not code:
        return False
    stripped = re.sub(r'\[[^\]]*\]|"[^"]*"', '', code)
    return bool(re.search(r'[dmyhs]', stripped, re.I))

# ---------- workbook: abas ----------
wb = ET.fromstring(z.read('xl/workbook.xml'))
rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
rid_to_target = {rel.get('Id'): rel.get('Target') for rel in rels}

sheets = []
for sh in wb.findall('.//m:sheets/m:sheet', NS):
    target = rid_to_target.get(sh.get(R_ID), '')
    if target.startswith('/xl/'):
        target = target[1:]
    elif not target.startswith('xl/'):
        target = 'xl/' + target
    sheets.append({'name': sh.get('name'), 'sheetId': sh.get('sheetId'),
                   'state': sh.get('state') or 'visible', 'path': target})

def col_letters(ref):
    return re.match(r'([A-Z]+)', ref).group(1)

def col_index(letters):
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n

DATE_WITH_YEAR = re.compile(r'^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$')
DATE_NO_YEAR = re.compile(r'^\d{1,2}[/.-](\d{1,2}|[a-zç]{3,})\.?$', re.I)

report = {'file': path, 'fileSizeBytes': len(open(path, 'rb').read()),
          'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest(),
          'zipEntries': sorted(z.namelist()), 'sheets': [], 'numFmts': num_fmts}

for sh in sheets:
    if sh['path'] not in z.namelist():
        continue
    root = ET.fromstring(z.read(sh['path']))

    hidden_cols = []
    for c in root.findall('.//m:cols/m:col', NS):
        if c.get('hidden') == '1' or float(c.get('width', 99)) < 1.0:
            hidden_cols.append({'min': c.get('min'), 'max': c.get('max'),
                                'width': c.get('width'), 'hidden': c.get('hidden')})

    cols = defaultdict(lambda: {'nonEmpty': 0, 'types': Counter(), 'samples': [],
                                'distinct': set(), 'dateExcel': 0,
                                'textWithYear': 0, 'textWithoutYear': 0})
    rows_data = []
    max_row = 0
    for row in root.findall('.//m:sheetData/m:row', NS):
        rnum = int(row.get('r'))
        max_row = max(max_row, rnum)
        cells = {}
        for c in row.findall('m:c', NS):
            letters = col_letters(c.get('r'))
            t = c.get('t')
            s = c.get('s')
            v = c.find('m:v', NS)
            isel = c.find('m:is', NS)
            f = c.find('m:f', NS)
            raw = None
            if t == 's' and v is not None:
                raw = shared[int(v.text)] if int(v.text) < len(shared) else ''
                kind = 'string'
            elif t == 'inlineStr' and isel is not None:
                raw = ''.join(x.text or '' for x in isel.iter(
                    '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
                kind = 'string'
            elif v is not None:
                raw = v.text
                sid = int(s) if s is not None else 0
                nf = cell_xfs[sid]['numFmtId'] if sid < len(cell_xfs) else 0
                kind = 'date' if is_date_fmt(nf) else 'number'
            else:
                kind = 'null'
            if f is not None:
                kind = 'formula:' + kind
            cells[letters] = {'v': raw, 'kind': kind,
                              's': int(s) if s is not None else 0}
        rows_data.append((rnum, cells))

    # cabeçalho: linha com mais strings distintas entre as 10 primeiras
    header_row, header = None, {}
    for rnum, cells in rows_data[:10]:
        strs = {k: c['v'] for k, c in cells.items()
                if c['kind'] == 'string' and c['v'] and c['v'].strip()}
        if len(strs) > len(header):
            header, header_row = strs, rnum

    style_keys = Counter()
    style_key_rows = defaultdict(list)
    style_key_ids = {}
    refs = []
    status_vals = Counter()

    header_letters = sorted(header.keys(), key=col_index) if header else []
    ref_col = header_letters[0] if header_letters else 'A'
    status_col = None
    for L, h in header.items():
        if h.strip().upper().startswith('STATUS'):
            status_col = L

    for rnum, cells in rows_data:
        if header_row and rnum <= header_row:
            continue
        if not any(c['v'] not in (None, '') for c in cells.values()):
            continue
        anchor = cells.get(ref_col)
        sk = style_key(anchor['s']) if anchor else style_key(None)
        style_keys[sk] += 1
        if len(style_key_rows[sk]) < 5:
            style_key_rows[sk].append(rnum)
        if anchor and sk not in style_key_ids:
            style_key_ids[sk] = anchor['s']
        refs.append((rnum, (anchor['v'] or '').strip() if anchor else ''))
        if status_col:
            sc = cells.get(status_col)
            status_vals[(sc['v'] or '').strip() if sc else ''] += 1

        for L, c in cells.items():
            val = c['v']
            if val is None or str(val).strip() == '':
                continue
            info = cols[L]
            info['nonEmpty'] += 1
            info['types'][c['kind']] += 1
            sv = str(val)
            if len(info['samples']) < 15 and sv not in info['samples']:
                info['samples'].append(sv)
            if len(info['distinct']) < 20000:
                info['distinct'].add(sv)
            if c['kind'].endswith('date'):
                info['dateExcel'] += 1
            elif c['kind'].endswith('string'):
                if DATE_WITH_YEAR.match(sv.strip()):
                    info['textWithYear'] += 1
                elif DATE_NO_YEAR.match(sv.strip()):
                    info['textWithoutYear'] += 1

    data_rows = len(refs)
    ref_norm = defaultdict(list)
    empty_refs = 0
    for rnum, rv in refs:
        if not rv:
            empty_refs += 1
        else:
            ref_norm[re.sub(r'\s+', ' ', rv).upper()].append(rnum)
    dups = {k: v for k, v in ref_norm.items() if len(v) > 1}

    sheet_report = {
        'name': sh['name'], 'path': sh['path'], 'state': sh['state'],
        'maxRow': max_row, 'dataRows': data_rows, 'headerRow': header_row,
        'hiddenCols': hidden_cols,
        'headers': {L: header[L] for L in header_letters},
        'columns': [],
        'styleKeys': [{'styleKey': k, 'styleId': style_key_ids.get(k),
                       'rowCount': v, 'sampleRows': style_key_rows[k]}
                      for k, v in style_keys.most_common()],
        'refColumn': {'letter': ref_col, 'total': data_rows, 'empty': empty_refs,
                      'distinct': len(ref_norm), 'duplicates': len(dups),
                      'duplicateSamples': dict(list(dups.items())[:10])},
        'statusColumn': status_col,
        'statusValues': [{'raw': k, 'count': v} for k, v in status_vals.most_common(40)],
    }
    for L in sorted(cols.keys(), key=col_index):
        info = cols[L]
        sheet_report['columns'].append({
            'letter': L, 'header': header.get(L, ''),
            'nonEmpty': info['nonEmpty'],
            'emptyRatio': round(1 - info['nonEmpty'] / data_rows, 4) if data_rows else None,
            'distinctCount': len(info['distinct']),
            'types': dict(info['types']),
            'dateExcel': info['dateExcel'],
            'textWithYear': info['textWithYear'],
            'textWithoutYear': info['textWithoutYear'],
            'samples': info['samples'],
        })
    report['sheets'].append(sheet_report)

out = sys.argv[2] if len(sys.argv) > 2 else 'perfilamento.json'
json.dump(report, open(out, 'w'), ensure_ascii=False, indent=1)
print('OK ->', out)
