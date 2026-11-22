import { describe, expect, it } from "vitest";
import { AI_NAMES_HINT, AI_NAMES_LINE, dropEchoedHint, fixAiNames, withAiNames } from "./ai-names";

describe("fixAiNames", () => {
  it.each([
    ["I built it in cloud code over a weekend", "I built it in Claude Code over a weekend"],
    ["I use Clawed Code for refactors", "I use Claude Code for refactors"],
    ["We moved to cloud opus for the hard cases", "We moved to Claude Opus for the hard cases"],
    ["I draft with chat GPT", "I draft with ChatGPT"],
    ["chat GBT and cloud for first drafts", "ChatGPT and Claude for first drafts"],
    ["cloud, Gemini and Copilot", "Claude, Gemini and Copilot"],
    ["ChatGPT or cloud.", "ChatGPT or Claude."],
    ["github co-pilot writes my tests", "GitHub Copilot writes my tests"],
    ["Microsoft co-pilot in Teams", "Microsoft Copilot in Teams"],
    ["models from open AI and and thropic", "models from OpenAI and Anthropic"],
    ["Anthropic's cloud model", "Anthropic's Claude model"],
    ["I asked claude to check it", "I asked Claude to check it"],
    ["I asked Claud to check it", "I asked Claude to check it"],
    ["notebook LM and mid journey", "NotebookLM and Midjourney"],
    ["gpt-5 and gemini", "GPT-5 and Gemini"],
    ["I opened cloud dot ai", "I opened claude.ai"],
    ["deep seek and lang chain", "DeepSeek and LangChain"],
  ])("%s", (input, expected) => {
    expect(fixAiNames(input)).toBe(expected);
  });

  it.each([
    "We moved everything to the cloud last year.",
    "Our cloud costs went down 30%.",
    "I used ChatGPT and cloud storage for the files.",
    "Gemini and cloud computing are both on the roadmap.",
    "We tried Google Cloud Code for the plugin.",
    "Cursor is in the top left of the screen.",
    "He was the co-pilot on the launch.",
    "The cat clawed the couch.",
  ])("leaves everyday words alone: %s", (input) => {
    expect(fixAiNames(input)).toBe(input);
  });
});

describe("hint and prompt line", () => {
  it("drops the hint when Whisper writes it back", () => {
    expect(dropEchoedHint(AI_NAMES_HINT)).toBe("");
    expect(dropEchoedHint(`${AI_NAMES_HINT} I set it up.`)).toBe("I set it up.");
    expect(dropEchoedHint("I set it up.")).toBe("I set it up.");
  });

  it("adds the names line to any system prompt", () => {
    expect(withAiNames("Be brief.")).toBe(`Be brief.\n\n${AI_NAMES_LINE}`);
    expect(withAiNames(undefined)).toBe(AI_NAMES_LINE);
    expect(AI_NAMES_LINE).toContain("Claude Code");
  });
});
