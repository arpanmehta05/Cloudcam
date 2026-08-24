import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const modules = [
  "ai-observability",
  "auth",
  "cloud-dashboard",
  "landing",
  "navigation",
  "resize-migration",
  "settings",
  "simulation",
  "vps-logs"
];

const zones = [];

for (const mod of modules) {
  // Page components must not import module internals
  zones.push({
    target: "./src/app/**/*",
    from: `./src/modules/${mod}`,
    except: ["./index.ts", "./index.tsx", "./types.ts"],
    message: `Page components must not import from internal paths of module "${mod}". Use the barrel entry point instead.`
  });

  // Cross-module internal imports are forbidden
  zones.push({
    target: `./src/modules/!(${mod})/**/*`,
    from: `./src/modules/${mod}`,
    except: ["./index.ts", "./index.tsx", "./types.ts"],
    message: `Cross-module imports from "${mod}" must go through the barrel entry point.`
  });
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones,
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Downgrade React Compiler rules — too strict for existing idiomatic patterns
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      // Downgrade no-explicit-any — prefer warn so existing code doesn't block CI
      "@typescript-eslint/no-explicit-any": "warn",
      // Downgrade unescaped entities — cosmetic, not a correctness issue
      "react/no-unescaped-entities": "warn",
      // Downgrade minor style rules
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
