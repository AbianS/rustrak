import { defineConfig } from "react-doctor/api";

// Strict config: every rule category is promoted to "error" so that state/effects,
// performance, architecture, security, and accessibility issues all fail the scan
// instead of only warning. See https://www.react.doctor/docs for the full schema.
export default defineConfig({
  lint: true,
  deadCode: true,
  warnings: true,
  blocking: "error",
  scope: "full",
  categories: {
    Security: "error",
    Bugs: "error",
    Performance: "error",
    Accessibility: "error",
    Maintainability: "error",
  },
  ignore: {
    // Vendored shadcn/ui primitives — not hand-authored, not worth churning for lint compliance.
    files: ["src/components/ui/**"],
  },
});
