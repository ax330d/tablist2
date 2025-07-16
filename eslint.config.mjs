import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from 'typescript-eslint';


export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    ignores: ["dist/**/*", "eslint.config.mjs", 'archive'],
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: "readonly",
      },
    }
  },
  pluginJs.configs.recommended,
);