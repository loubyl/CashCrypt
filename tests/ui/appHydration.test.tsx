// Hydration of the real HomeScreen inside the real AppShell and CryptProvider.
// The server renders the loading placeholder; the first client render matches
// it with no hydration error, no Landing flash, and a single <nav> afterwards
// whichever side of 1024px the client viewport is on.
import { act, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { AppShell } from "@/components/shell/AppShell";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { CryptProvider } from "@/hooks/useCrypt";
import { openCrypt } from "@/lib/db/crypt";
import { MODE_STORAGE_KEY, type Mode } from "@/lib/db/modeStore";
import type { CryptDb } from "@/lib/db/schema";
import { loadScenario } from "@/lib/demo/service";
import { createMemoryStorage, seedReal } from "./helpers/crypt";
import { resetViewport, setViewportWidth } from "./helpers/viewport";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const NOW = "2025-06-02";
const BELOW_DESKTOP = 1023;
const AT_DESKTOP = 1024;
const LANDING_TEXT = "Enter the demo crypt";
const DASHBOARD_HEADING = "Your crypt";
const LOADING_HEADING = "Loading CashCrypt";

type Case = { label: string; mode: Mode | null; seed: (real: CryptDb, demo: CryptDb) => Promise<void> };

const CASES: Case[] = [
  { label: "no mode", mode: null, seed: async () => {} },
  { label: "demo mode", mode: "demo", seed: (_real, demo) => loadScenario(demo, "level-4", NOW) },
  { label: "real mode", mode: "real", seed: (real) => seedReal(real, {}) },
];

let root: Root | null = null;
let container: HTMLElement | null = null;
let observer: MutationObserver | null = null;

afterEach(() => {
  observer?.disconnect();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  observer = null;
  resetViewport();
  vi.restoreAllMocks();
});

async function buildTree({ mode, seed }: Case) {
  const indexedDB = new IDBFactory();
  Dexie.dependencies.indexedDB = indexedDB;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const openDb = (name: string): CryptDb => openCrypt(name, { indexedDB, IDBKeyRange });
  await seed(openDb("cashcrypt"), openDb("cashcrypt-demo"));
  const storage = createMemoryStorage(mode ? { [MODE_STORAGE_KEY]: mode } : {});
  return (
    <CryptProvider openDb={openDb} storage={storage} getClock={() => NOW}>
      <ToastRegion>
        <AppShell>
          <HomeScreen />
        </AppShell>
      </ToastRegion>
    </CryptProvider>
  );
}

async function serverRenderThenHydrate(testCase: Case, clientWidth: number) {
  const tree = await buildTree(testCase);
  setViewportWidth(AT_DESKTOP); // a desktop client must still get a mobile-neutral server render
  const html = renderToString(tree);
  setViewportWidth(clientWidth);

  container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  const snapshots: string[] = [];
  observer = new MutationObserver(() => snapshots.push(container?.textContent ?? ""));
  observer.observe(container, { childList: true, subtree: true, characterData: true });

  const consoleError = vi.spyOn(console, "error");
  const recoverable: unknown[] = [];
  act(() => {
    root = hydrateRoot(container as HTMLElement, tree, {
      onRecoverableError: (error) => recoverable.push(error),
    });
  });
  const afterHydration = container.innerHTML;
  return { html, afterHydration, snapshots, consoleError, recoverable };
}

describe("HomeScreen in AppShell hydration", () => {
  it.each(CASES.flatMap((testCase) => [BELOW_DESKTOP, AT_DESKTOP].map((width) => [testCase.label, width, testCase] as const)))(
    "%s at client width %i: placeholder on the server, no hydration error, no Landing flash, one nav",
    async (_label, width, testCase) => {
      const { html, afterHydration, snapshots, consoleError, recoverable } =
        await serverRenderThenHydrate(testCase, width);

      // Server HTML: the loading placeholder only (Skeleton, aria-busy), no Landing, no nav.
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain(LOADING_HEADING);
      expect(html).not.toContain(LANDING_TEXT);
      expect(html).not.toContain("Start my own crypt");
      expect(html).not.toContain("<nav");

      // Hydration render: nothing reported. With a stored mode the status stays
      // "loading" until the database answers, so the placeholder is still there and
      // the Landing has not rendered. Without a mode the status is "none" as soon as
      // the client snapshot is read, and the Landing is the right content.
      if (testCase.mode !== null) {
        expect(container?.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(afterHydration).not.toContain(LANDING_TEXT);
      }
      expect(recoverable).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();

      if (testCase.mode === null) {
        await waitFor(() => expect(container?.textContent).toContain(LANDING_TEXT));
        expect(container?.querySelectorAll("nav")).toHaveLength(0);
      } else {
        await waitFor(() => expect(container?.textContent).toContain(DASHBOARD_HEADING));
        // The Landing never rendered at any point on the way to the Dashboard.
        expect(snapshots.some((text) => text.includes(LANDING_TEXT))).toBe(false);
        const navs = container?.querySelectorAll("nav") ?? [];
        expect(navs).toHaveLength(1);
        const isSidebar = width >= AT_DESKTOP;
        expect(navs[0]?.className.includes("fixed")).toBe(!isSidebar);
        expect(navs[0]?.querySelectorAll("a")).toHaveLength(isSidebar ? 6 : 5);
      }

      expect(recoverable).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
    },
  );
});
