import { select } from "@inquirer/prompts";

export interface SelectOption {
  name: string;
  value: string;
  description?: string;
}

/**
 * Show an interactive selection prompt with arrow key navigation
 * Also allows number keys for quick selection
 */
export async function selectFromList(
  message: string,
  options: SelectOption[]
): Promise<string | null> {
  if (options.length === 0) {
    return null;
  }

  // Add number prefixes to choices for quick selection
  const choices = options.map((opt, idx) => ({
    name: `${idx + 1}. ${opt.name}${opt.description ? ` - ${opt.description}` : ""}`,
    value: opt.value,
  }));

  try {
    const result = await select({
      message,
      choices,
    });
    return result;
  } catch {
    // User cancelled (Ctrl+C)
    return null;
  }
}
