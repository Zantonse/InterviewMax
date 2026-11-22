// AI product names, spelled the way their makers spell them. Craig (Nov 21): the app should know
// Claude, ChatGPT and the rest, not write "cloud code". Three layers:
// - AI_NAMES_HINT: a short sentence sent to the speech-to-text model as its prompt, which nudges
//   Whisper toward these spellings (it otherwise hears "Claude" as "cloud").
// - fixAiNames: swaps the usual mishearings for the right name, in code, on every mic piece and
//   pasted interview transcript. Only fixes that can't hit an everyday word: "cloud" on its own
//   stays "cloud" unless it sits next to "code", a Claude model name or another AI tool.
// - AI_NAMES_LINE: one line at the end of every chat step's system prompt (see ai/index.ts).

// Sent as the transcription prompt. Whisper copies the spelling and style of its prompt, so this is
// a plain sentence, not a list. Never contains anything about the user.
export const AI_NAMES_HINT =
  "I use AI tools like Claude, Claude Code, ChatGPT, Gemini, GitHub Copilot, Cursor, Perplexity, NotebookLM and Midjourney, from OpenAI, Anthropic and Google.";

export const AI_NAMES_LINE = `AI product names: spell them the way their makers do: Claude, Claude Code, ChatGPT, GPT, OpenAI, Anthropic, Gemini, GitHub Copilot, Microsoft Copilot, Cursor, Perplexity, Midjourney, NotebookLM, DeepSeek, LangChain. Never turn one into a lookalike word ("Claude" is not "cloud"). The user's words may come from speech to text, so in a sentence about AI tools "cloud", "clawed" or "Claud" means Claude, "cloud code" means Claude Code and "chat GBT" means ChatGPT: write the right name, except inside a quote you must copy word for word.`;

// Adds the AI names line to a system prompt.
export function withAiNames(system: string | undefined): string {
  return system ? `${system}\n\n${AI_NAMES_LINE}` : AI_NAMES_LINE;
}

// How speech to text tends to write "Claude".
const CLAUDE_HEARD = String.raw`(?:cloud|clawed|claud|clod|klod|clawd|claude)`;

// Names "cloud" may sit next to in a list of tools ("ChatGPT and cloud").
const OTHER_TOOLS = String.raw`(?:ChatGPT|GPT(?:-?\d[\w.]*)?|Gemini|Copilot|Cursor|Perplexity|OpenAI|DeepSeek|Midjourney|NotebookLM|Llama|Mistral|Grok)`;

// Words that make "cloud" mean cloud computing, even next to an AI tool ("Gemini and cloud storage").
const CLOUD_NOUN = String.raw`(?![\s-]+(?:storage|computing|infrastructure|services?|platforms?|providers?|migrations?|costs?|native|based|console|functions?|run|data|hosting|security|accounts?|environments?|resources|spend|vendors?|tools|apps?|software|products?|solutions?|engineering|engineers?|architecture|teams?|credits?|bills?|budgets?|deployments?|servers?|regions?)\b)`;

const LIST_JOIN = String.raw`(\s*(?:,|\/|&|\band\b|\bor\b|\bplus\b)\s*)`;

type Fix = [RegExp, string | ((...m: string[]) => string)];

const FIXES: Fix[] = [
  // ChatGPT first, so "cloud" can be checked against it below.
  [/\bcha[td][\s-]*(?:g[\s.-]*[pb][\s.-]*[td]|gpt|gbt|gpd|gbd)\b/gi, "ChatGPT"],
  [/\bopen[\s-]ai\b/gi, "OpenAI"],
  [/\bopenai\b/gi, "OpenAI"],
  [/\b(?:an|and)[\s-]?thropic\b/gi, "Anthropic"],
  [/\banthropic\b/gi, "Anthropic"],
  [/\bgit[\s-]hub\b/gi, "GitHub"],
  [/\bgithub\b/gi, "GitHub"],
  [
    /\b(GitHub|Microsoft|M365|Office|Windows|Bing)[\s-]+co[\s-]?pilot\b/gi,
    "$1 Copilot",
  ],
  [/\bgemini\b/g, "Gemini"],
  [/\bchatgpt\b/gi, "ChatGPT"],
  [/\bgpt(?=-?\d|\b)/gi, "GPT"],
  [/\bmid[\s-]?journey\b/gi, "Midjourney"],
  [/\bnotebook[\s-]?l\.?[\s-]?m\b/gi, "NotebookLM"],
  [/\bdeep[\s-]?seek\b/gi, "DeepSeek"],
  [/\blang[\s-]?chain\b/gi, "LangChain"],
  [/\blang[\s-]?graph\b/gi, "LangGraph"],
  [/\bllama[\s-]?index\b/gi, "LlamaIndex"],
  [/\bhugging[\s-]face\b/gi, "Hugging Face"],
  // "Claude Code", unless it's Google Cloud Code (a real product).
  [new RegExp(String.raw`(?<!\bgoogle\s)\b${CLAUDE_HEARD}[\s-]+code\b`, "gi"), "Claude Code"],
  // "Claude Opus", "Claude Sonnet", "Claude Haiku".
  [
    new RegExp(String.raw`\b${CLAUDE_HEARD}[\s-]+(opus|sonnet|haiku)\b`, "gi"),
    (_m, model: string) => `Claude ${model[0].toUpperCase()}${model.slice(1).toLowerCase()}`,
  ],
  [/\b(?:cloud|claude)(?:\s*\.\s*|\s+dot\s+)ai\b/gi, "claude.ai"],
  [/\b(Anthropic's|Anthropic)\s+cloud\b/g, "$1 Claude"],
  [/\bcloud(\s+(?:by|from)\s+Anthropic)\b/gi, "Claude$1"],
  // "cloud" in a list of AI tools, either side: "ChatGPT and cloud", "cloud, Gemini".
  [new RegExp(String.raw`\b(${OTHER_TOOLS})${LIST_JOIN}cloud\b${CLOUD_NOUN}`, "g"), "$1$2Claude"],
  [new RegExp(String.raw`\bcloud${LIST_JOIN}(${OTHER_TOOLS})\b`, "g"), "Claude$1$2"],
  // Spellings that are never another word.
  [/\b(?:claud|clawd|klod)\b/gi, "Claude"],
  [/\bclaude\b(?!\.ai\b)/g, "Claude"],
];

// Puts the right spelling on AI product names in text written down by speech to text (or pasted
// from a meeting tool's transcript). Leaves everything else as it was.
export function fixAiNames(text: string): string {
  let out = text;
  for (const [pattern, replacement] of FIXES) {
    out = out.replace(pattern, replacement as string);
  }
  return out;
}

// Whisper sometimes writes its prompt back when a piece has no real words in it. Drops it.
export function dropEchoedHint(text: string): string {
  return text.split(AI_NAMES_HINT).join(" ").replace(/\s{2,}/g, " ").trim();
}
