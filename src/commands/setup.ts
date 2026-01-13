import chalk from "chalk";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { hasHomeConfig, getHomeConfigPath } from "../utils/config.js";
import type { WtmConfig } from "../utils/config.js";

/**
 * Known editors to probe for
 */
const KNOWN_EDITORS = [
  { command: "cursor", name: "Cursor" },
  { command: "code", name: "VS Code" },
  { command: "code-insiders", name: "VS Code Insiders" },
  { command: "codium", name: "VSCodium" },
  { command: "zed", name: "Zed" },
  { command: "subl", name: "Sublime Text" },
  { command: "atom", name: "Atom" },
  { command: "vim", name: "Vim" },
  { command: "nvim", name: "Neovim" },
  { command: "emacs", name: "Emacs" },
  { command: "nano", name: "Nano" },
];

/**
 * Check if a command is available on the system
 */
function isCommandAvailable(command: string): boolean {
  const result = spawnSync("which", [command], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  return result.status === 0;
}

/**
 * Detect which editors are available on the system
 */
export function detectAvailableEditors(): { command: string; name: string }[] {
  return KNOWN_EDITORS.filter((editor) => isCommandAvailable(editor.command));
}

/**
 * Helper to ask a question and get user input
 */
function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive setup to create ~/.wtmrc.json
 */
export async function setup(): Promise<void> {
  const configPath = getHomeConfigPath();

  console.log(chalk.bold("\n🔧 wtm Setup\n"));

  // Check if config already exists
  if (hasHomeConfig()) {
    console.log(
      chalk.yellow(`Config file already exists at ${chalk.cyan(configPath)}`)
    );
    console.log("");

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await askQuestion(
      rl,
      "Do you want to overwrite it? (y/N) "
    );
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log(chalk.dim("\nSetup cancelled."));
      return;
    }
    console.log("");
  }

  // Detect available editors
  console.log(chalk.blue("Detecting available editors..."));
  const availableEditors = detectAvailableEditors();

  if (availableEditors.length === 0) {
    console.log(chalk.yellow("No known editors detected on your system."));
    console.log(
      chalk.dim("You can manually specify an editor command below.\n")
    );
  } else {
    console.log(
      chalk.green(`Found ${availableEditors.length} editor(s):\n`)
    );
    availableEditors.forEach((editor, index) => {
      console.log(`  ${chalk.cyan(index + 1)}. ${editor.name} (${chalk.dim(editor.command)})`);
    });
    console.log("");
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let selectedEditor: string | undefined;

  if (availableEditors.length > 0) {
    // Ask user to select an editor
    const prompt =
      `Select an editor [1-${availableEditors.length}] or enter custom command: `;
    const editorAnswer = await askQuestion(rl, prompt);

    const editorNum = parseInt(editorAnswer, 10);
    if (editorNum >= 1 && editorNum <= availableEditors.length) {
      selectedEditor = availableEditors[editorNum - 1].command;
    } else if (editorAnswer) {
      selectedEditor = editorAnswer;
    }
  } else {
    const editorAnswer = await askQuestion(
      rl,
      "Enter your editor command (e.g., code, vim): "
    );
    if (editorAnswer) {
      selectedEditor = editorAnswer;
    }
  }

  // Ask about auto-open preference
  console.log("");
  const autoOpenAnswer = await askQuestion(
    rl,
    "Auto-open editor after 'wtm new'? (Y/n) "
  );
  const autoOpenOnNew =
    autoOpenAnswer.toLowerCase() !== "n";

  rl.close();

  // Build config
  const config: WtmConfig = {};

  if (selectedEditor) {
    config.editor = selectedEditor;
  }

  if (!autoOpenOnNew) {
    config.autoOpenOnNew = false;
  }

  // Write config file
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  // Print summary
  console.log("");
  console.log(chalk.green("✓ Configuration saved!"));
  console.log("");
  console.log(chalk.bold("Config file:"), chalk.cyan(configPath));
  console.log("");
  console.log(chalk.bold("Settings:"));
  if (selectedEditor) {
    console.log(`  editor: ${chalk.cyan(selectedEditor)}`);
  } else {
    console.log(`  editor: ${chalk.dim("(not set - will use fallback detection)")}`);
  }
  console.log(`  autoOpenOnNew: ${chalk.cyan(autoOpenOnNew ? "true" : "false")}`);
  console.log("");
  console.log(
    chalk.dim("You can edit this file directly or run 'wtm setup' again.")
  );
}
