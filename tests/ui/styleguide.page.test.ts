import { describe, expect, it } from "vitest";
import { metadata } from "@/app/styleguide/page";

describe("styleguide page metadata", () => {
  it("asks search engines not to index or follow the page", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
