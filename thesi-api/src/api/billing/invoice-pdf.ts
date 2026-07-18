export type InvoicePdfInput = {
  invoiceNumber: string;
  description: string;
  amountCents: number;
  status: string;
  invoiceDate: string;
  companyName: string;
  billingEmail: string;
  addressLines: string[];
  /** Optional issuer block (creator invoices). */
  fromName?: string;
  fromEmail?: string;
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Minimal single-page PDF (no external deps) for brand invoice download. */
export function buildInvoicePdf(input: InvoicePdfInput): Buffer {
  const lines = [
    'Thesi Invoice',
    `Invoice: ${input.invoiceNumber}`,
    `Date: ${input.invoiceDate}`,
    `Status: ${input.status}`,
    '',
    ...(input.fromName || input.fromEmail
      ? [
          `From: ${input.fromName || ''}`.trim(),
          input.fromEmail || '',
          '',
        ]
      : []),
    `Bill to: ${input.companyName}`,
    input.billingEmail,
    ...input.addressLines.filter(Boolean),
    '',
    `Description: ${input.description}`,
    `Amount: ${formatMoney(input.amountCents)}`,
    '',
    'Thank you for your business.',
  ];

  const contentLines = lines.map((line, index) => {
    const y = 750 - index * 18;
    return `BT /F1 11 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
  });
  const stream = contentLines.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n',
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
