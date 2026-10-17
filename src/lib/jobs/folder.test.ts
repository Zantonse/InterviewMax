import { describe, expect, it } from "vitest";
import type { LikelyQuestion } from "@/lib/questions/content";
import { getTheme } from "@/lib/questions/themes";
import { emptyContent } from "@/lib/stories/content";
import { folderLabel, jobFolder } from "./folder";

function question(theme: string, text: string): LikelyQuestion {
  return { question: text, theme, why: "", source: "posting", specific: false } as LikelyQuestion;
}

describe("job folder", () => {
  it("groups the job's likely questions under the stories that answer them", () => {
    const conflict = getTheme("conflict")!;
        const stories = [
      { id: "s1", title: "Winning over the stewards", storyType: conflict.storyTypes[0], content: emptyContent() },
    ];
    const folder = jobFolder(
      [
        question("conflict", "Tell me about a disagreement."),
        question("conflict", "A time you pushed back?"),
        question("failure", "Tell me about a time you failed."),
      ],
      stories,
    );
    expect(folder.stories).toHaveLength(1);
    expect(folder.stories[0]).toMatchObject({ storyId: "s1", drafted: false });
    expect(folder.stories[0].questions).toHaveLength(2);
    expect(folder.answered).toBe(2);
    expect(folder.toBuild).toBe(1);
    expect(folder.total).toBe(3);
    expect(jobFolder(undefined, stories)).toMatchObject({ stories: [], answered: 0, total: 0 });
  });

  it("labels a folder company first", () => {
    expect(folderLabel({ title: "Data lead", company: "Commerce Bank" })).toBe("Commerce Bank · Data lead");
    expect(folderLabel({ title: "Data lead", company: null })).toBe("Data lead");
  });
});
