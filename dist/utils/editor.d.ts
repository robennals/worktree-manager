/**
 * Open a directory in an editor
 *
 * Editor selection priority:
 * 1. Explicit editor parameter (from --editor flag)
 * 2. Config file editor (.wtmrc.json in repo or home directory)
 * 3. EDITOR environment variable (with warning)
 * 4. Fallback list: cursor, code, vim (with warning)
 */
export declare function openInEditor(dirPath: string, editor?: string): Promise<boolean>;
//# sourceMappingURL=editor.d.ts.map