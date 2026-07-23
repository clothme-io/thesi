import type {
  Brand,
  BrandPerson,
  CreatorCrmData,
  Deal,
  DealStage,
  RelationshipStage,
} from "./types";
import { DEAL_STAGES } from "./types";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function exportBrandsCsv(brands: Brand[]) {
  const header = [
    "name",
    "contactName",
    "email",
    "phone",
    "website",
    "relationshipStage",
    "tags",
    "notes",
  ];
  const rows = brands.map((brand) => [
    brand.name,
    brand.contactName,
    brand.email,
    brand.phone,
    brand.website,
    brand.relationshipStage,
    brand.tags.join("|"),
    brand.notes,
  ]);
  downloadCsv("thesi-brands.csv", [header, ...rows]);
}

export function exportDealsCsv(
  deals: Deal[],
  brands: Brand[],
  people: BrandPerson[] = [],
) {
  const brandName = (id: string) =>
    brands.find((brand) => brand.id === id)?.name || "";
  const contactName = (id?: string) =>
    id ? people.find((person) => person.id === id)?.name || "" : "";
  const header = [
    "brandName",
    "title",
    "valueCents",
    "stage",
    "expectedCloseDate",
    "primaryContact",
    "notes",
  ];
  const rows = deals.map((deal) => [
    brandName(deal.brandId),
    deal.title,
    String(deal.valueCents),
    deal.stage,
    deal.expectedCloseDate,
    contactName(deal.primaryContactId),
    deal.notes,
  ]);
  downloadCsv("thesi-deals.csv", [header, ...rows]);
}

export function parseBrandsCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name.toLowerCase());
  return rows.slice(1).map((row) => {
    const stage = (row[index("relationshipstage")] || "prospect").trim();
    return {
      name: row[index("name")]?.trim() || "",
      contactName: row[index("contactname")]?.trim() || undefined,
      email: row[index("email")]?.trim() || undefined,
      phone: row[index("phone")]?.trim() || undefined,
      website: row[index("website")]?.trim() || undefined,
      relationshipStage: (
        ["prospect", "active", "partner", "inactive"].includes(stage)
          ? stage
          : "prospect"
      ) as RelationshipStage,
      tags: row[index("tags")]?.trim() || undefined,
      notes: row[index("notes")]?.trim() || undefined,
    };
  }).filter((row) => row.name);
}

export function parseDealsCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name.toLowerCase());
  return rows
    .slice(1)
    .map((row) => {
      const stageRaw = (row[index("stage")] || "lead").trim();
      const stage = (
        DEAL_STAGES.includes(stageRaw as DealStage) ? stageRaw : "lead"
      ) as DealStage;
      const valueRaw = row[index("valuecents")]?.trim() || "0";
      return {
        brandName: row[index("brandname")]?.trim() || "",
        title: row[index("title")]?.trim() || "",
        valueCents: Number.parseInt(valueRaw, 10) || 0,
        stage,
        expectedCloseDate: row[index("expectedclosedate")]?.trim() || undefined,
        notes: row[index("notes")]?.trim() || undefined,
      };
    })
    .filter((row) => row.brandName && row.title);
}

export type CsvImportPayload = {
  brands?: ReturnType<typeof parseBrandsCsv>;
  deals?: ReturnType<typeof parseDealsCsv>;
};

export function emptyCreatorCrmPeople(data: CreatorCrmData): BrandPerson[] {
  return data.people ?? [];
}
