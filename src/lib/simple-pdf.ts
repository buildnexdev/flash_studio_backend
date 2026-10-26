/** A small text PDF so quotations can be emailed without a native PDF library. */
const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function simplePdf(lines: string[]): Buffer {
    const pages: string[][] = [];
    for (let i = 0; i < Math.max(lines.length, 1); i += 42) pages.push(lines.slice(i, i + 42));

    const objects = new Map<number, string>();
    objects.set(1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    let id = 4;
    const kids: number[] = [];
    for (const page of pages) {
        const contentId = id++;
        const pageId = id++;
        kids.push(pageId);
        const stream = page.map((line, index) => `BT /F1 11 Tf 48 ${760 - index * 16} Td (${escapePdf(line.slice(0, 110))}) Tj ET`).join('\n');
        objects.set(contentId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
        objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 1 0 R >> >> >>`);
    }
    objects.set(2, `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(' ')}] /Count ${kids.length} >>`);
    objects.set(3, '<< /Type /Catalog /Pages 2 0 R >>');

    const max = Math.max(...objects.keys());
    let body = '%PDF-1.4\n';
    const offsets = new Array<number>(max + 1).fill(0);
    for (let n = 1; n <= max; n += 1) {
        const source = objects.get(n);
        if (!source) continue;
        offsets[n] = Buffer.byteLength(body);
        body += `${n} 0 obj\n${source}\nendobj\n`;
    }
    const startxref = Buffer.byteLength(body);
    let xref = `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= max; n += 1) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    return Buffer.from(`${body}${xref}trailer << /Size ${max + 1} /Root 3 0 R >>\nstartxref\n${startxref}\n%%EOF`);
}
