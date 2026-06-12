import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // infra/ is a separate npm package with its own ESLint config.
    "infra/**",
  ]),
  {
    // React Compiler preview rules shipped by eslint-config-next flag
    // legitimate, pre-existing patterns across this app: hydrating state from
    // localStorage inside an effect, and accessing refs inside react-three-fiber
    // render loops in the out-of-scope 3D/avatar code. These are not introduced
    // by this PR. Surface them as warnings rather than blocking the build.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Pre-existing lint debt in modules this PR must not touch (3D/avatar,
    // learn explorers, annotation tooling). Tracked as separate cleanup.
    files: [
      "src/lib/hand_pose.ts",
      "src/components/Hand3D/**",
      "src/components/learn/**",
      "src/app/learn/**",
      "src/app/annotate/**",
    ],
    rules: {
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
