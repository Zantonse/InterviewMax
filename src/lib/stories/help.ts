// Help for a builder question the user is stuck on, in plain code (no model call):
//   "Show me a good answer": a short made-up example of what a strong answer covers, so people
//     see the shape before writing their own. Examples are generic on purpose; they're never
//     their facts and never reach the writer.
//   "I don't know this": where they could find it, and that a labelled estimate is fine.
// Keyed by the gap a follow-up is aimed at, or the part a scripted question fills.

export type QuestionHelp = { example: string; whereToLook?: string };

const HELP: Record<string, QuestionHelp> = {
  // The opening "tell it your way" question of a behavioral story.
  telling: {
    example:
      "Rough notes are fine, like: \"Last spring at my old company, our biggest customer threatened to leave over slow support. I was the account lead. I pulled their tickets, found most were the same 3 setup problems, and got our support lead to write fixes for them. Took about a month. Tickets dropped by half and they renewed. Lesson: look at the pattern before promising more people.\"",
  },
  situation: {
    example:
      "\"We were 6 weeks from launch and the vendor pulled out. If we slipped, we'd miss the trade show where most of our yearly leads come from.\"",
    whereToLook:
      "Think about what would have happened if it went badly: a customer lost, a deadline missed, money or time wasted. A rough sense is enough.",
  },
  context: {
    example:
      "\"I'd been on the team about a year, running 12 enterprise accounts, when the biggest one asked to cancel.\"",
  },
  ownership: {
    example:
      "\"The team built it, but I owned the plan: I picked the order we'd fix things in and ran the weekly check-in with the customer.\"",
    whereToLook:
      "Ask yourself what would not have happened without you. That part is yours, even if a team did the rest.",
  },
  role: {
    example:
      "\"I was the project lead, with 2 engineers and a designer, and no extra budget.\"",
  },
  actions: {
    example:
      "\"First I sat in on 5 support calls to see the problem myself. Then I wrote a one-page fix plan and got sign-off from both team leads in one meeting.\"",
    whereToLook:
      "Walk through it in order: what you did first, what came next, and what you changed when something didn't work.",
  },
  decision: {
    example:
      "\"I could delay the launch or cut two features. I cut the features, because the customer cared about the date more than the extras, and I watched sign-ups in week one to know if I'd called it wrong.\"",
    whereToLook:
      "Think of the moment you had to choose. What else could you have done, and why didn't you?",
  },
  result: {
    example:
      "\"Response time went from 3 days to under 1, and the customer renewed for 2 more years. That's about $400K a year (my estimate).\"",
    whereToLook:
      "Look in a dashboard or CRM, a performance review, an old email or announcement, or ask a former manager. A labelled estimate (\"about 20%, my estimate\") is fine.",
  },
  reflection: {
    example:
      "\"I learned to check what the customer measures before promising a fix. Next time I'd ask that in the first call.\"",
    whereToLook:
      "What would you do differently if it happened again tomorrow? One specific thing is enough.",
  },
  detail: {
    example:
      "\"The customer's VP printed our dashboard and pinned it on her wall.\"",
    whereToLook: "Picture the moment it turned. What did someone say, or what did you see?",
  },
  // "Tell me about yourself".
  present: {
    example:
      "\"I'm a sales engineer at a data software company, supporting 8 account executives across the West Coast.\"",
  },
  path: {
    example:
      "\"I started in support, moved into sales engineering after customers kept asking for me on calls, and I've been there 4 years.\"",
    whereToLook: "Your resume or LinkedIn has the order. Just pick the move that mattered most.",
  },
  highlight: {
    example:
      "\"I built a demo kit the whole team now uses; it cut prep time from a day to about an hour (my estimate).\"",
    whereToLook:
      "Look in a performance review, an award email or a dashboard. A labelled estimate is fine.",
  },
  strengths: {
    example:
      "\"People come to me when a deal is stuck on a technical question. Last quarter that was about 10 deals.\"",
    whereToLook: "Think of what a colleague would say if someone asked them what you're good at.",
  },
  next: {
    example:
      "\"I want to move into product, because the part of my job I like most is turning customer problems into what we build.\"",
  },
};

export function questionHelp(key: string | undefined): QuestionHelp | undefined {
  return key ? HELP[key] : undefined;
}

// Generic, for gaps without their own advice.
export const DEFAULT_WHERE_TO_LOOK =
  "If it's a number, check a dashboard, a performance review or an old email, or ask a former manager. A labelled estimate is fine. If you really don't know, skip it and I'll leave it out.";
