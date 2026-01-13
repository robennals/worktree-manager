import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as childProcess from "node:child_process";
import {
  isGhCliAvailable,
  hasMergedPR,
  getMergedPR,
  getPRInfo,
} from "./github.js";

vi.mock("node:child_process");

describe("github utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isGhCliAvailable", () => {
    it("should return true when gh CLI is installed", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        "gh version 2.40.0 (2023-12-05)\n"
      );

      expect(isGhCliAvailable()).toBe(true);
    });

    it("should return false when gh CLI is not installed", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("command not found: gh");
      });

      expect(isGhCliAvailable()).toBe(false);
    });
  });

  describe("hasMergedPR", () => {
    it("should return true when branch has a merged PR", () => {
      vi.mocked(childProcess.execSync).mockReturnValue(
        JSON.stringify([{ number: 123 }])
      );

      expect(hasMergedPR("feature/test")).toBe(true);
    });

    it("should return false when branch has no merged PR", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("[]");

      expect(hasMergedPR("feature/test")).toBe(false);
    });

    it("should return false when gh command fails", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("gh error");
      });

      expect(hasMergedPR("feature/test")).toBe(false);
    });

    it("should call gh with correct arguments", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("[]");

      hasMergedPR("feature/my-branch");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        'gh pr list --head "feature/my-branch" --state merged --json number --limit 1',
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
    });
  });

  describe("getMergedPR", () => {
    it("should return PR data when branch has a merged PR", () => {
      const prData = {
        number: 123,
        state: "MERGED",
        title: "Add feature",
        headRefOid: "abc123",
      };
      vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify([prData]));

      const result = getMergedPR("feature/test");

      expect(result).toEqual(prData);
    });

    it("should return null when branch has no merged PR", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("[]");

      expect(getMergedPR("feature/test")).toBeNull();
    });

    it("should return null when gh command fails", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("gh error");
      });

      expect(getMergedPR("feature/test")).toBeNull();
    });

    it("should call gh with correct arguments including headRefOid", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("[]");

      getMergedPR("feature/my-branch");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        'gh pr list --head "feature/my-branch" --state merged --json number,state,title,headRefOid --limit 1',
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
    });
  });

  describe("getPRInfo", () => {
    it("should return PR data for any state", () => {
      const prData = {
        number: 123,
        state: "OPEN",
        title: "Work in progress",
      };
      vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify([prData]));

      const result = getPRInfo("feature/test");

      expect(result).toEqual(prData);
    });

    it("should return merged PR info", () => {
      const prData = {
        number: 456,
        state: "MERGED",
        title: "Completed feature",
      };
      vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify([prData]));

      const result = getPRInfo("feature/done");

      expect(result).toEqual(prData);
    });

    it("should return closed PR info", () => {
      const prData = {
        number: 789,
        state: "CLOSED",
        title: "Rejected feature",
      };
      vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify([prData]));

      const result = getPRInfo("feature/rejected");

      expect(result).toEqual(prData);
    });

    it("should return null when no PR exists", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("[]");

      expect(getPRInfo("feature/no-pr")).toBeNull();
    });

    it("should return null when gh command fails", () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("gh error");
      });

      expect(getPRInfo("feature/test")).toBeNull();
    });

    it("should call gh with state all", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("[]");

      getPRInfo("feature/my-branch");

      expect(childProcess.execSync).toHaveBeenCalledWith(
        'gh pr list --head "feature/my-branch" --state all --json number,state,title --limit 1',
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
    });
  });
});
