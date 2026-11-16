/** PDF and Excel built in the browser from the rows already on screen.

Excel is a real xlsx (zip, stored, no compression) so it opens in Excel and
LibreOffice without a library. PDF is a landscape table in WinAnsi, which
covers Spanish.
*/

export type Celda = string | number | null | undefined;

export type HojaPlanilla = {
  nombre: string;
  columnas: string[];
  filas: Celda[][];
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i] ?? 0;
    const mixed = CRC_TABLE[(c ^ byte) & 0xff] ?? 0;
    c = mixed ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
}

function u32(n: number): Uint8Array {
  return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** One byte per character. The PDF content stream is WinAnsi, not UTF-8. */
function latin1(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

/** Zip with method 0. Excel accepts an uncompressed xlsx. */
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = textBytes(file.name);
    const crc = crc32(file.data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(file.data.length), u32(file.data.length),
      u16(name.length), u16(0), name, file.data,
    ]);
    const centralHeader = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(file.data.length), u32(file.data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    locals.push(local);
    central.push(centralHeader);
    offset += local.length;
  }
  const centralDir = concat(central);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDir.length), u32(offset), u16(0),
  ]);
  return concat([...locals, centralDir, end]);
}

function xml(value: Celda): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function colName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(hoja: HojaPlanilla): string {
  const rows = [hoja.columnas, ...hoja.filas];
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${colName(colIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      const text = xml(value);
      const space = text.startsWith(' ') || text.endsWith(' ') ? ' xml:space="preserve"' : '';
      return `<c r="${ref}" t="inlineStr"><is><t${space}>${text}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function sheetTitle(nombre: string, used: Set<string>): string {
  const cleaned = nombre.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Hoja';
  let candidate = cleaned;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n}`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function buildXlsx(hojas: HojaPlanilla[]): Uint8Array {
  const used = new Set<string>();
  const names = hojas.map(hoja => sheetTitle(hoja.nombre, used));
  const files: { name: string; data: Uint8Array }[] = [
    {
      name: '[Content_Types].xml',
      data: textBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: textBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/workbook.xml',
      data: textBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: textBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
</Relationships>`),
    },
    ...hojas.map((hoja, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: textBytes(sheetXml(hoja)),
    })),
  ];
  if (!hojas.length) {
    return buildXlsx([{ nombre: 'Seleccion', columnas: ['Aviso'], filas: [['Elige al menos un campo.']] }]);
  }
  return zipStore(files);
}

const WIN: Record<string, number> = {
  '¡': 0xa1, '¢': 0xa2, '£': 0xa3, '¥': 0xa5, '§': 0xa7, '©': 0xa9, 'ª': 0xaa,
  '«': 0xab, '¬': 0xac, '®': 0xae, '°': 0xb0, '±': 0xb1, '²': 0xb2, '³': 0xb3,
  'µ': 0xb5, '·': 0xb7, '¹': 0xb9, 'º': 0xba, '»': 0xbb, '¿': 0xbf,
  'À': 0xc0, 'Á': 0xc1, 'Â': 0xc2, 'Ã': 0xc3, 'Ä': 0xc4, 'Å': 0xc5, 'Æ': 0xc6,
  'Ç': 0xc7, 'È': 0xc8, 'É': 0xc9, 'Ê': 0xca, 'Ë': 0xcb, 'Ì': 0xcc, 'Í': 0xcd,
  'Î': 0xce, 'Ï': 0xcf, 'Ñ': 0xd1, 'Ò': 0xd2, 'Ó': 0xd3, 'Ô': 0xd4, 'Õ': 0xd5,
  'Ö': 0xd6, 'Ø': 0xd8, 'Ù': 0xd9, 'Ú': 0xda, 'Û': 0xdb, 'Ü': 0xdc, 'Ý': 0xdd,
  'à': 0xe0, 'á': 0xe1, 'â': 0xe2, 'ã': 0xe3, 'ä': 0xe4, 'å': 0xe5, 'æ': 0xe6,
  'ç': 0xe7, 'è': 0xe8, 'é': 0xe9, 'ê': 0xea, 'ë': 0xeb, 'ì': 0xec, 'í': 0xed,
  'î': 0xee, 'ï': 0xef, 'ñ': 0xf1, 'ò': 0xf2, 'ó': 0xf3, 'ô': 0xf4, 'õ': 0xf5,
  'ö': 0xf6, 'ø': 0xf8, 'ù': 0xf9, 'ú': 0xfa, 'û': 0xfb, 'ü': 0xfc, 'ý': 0xfd,
  'ÿ': 0xff, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '€': 0x80,
};

function pdfEscape(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 63;
    const byte = code >= 32 && code <= 126 ? code : WIN[ch] ?? 63;
    if (byte === 0x5c || byte === 0x28 || byte === 0x29) out += `\\${String.fromCharCode(byte)}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function fit(value: string, chars: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= chars) return text;
  return `${text.slice(0, Math.max(1, chars - 1))}…`;
}

export function buildPdf(titulo: string, hojas: HojaPlanilla[]): Uint8Array {
  const pageW = 842;
  const pageH = 595;
  const margin = 28;
  const usable = pageW - margin * 2;
  const pages: string[] = [];
  let commands: string[] = [];
  let y = pageH - margin;

  const flush = () => {
    pages.push(commands.join('\n'));
    commands = [];
    y = pageH - margin;
  };
  const need = (height: number) => {
    if (y - height < margin) flush();
  };
  const text = (value: string, size: number, x: number, bold = false) => {
    commands.push(`BT /F${bold ? 2 : 1} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`);
  };

  text(titulo, 14, margin, true);
  y -= 18;

  const source = hojas.length ? hojas : [{ nombre: 'Seleccion', columnas: ['Aviso'], filas: [['Elige al menos un campo.']] }];
  for (const hoja of source) {
    need(36);
    text(hoja.nombre, 11, margin, true);
    y -= 16;
    const cols = Math.max(hoja.columnas.length, 1);
    const width = usable / cols;
    const chars = Math.max(4, Math.floor(width / 4.6));
    const paintHeader = () => {
      need(16);
      hoja.columnas.forEach((col, index) => text(fit(col, chars), 8, margin + index * width, true));
      y -= 12;
    };
    paintHeader();
    for (const fila of hoja.filas) {
      if (y - 12 < margin) {
        flush();
        paintHeader();
      }
      hoja.columnas.forEach((_, index) => {
        const value = fila[index];
        text(fit(value == null ? '' : String(value), chars), 8, margin + index * width);
      });
      y -= 11;
    }
    y -= 10;
  }
  if (commands.length) pages.push(commands.join('\n'));

  const objects: string[] = [];
  const pageIds: number[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kidsStart = 3;
  pages.forEach((_, index) => pageIds.push(kidsStart + index * 2));
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`);
  pages.forEach((content, index) => {
    const contentId = kidsStart + index * 2 + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return latin1(pdf);
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string) {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([copy], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPlanilla(
  filename: string,
  format: 'pdf' | 'xlsx',
  title: string,
  hojas: HojaPlanilla[],
) {
  if (format === 'pdf') {
    downloadBytes(`${filename}.pdf`, buildPdf(title, hojas), 'application/pdf');
    return;
  }
  downloadBytes(
    `${filename}.xlsx`,
    buildXlsx(hojas),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
