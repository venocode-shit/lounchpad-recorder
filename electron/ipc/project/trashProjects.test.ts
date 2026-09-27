import { expect, it, vi } from "vitest";
import { trashLibraryProjects } from "./trashProjects";
import path from "node:path";

// Use platform-appropriate paths
const getTestPath = (p: string) => (process.platform === "win32" ? path.win32.normalize(p) : path.posix.normalize(p));

it("rejects paths outside the project library before touching files", async () => {
	const trash = vi.fn();
	const testPath = getTestPath("/private/tmp/a.recordly");
	await expect(
		trashLibraryProjects([testPath, getTestPath("/private/tmp/private.txt")], {
			list: async () => ({ entries: [{ path: testPath }] }),
			trash,
			thumbnailPath: (p) => p + ".png",
		}),
	).rejects.toThrow("not in the library");
	expect(trash).not.toHaveBeenCalled();
});
it("trashes only selected project files, deduplicates paths, and reports partial failures", async () => {
	const trash = vi.fn(async (p: string) => {
		if (p.endsWith("b.recordly")) throw Error("locked");
	});
	const pathA = getTestPath("/private/tmp/a.recordly");
	const pathB = getTestPath("/private/tmp/b.recordly");
	const result = await trashLibraryProjects(
		[pathA, pathA, pathB],
		{
			list: async () => ({
				entries: [{ path: pathA }, { path: pathB }],
			}),
			trash,
			thumbnailPath: (p) => p + ".missing.png",
		},
	);
	// On Windows, paths get fully qualified. Compare just the relative parts.
	expect(result.deleted).toHaveLength(1);
	expect(result.deleted[0]).toContain("a.recordly");
	expect(result.errors).toEqual(["Could not trash b.recordly"]);
	expect(trash.mock.calls.map(([p]) => p)).toHaveLength(2);
	expect(trash.mock.calls[0][0]).toContain("a.recordly");
	expect(trash.mock.calls[1][0]).toContain("b.recordly");
});
