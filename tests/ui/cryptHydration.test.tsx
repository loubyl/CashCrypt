// Hydration of CryptProvider. The server snapshot of the mode is "unknown", so
// the server HTML and the first client render are both the loading state; no
// hydration error is reported. After hydration the status goes straight from
// "loading" to the Active_Crypt, never through "none" (which would flash the
// Landing before the Dashboard).
import { act, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CryptProvider, useCrypt, type CryptStatus } from "@/hooks/useCrypt";
import { openCrypt } from "@/lib/db/crypt";
import { MODE_STORAGE_KEY, type Mode } from "@/lib/db/modeStore";
import type { CryptDb } from "@/lib/db/schema";
import { loadScenario } from "@/lib/demo/service";
import { createMemoryStorage, seedReal } from "./helpers/crypt";

const NOW = "2025-06-02";
const PLACEHOLDER_TEXT = "Loading your crypt";

/** Mirrors the HomeScreen rule in design.md: skeleton while loading. */
function createHome(statuses: CryptStatus[]) {
  return function Home(): ReactNode {
    const { status } = useCrypt();
    statuses.push(status);
    if (status === "loading") {
      return <div data-testid="placeholder" aria-busy="true">{PLACEHOLDER_TEXT}</div>;
    }
    if (status === "none") return <h1>Landing</h1>;
    return <h1>Dashboard</h1>;
  };
}

type Setup = { mode: Mode | null; seed: (real: CryptDb, demo: CryptDb) => Promise<void> };

async function prepare({ mode, seed }: Setup) {
  const indexedDB = new IDBFactory();
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const openDb = (name: string): CryptDb => openCrypt(name, { indexedDB, IDBKeyRange });
  await seed(openDb("cashcrypt"), openDb("cashcrypt-demo"));
  const storage = createMemoryStorage(mode ? { [MODE_STORAGE_KEY]: mode } : {});
  const statuses: CryptStatus[] = [];
  const Home = createHome(statuses);
  const tree = (
    <CryptProvider openDb={openDb} storage={storage} getClock={() => NOW}>
      <Home />
    </CryptProvider>
  );
  return { tree, statuses };
}

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

async function serverRenderThenHydrate(setup: Setup) {
  const { tree, statuses } = await prepare(setup);
  const html = renderToString(tree);
  const serverStatuses = statuses.splice(0);
  container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const consoleError = vi.spyOn(console, "error");
  const recoverable: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(container as HTMLElement, tree, {
      onRecoverableError: (error) => recoverable.push(error),
    });
  });
  return { html, serverStatuses, statuses, consoleError, recoverable };
}

describe("CryptProvider hydration", () => {
  it.each<[string, Setup, string]>([
    ["real mode with a Profile", { mode: "real", seed: (real) => seedReal(real, {}) }, "Dashboard"],
    ["demo mode", { mode: "demo", seed: (_real, demo) => loadScenario(demo, "level-4", NOW) }, "Dashboard"],
    ["no mode", { mode: null, seed: async () => {} }, "Landing"],
  ])("%s: server HTML is the neutral placeholder, hydration has no errors, no Landing flash", async (_label, setup, final) => {
    const { html, serverStatuses, statuses, consoleError, recoverable } = await serverRenderThenHydrate(setup);

    // Server: the "unknown" mode snapshot renders the neutral loading placeholder.
    expect(serverStatuses).toEqual(["loading"]);
    expect(html).toContain(PLACEHOLDER_TEXT);
    expect(html).not.toContain("Landing");
    expect(html).not.toContain("Dashboard");

    // First client render (hydration) matches the server and reports nothing.
    expect(statuses[0]).toBe("loading");
    expect(recoverable).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();

    await waitFor(() => expect(container?.textContent).toBe(final));
    const firstSettled = statuses.findIndex((s) => s !== "loading");
    const afterLoading = statuses.slice(firstSettled);
    if (final === "Dashboard") {
      // Straight from loading to the Active_Crypt: the Landing never renders.
      expect(afterLoading).not.toContain("none");
      expect(statuses.slice(0, firstSettled).every((s) => s === "loading")).toBe(true);
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("detects a mismatch in this setup (control for the no-error assertions above)", async () => {
    container = document.createElement("div");
    container.innerHTML = "<p>server text</p>";
    document.body.appendChild(container);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container as HTMLElement, <p>client text</p>, {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });
    expect(recoverable.length).toBeGreaterThan(0);
  });

  it("treats real mode without a Profile as none after loading", async () => {
    const { statuses, recoverable } = await serverRenderThenHydrate({ mode: "real", seed: async () => {} });
    await waitFor(() => expect(container?.textContent).toBe("Landing"));
    expect(recoverable).toEqual([]);
    expect(statuses.filter((s) => s !== "loading" && s !== "none")).toEqual([]);
  });
});
