import { describe, expect, it } from "vitest";
import { routerBasename } from "./basename.ts";

describe("routerBasename", () => {
  it("strips the trailing slash Vite adds to a project subpath", () => {
    expect(routerBasename("/sens/")).toBe("/sens");
  });

  it("keeps a root deployment at /", () => {
    expect(routerBasename("/")).toBe("/");
    expect(routerBasename("")).toBe("/");
  });
});
