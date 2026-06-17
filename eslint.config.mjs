import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import unusedImports from "eslint-plugin-unused-imports";

export default defineConfig([
  // 1. Глобальные игноры — первыми
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "public/**",
      "node_modules/**",
      ".claude/**",
      ".codex/**",
      ".git/**",
      ".vercel/**",
      "*.min.js",
      "*.d.ts",
    ],
  },

  // 2. Базовая конфигурация Next.js
  ...next,

  // 3. Настройки линтера
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },

  // 4. Правила для всех исходных файлов
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { "unused-imports": unusedImports },
    rules: {
      // console.log запрещён, warn/error разрешены (для серверного логирования)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Строгий контроль зависимостей React-хуков
      "react-hooks/exhaustive-deps": "error",
      // TypeScript: запрет any
      "@typescript-eslint/no-explicit-any": "warn",
      // TypeScript: неиспользуемые переменные (игнорируем _ префикс)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Автоудаление мёртвых импортов
      "unused-imports/no-unused-imports": "error",
      // Отключаем дублирующее правило в пользу @typescript-eslint
      "unused-imports/no-unused-vars": "off",
      // Запрет дублирующих импортов
      "import/no-duplicates": "off",
      "no-duplicate-imports": "error",
    },
  },

  // 5. Послабления для конфиг-файлов и scripts/
  {
    files: ["**/*.config.{js,ts,mjs,cjs}", "scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // 6. Тестовые файлы (Vitest globals)
  {
    files: ["**/*.{test,spec}.{js,jsx,ts,tsx}", "**/__tests__/**"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
