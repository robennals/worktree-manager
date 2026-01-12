import { spawn } from "node:child_process";

/**
 * Default editors to try, in order of preference
 */
const DEFAULT_EDITORS = ["cursor", "code", "vim"];

/**
 * Open a directory in an editor
 */
export function openInEditor(
  dirPath: string,
  editor?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const editors = editor ? [editor] : DEFAULT_EDITORS;

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
