import axe from "axe-core";

const RULE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
// `color-contrast` is the only disabled rule. It is not evaluable in jsdom (no layout, no painted colors).
// The same color pairs are covered by tests/design-system/contrast.test.ts.
const RULES_SKIPPED_IN_JSDOM = ["color-contrast"] as const;
const HTML_SNIPPET_MAX = 200;

export async function runAxe(root: Element): Promise<axe.AxeResults> {
  return axe.run(root, {
    runOnly: { type: "tag", values: RULE_TAGS },
    rules: Object.fromEntries(RULES_SKIPPED_IN_JSDOM.map((id) => [id, { enabled: false }])),
  });
}

export function formatViolations(violations: axe.Result[]): string {
  return violations
    .map((violation) =>
      [
        `${violation.id} (${violation.impact ?? "n/a"}): ${violation.help}`,
        `  ${violation.helpUrl}`,
        ...violation.nodes.map(
          (node) =>
            `  - ${node.target.join(" ")}\n    ${node.html.slice(0, HTML_SNIPPET_MAX)}\n    ${node.failureSummary ?? ""}`,
        ),
      ].join("\n"),
    )
    .join("\n\n");
}

export async function expectNoAxeViolations(root: Element): Promise<void> {
  const { violations } = await runAxe(root);
  if (violations.length > 0) {
    throw new Error(`axe found ${violations.length} violation(s):\n\n${formatViolations(violations)}`);
  }
}
