import { spawn } from "node:child_process";
import chalk from "chalk";
import { getConfiguredEditor, hasHomeConfig } from "./config.js";

/**
 * Fallback editors to try if no editor is configured
 */
const FALLBACK_EDITORS = ["cursor", "code", "vim"];

/**
 * Open a directory in an editor
 *
 * Editor selection priority:
 * 1. Explicit editor parameter (from --editor flag)
 * 2. Config file editor (.wtmrc.json in repo or home directory)
 * 3. EDITOR environment variable (with warning)
 * 4. Fallback list: cursor, code, vim (with warning)
 */
export function openInEditor(
  dirPath: string,
  editor?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    let editors: string[];

    if (editor) {
      // Explicit editor from command line
      editors = [editor];
    } else {
      const configuredEditor = getConfiguredEditor();
      if (configuredEditor) {
        // Editor from config file
        editors = [configuredEditor];
      } else {
        // No config - check EDITOR env var or use fallbacks
        const envEditor = process.env.EDITOR;
        if (envEditor) {
          editors = [envEditor];
          console.warn(
            chalk.yellow(
              `Warning: No editor configured in .wtmrc.json. Using EDITOR environment variable: ${envEditor}`
            )
          );
          if (!hasHomeConfig()) {
            console.warn(
              chalk.dim(
                `  Run 'wtm setup' to configure your preferred editor.`
              )
            );
          } else {
            console.warn(
              chalk.dim(
                `  To configure, create .wtmrc.json with: { "editor": "your-editor" }`
              )
            );
          }
        } else {
          editors = FALLBACK_EDITORS;
          console.warn(
            chalk.yellow(
              `Warning: No editor configured. Trying fallback editors: ${FALLBACK_EDITORS.join(", ")}`
            )
          );
          if (!hasHomeConfig()) {
            console.warn(
              chalk.dim(
                `  Run 'wtm setup' to configure your preferred editor.`
              )
            );
          } else {
            console.warn(
              chalk.dim(
                `  To configure, create .wtmrc.json with: { "editor": "your-editor" }`
              )
            );
          }
        }
      }
    }

    const tryEditor = (index: number): void => {
      if (index >= editors.length) {
        resolve(false);
        return;
      }

      const currentEditor = editors[index];
      const proc = spawn(currentEditor, [dirPath], {
        detached: true,
        stdio: "ignore",
      });

      proc.on("error", () => {
        // Editor not found, try next one
        tryEditor(index + 1);
      });

      proc.on("spawn", () => {
        proc.unref();
        resolve(true);
      });
    };

    tryEditor(0);
  });
}
