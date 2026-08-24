import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";

const zones = [
  {
    "target": "./src/modules/ai-gateway/controllers/**/*",
    "from": "./src/modules/ai-gateway/providers",
    "message": "Controllers in \"ai-gateway\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/ai-gateway/controllers/**/*",
    "from": "./src/modules/ai-gateway/models",
    "message": "Controllers in \"ai-gateway\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(ai-gateway)/**/*",
    "from": "./src/modules/ai-gateway",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"ai-gateway\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/ai-keys/controllers/**/*",
    "from": "./src/modules/ai-keys/providers",
    "message": "Controllers in \"ai-keys\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/ai-keys/controllers/**/*",
    "from": "./src/modules/ai-keys/models",
    "message": "Controllers in \"ai-keys\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(ai-keys)/**/*",
    "from": "./src/modules/ai-keys",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"ai-keys\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/ai-observability/controllers/**/*",
    "from": "./src/modules/ai-observability/providers",
    "message": "Controllers in \"ai-observability\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/ai-observability/controllers/**/*",
    "from": "./src/modules/ai-observability/models",
    "message": "Controllers in \"ai-observability\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(ai-observability)/**/*",
    "from": "./src/modules/ai-observability",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"ai-observability\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/auth/controllers/**/*",
    "from": "./src/modules/auth/providers",
    "message": "Controllers in \"auth\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/auth/controllers/**/*",
    "from": "./src/modules/auth/models",
    "message": "Controllers in \"auth\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(auth)/**/*",
    "from": "./src/modules/auth",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"auth\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/aws/controllers/**/*",
    "from": "./src/modules/aws/providers",
    "message": "Controllers in \"aws\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/aws/controllers/**/*",
    "from": "./src/modules/aws/models",
    "message": "Controllers in \"aws\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(aws)/**/*",
    "from": "./src/modules/aws",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"aws\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/azure/controllers/**/*",
    "from": "./src/modules/azure/providers",
    "message": "Controllers in \"azure\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/azure/controllers/**/*",
    "from": "./src/modules/azure/models",
    "message": "Controllers in \"azure\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(azure)/**/*",
    "from": "./src/modules/azure",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"azure\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/cloud/controllers/**/*",
    "from": "./src/modules/cloud/providers",
    "message": "Controllers in \"cloud\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/cloud/controllers/**/*",
    "from": "./src/modules/cloud/models",
    "message": "Controllers in \"cloud\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(cloud)/**/*",
    "from": "./src/modules/cloud",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"cloud\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/core/controllers/**/*",
    "from": "./src/modules/core/providers",
    "message": "Controllers in \"core\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/core/controllers/**/*",
    "from": "./src/modules/core/models",
    "message": "Controllers in \"core\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(core)/**/*",
    "from": "./src/modules/core",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"core\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/data-engine/controllers/**/*",
    "from": "./src/modules/data-engine/providers",
    "message": "Controllers in \"data-engine\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/data-engine/controllers/**/*",
    "from": "./src/modules/data-engine/models",
    "message": "Controllers in \"data-engine\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(data-engine)/**/*",
    "from": "./src/modules/data-engine",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"data-engine\" must go through the barrel entry point (index.ts)."
  },

  {
    "target": "./src/modules/evaluations/controllers/**/*",
    "from": "./src/modules/evaluations/providers",
    "message": "Controllers in \"evaluations\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/evaluations/controllers/**/*",
    "from": "./src/modules/evaluations/models",
    "message": "Controllers in \"evaluations\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(evaluations)/**/*",
    "from": "./src/modules/evaluations",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"evaluations\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/gcp/controllers/**/*",
    "from": "./src/modules/gcp/providers",
    "message": "Controllers in \"gcp\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/gcp/controllers/**/*",
    "from": "./src/modules/gcp/models",
    "message": "Controllers in \"gcp\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(gcp)/**/*",
    "from": "./src/modules/gcp",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"gcp\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/github/controllers/**/*",
    "from": "./src/modules/github/providers",
    "message": "Controllers in \"github\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/github/controllers/**/*",
    "from": "./src/modules/github/models",
    "message": "Controllers in \"github\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(github)/**/*",
    "from": "./src/modules/github",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"github\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/integrations/controllers/**/*",
    "from": "./src/modules/integrations/providers",
    "message": "Controllers in \"integrations\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/integrations/controllers/**/*",
    "from": "./src/modules/integrations/models",
    "message": "Controllers in \"integrations\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(integrations)/**/*",
    "from": "./src/modules/integrations",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"integrations\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/notifications/controllers/**/*",
    "from": "./src/modules/notifications/providers",
    "message": "Controllers in \"notifications\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/notifications/controllers/**/*",
    "from": "./src/modules/notifications/models",
    "message": "Controllers in \"notifications\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(notifications)/**/*",
    "from": "./src/modules/notifications",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"notifications\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/oauth/controllers/**/*",
    "from": "./src/modules/oauth/providers",
    "message": "Controllers in \"oauth\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/oauth/controllers/**/*",
    "from": "./src/modules/oauth/models",
    "message": "Controllers in \"oauth\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(oauth)/**/*",
    "from": "./src/modules/oauth",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"oauth\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/otp/controllers/**/*",
    "from": "./src/modules/otp/providers",
    "message": "Controllers in \"otp\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/otp/controllers/**/*",
    "from": "./src/modules/otp/models",
    "message": "Controllers in \"otp\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(otp)/**/*",
    "from": "./src/modules/otp",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"otp\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/prompts/controllers/**/*",
    "from": "./src/modules/prompts/providers",
    "message": "Controllers in \"prompts\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/prompts/controllers/**/*",
    "from": "./src/modules/prompts/models",
    "message": "Controllers in \"prompts\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(prompts)/**/*",
    "from": "./src/modules/prompts",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"prompts\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/resize-migration/controllers/**/*",
    "from": "./src/modules/resize-migration/providers",
    "message": "Controllers in \"resize-migration\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/resize-migration/controllers/**/*",
    "from": "./src/modules/resize-migration/models",
    "message": "Controllers in \"resize-migration\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(resize-migration)/**/*",
    "from": "./src/modules/resize-migration",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"resize-migration\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/saas-admin/controllers/**/*",
    "from": "./src/modules/saas-admin/providers",
    "message": "Controllers in \"saas-admin\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/saas-admin/controllers/**/*",
    "from": "./src/modules/saas-admin/models",
    "message": "Controllers in \"saas-admin\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(saas-admin)/**/*",
    "from": "./src/modules/saas-admin",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"saas-admin\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/simulation/controllers/**/*",
    "from": "./src/modules/simulation/providers",
    "message": "Controllers in \"simulation\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/simulation/controllers/**/*",
    "from": "./src/modules/simulation/models",
    "message": "Controllers in \"simulation\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(simulation)/**/*",
    "from": "./src/modules/simulation",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"simulation\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/slack/controllers/**/*",
    "from": "./src/modules/slack/providers",
    "message": "Controllers in \"slack\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/slack/controllers/**/*",
    "from": "./src/modules/slack/models",
    "message": "Controllers in \"slack\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(slack)/**/*",
    "from": "./src/modules/slack",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"slack\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/team/controllers/**/*",
    "from": "./src/modules/team/providers",
    "message": "Controllers in \"team\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/team/controllers/**/*",
    "from": "./src/modules/team/models",
    "message": "Controllers in \"team\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(team)/**/*",
    "from": "./src/modules/team",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"team\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/terraform/controllers/**/*",
    "from": "./src/modules/terraform/providers",
    "message": "Controllers in \"terraform\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/terraform/controllers/**/*",
    "from": "./src/modules/terraform/models",
    "message": "Controllers in \"terraform\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(terraform)/**/*",
    "from": "./src/modules/terraform",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"terraform\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/usage-reports/controllers/**/*",
    "from": "./src/modules/usage-reports/providers",
    "message": "Controllers in \"usage-reports\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/usage-reports/controllers/**/*",
    "from": "./src/modules/usage-reports/models",
    "message": "Controllers in \"usage-reports\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(usage-reports)/**/*",
    "from": "./src/modules/usage-reports",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"usage-reports\" must go through the barrel entry point (index.ts)."
  },
  {
    "target": "./src/modules/vps-logs/controllers/**/*",
    "from": "./src/modules/vps-logs/providers",
    "message": "Controllers in \"vps-logs\" must never import directly from providers. Use services instead."
  },
  {
    "target": "./src/modules/vps-logs/controllers/**/*",
    "from": "./src/modules/vps-logs/models",
    "message": "Controllers in \"vps-logs\" must never import directly from models/repositories. Use services instead."
  },
  {
    "target": "./src/modules/!(vps-logs)/**/*",
    "from": "./src/modules/vps-logs",
    "except": [
      "./index.ts"
    ],
    "message": "Cross-module imports from \"vps-logs\" must go through the barrel entry point (index.ts)."
  }
];

export default [
  {
    ignores: ["dist/**/*", "node_modules/**/*", "scratch/**/*"]
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json"
      }
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      import: importPlugin
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json"
        },
        node: true
      }
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones
        }
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  }
];
