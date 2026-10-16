// A guide to where people usually find their numbers, for the top of the numbers page, and what
// to try when one number's own "where to find it" doesn't work (no access any more, never
// tracked). Plain text, no model call. It names places to look only; it never suggests a value.

export type SourceGroup = { title: string; places: string[] };

export const NUMBER_SOURCES: SourceGroup[] = [
  {
    title: "Things you've already written",
    places: [
      "Performance reviews and self-reviews",
      "Promotion write-ups and goal or OKR docs",
      "Your resume, LinkedIn and old cover letters",
    ],
  },
  {
    title: "Work tools",
    places: [
      "Dashboards and BI reports",
      "CRM or sales reports",
      "Jira or other project trackers",
      "Quarterly or business review decks",
    ],
  },
  {
    title: "Your inbox and chat",
    places: [
      "Search email and Slack for the project name",
      "Launch, win or “thank you” announcements",
      "Your calendar, to count meetings, customers or weeks",
    ],
  },
  {
    title: "People",
    places: [
      "A former manager or teammate (a short message works)",
      "The ops, finance or analytics person who ran the report",
    ],
  },
];

// When the usual place doesn't have it.
export const CANT_FIND_STEPS = [
  "Left the company? Check what you saved, your reviews and resume, or message a former manager or teammate.",
  "Never tracked? Count it back: how many a week or a month, times how long.",
  "Still unsure? Give a range or a rough figure and say so.",
];

// Labelled estimates are honest; made-up precision isn't.
export const ESTIMATE_EXAMPLES = ["about 30", "20 to 25", "roughly doubled", "my estimate: $2M"];
