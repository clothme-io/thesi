import { describe, expect, it } from "vitest";
import { parseBrandLines } from "./parse-brand-lines";

describe("parseBrandLines", () => {
  it("keeps a comma between name and email as one entry", () => {
    expect(
      parseBrandLines("Northwind Apparel, northwind.livetest@example.com"),
    ).toEqual([
      {
        name: "Northwind Apparel",
        email: "northwind.livetest@example.com",
      },
    ]);
  });

  it("parses the drawer placeholder as two brands", () => {
    expect(
      parseBrandLines("Acme Co, billing@acme.com\npartners@brand.io"),
    ).toEqual([
      { name: "Acme Co", email: "billing@acme.com" },
      { name: "partners", email: "partners@brand.io" },
    ]);
  });

  it("supports Name <email> and semicolon-separated entries", () => {
    expect(
      parseBrandLines("Northwind Apparel <hello@northwind.test>; solo@brand.io"),
    ).toEqual([
      { name: "Northwind Apparel", email: "hello@northwind.test" },
      { name: "solo", email: "solo@brand.io" },
    ]);
  });

  it("drops lines without an email and dedupes by address", () => {
    expect(
      parseBrandLines("Just a name\nbilling@acme.com\nAcme, billing@acme.com"),
    ).toEqual([{ name: "billing", email: "billing@acme.com" }]);
  });
});
