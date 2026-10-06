// Generador de archivos .xlsx sin dependencias externas.
// Escribe el ZIP (sin compresión) y el SpreadsheetML a mano, igual que el
// panel web del proyecto, para que el app móvil genere Excel real.

export type TipoCelda = "text" | "num" | "int" | "pct";

export type HojaXLSX = {
  name: string;
  title?: string;
  headers?: string[];
  rows: (string | number | null | undefined)[][];
  types?: TipoCelda[];
  color?: string;
};

function colLetter(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function estilosXml(): string {
  const fonts = [
    '<font><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><color rgb="FFFFFFFF"/><sz val="15"/><name val="Calibri"/></font>',
  ];
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F6FA"/><bgColor indexed="64"/></patternFill></fill>',
  ];
  const borders = [
    "<border><left/><right/><top/><bottom/><diagonal/></border>",
    '<border><left style="thin"><color rgb="FFC7CDD6"/></left><right style="thin"><color rgb="FFC7CDD6"/></right><top style="thin"><color rgb="FFC7CDD6"/></top><bottom style="thin"><color rgb="FFC7CDD6"/></bottom><diagonal/></border>',
  ];
  const xf = (numFmt: number, font: number, fill: number, border: number, h?: string) => {
    const al = h
      ? `<alignment horizontal="${h}" vertical="center"/>`
      : "";
    return `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
  };
  const xfs = [
    xf(0, 0, 0, 0, "left"), // 0 texto
    xf(0, 2, 2, 1, "center"), // 1 encabezado
    xf(0, 0, 0, 1, "left"), // 2 texto con borde
    xf(0, 0, 3, 1, "left"), // 3 texto alterno
    xf(4, 0, 0, 1, "right"), // 4 numero 2 decimales
    xf(4, 0, 3, 1, "right"), // 5 numero alterno
    xf(3, 0, 0, 1, "right"), // 6 entero
    xf(3, 0, 3, 1, "right"), // 7 entero alterno
    xf(164, 0, 0, 1, "right"), // 8 porcentaje
    xf(164, 0, 3, 1, "right"), // 9 porcentaje alterno
    xf(0, 3, 2, 1, "left"), // 10 titulo
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00&quot;%&quot;"/></numFmts><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

const escapar = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ───────────────────────── ZIP (sin compresión) ─────────────────────────
function crc32(buf: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(
  files: { nombre: string; datos: Uint8Array }[]
): Uint8Array {
  const trozos: Uint8Array[] = [];
  const dir: Uint8Array[] = [];
  let offset = 0;

  for (const { nombre, datos } of files) {
    const nb = utf8Bytes(nombre);
    const crc = crc32(datos);
    const local = new Uint8Array(30);
    local[0] = 0x50; local[1] = 0x4b; local[2] = 0x03; local[3] = 0x04;
    const u16 = (t: Uint8Array, o: number, n: number) => {
      t[o] = n & 0xff;
      t[o + 1] = (n >> 8) & 0xff;
    };
    const u32 = (t: Uint8Array, o: number, n: number) => {
      t[o] = n & 0xff;
      t[o + 1] = (n >> 8) & 0xff;
      t[o + 2] = (n >> 16) & 0xff;
      t[o + 3] = (n >>> 24) & 0xff;
    };
    u16(local, 4, 20);
    u16(local, 6, 0); u16(local, 8, 0); u16(local, 10, 0); u16(local, 12, 0);
    u32(local, 14, crc);
    u32(local, 18, datos.length);
    u32(local, 22, datos.length);
    u16(local, 26, nb.length);
    u16(local, 28, 0);
    trozos.push(local, nb, datos);

    const ce = new Uint8Array(46);
    ce[0] = 0x50; ce[1] = 0x4b; ce[2] = 0x01; ce[3] = 0x02;
    u16(ce, 4, 20);
    u16(ce, 6, 20);
    u16(ce, 8, 0); u16(ce, 10, 0); u16(ce, 12, 0); u16(ce, 14, 0);
    u32(ce, 16, crc);
    u32(ce, 20, datos.length);
    u32(ce, 24, datos.length);
    u16(ce, 28, nb.length);
    u16(ce, 30, 0); u16(ce, 32, 0); u16(ce, 34, 0); u16(ce, 36, 0);
    u32(ce, 38, 0);
    u32(ce, 42, offset);
    dir.push(ce, nb);

    offset += local.length + nb.length + datos.length;
  }

  const cdLen = dir.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const u16 = (t: Uint8Array, o: number, n: number) => {
    t[o] = n & 0xff;
    t[o + 1] = (n >> 8) & 0xff;
  };
  const u32 = (t: Uint8Array, o: number, n: number) => {
    t[o] = n & 0xff;
    t[o + 1] = (n >> 8) & 0xff;
    t[o + 2] = (n >> 16) & 0xff;
    t[o + 3] = (n >>> 24) & 0xff;
  };
  eocd[0] = 0x50; eocd[1] = 0x4b; eocd[2] = 0x05; eocd[3] = 0x06;
  u16(eocd, 4, 0);
  u16(eocd, 6, 0);
  u16(eocd, 8, files.length);
  u16(eocd, 10, files.length);
  u32(eocd, 12, cdLen);
  u32(eocd, 16, offset);
  u16(eocd, 20, 0);

  const total = trozos.reduce((a, b) => a + b.length, 0) + cdLen + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const t of [...trozos, ...dir, eocd]) {
    out.set(t, p);
    p += t.length;
  }
  return out;
}

export function utf8Bytes(s: string): Uint8Array {
  const str = String(s ?? "");
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(i + 1);
      const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      i++;
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64DesdeBytes(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

export function crearXLSX(hojas: HojaXLSX[]): Uint8Array {
  const ss: string[] = [];
  const map = new Map<string, number>();
  const idx = (s: unknown) => {
    const k = String(s ?? "");
    if (map.has(k)) return map.get(k)!;
    const i = ss.push(k) - 1;
    map.set(k, i);
    return i;
  };

  const outs = hojas.map((cfg, n) => {
    const headers = cfg.headers || [];
    const rows = cfg.rows || [];
    const types = cfg.types || [];
    let nCols = Math.max(headers.length, cfg.title ? 2 : 1, 1);
    for (const r of rows) nCols = Math.max(nCols, r.length);
    const widths: number[] = new Array(nCols).fill(10);
    headers.forEach((h, i) => {
      widths[i] = Math.min(46, Math.max(10, String(h).length + 3));
    });
    for (const r of rows) {
      r.forEach((c, i) => {
        if (i >= nCols) return;
        const L = String(c ?? "").length + (typeof c === "number" ? 2 : 0);
        if (L >= 10) widths[i] = Math.min(48, Math.max(widths[i], L + 2));
      });
    }

    let rowXml = "";
    let rIdx = 1;
    if (cfg.title) {
      rowXml += `<row r="1" ht="26" customHeight="1"><c r="A1" s="10" t="s"><v>${idx(cfg.title)}</v></c></row>`;
      rIdx = 2;
    }
    if (headers.length) {
      rowXml += `<row r="${rIdx}" ht="22" customHeight="1">${headers
        .map((h, i) => `<c r="${colLetter(i)}${rIdx}" s="1" t="s"><v>${idx(h)}</v></c>`)
        .join("")}</row>`;
      rIdx++;
    }
    rows.forEach((row, rn) => {
      const alt = rn % 2 === 1;
      rowXml += `<row r="${rIdx}">${row
        .map((cell, i) => {
          const t = i < types.length ? types[i] : "text";
          const st =
            t === "num" ? (alt ? 5 : 4) : t === "int" ? (alt ? 7 : 6) : t === "pct" ? (alt ? 9 : 8) : alt ? 3 : 2;
          const esNum =
            typeof cell === "number" ||
            (t !== "text" && String(cell).trim() !== "" && !isNaN(Number(cell)));
          if (esNum && t !== "text") {
            return `<c r="${colLetter(i)}${rIdx}" s="${st}"><v>${Number(cell)}</v></c>`;
          }
          return `<c r="${colLetter(i)}${rIdx}" s="${st}" t="s"><v>${idx(cell)}</v></c>`;
        })
        .join("")}</row>`;
      rIdx++;
    });

    const lastRow = Math.max(rIdx - 1, 1);
    const freeze = headers.length ? 1 + (cfg.title ? 1 : 0) : 0;
    const sv = freeze
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const cols = widths
      .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
      .join("");
    const afRow = cfg.title ? 2 : 1;
    const auto = headers.length ? `<autoFilter ref="A${afRow}:${colLetter(nCols - 1)}${lastRow}"/>` : "";
    const merge = cfg.title
      ? `<mergeCells count="1"><mergeCell ref="A1:${colLetter(nCols - 1)}1"/></mergeCells>`
      : "";
    const tab = cfg.color ? `<sheetPr><tabColor rgb="${cfg.color}"/></sheetPr>` : "";
    const nombre = String(cfg.name || `Hoja${n + 1}`).slice(0, 31);

    return {
      nombre,
      xml: `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${tab}${sv}<cols>${cols}</cols><sheetData>${rowXml}</sheetData>${auto}${merge}</worksheet>`,
    };
  });

  const sst = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">${ss
    .map((s) => `<si><t xml:space="preserve">${escapar(s)}</t></si>`)
    .join("")}</sst>`;
  const books = outs
    .map((s, i) => `<sheet name="${escapar(s.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${books}</sheets></workbook>`;
  const overrides = outs
    .map(
      (s, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const typesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRels =
    outs
      .map(
        (s, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join("") +
    `<Relationship Id="rId${outs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId${outs.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;

  const archivos: { nombre: string; datos: Uint8Array }[] = [
    { nombre: "[Content_Types].xml", datos: utf8Bytes(typesXml) },
    { nombre: "_rels/.rels", datos: utf8Bytes(rootRels) },
    { nombre: "xl/workbook.xml", datos: utf8Bytes(workbookXml) },
    {
      nombre: "xl/_rels/workbook.xml.rels",
      datos: utf8Bytes(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels}</Relationships>`
      ),
    },
    { nombre: "xl/styles.xml", datos: utf8Bytes(estilosXml()) },
    { nombre: "xl/sharedStrings.xml", datos: utf8Bytes(sst) },
  ];
  outs.forEach((s, i) =>
    archivos.push({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: utf8Bytes(s.xml) })
  );

  return zipStore(archivos);
}
