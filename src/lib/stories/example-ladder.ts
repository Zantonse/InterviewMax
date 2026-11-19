// One example story per field, shown climbing Level 1 to Level 3 (Craig, 2026-11-12, from the
// competitor and learning-methods review: people copy a shape far faster than they follow
// instructions, so beginners see a finished story before writing their own, and the help fades as
// they write more; see help-fade.ts).
//
// Each level is the whole story at that level, sentence by sentence. A sentence that's new at that
// level says what it adds, so the page can mark the change ("+ stakes", "+ your thinking"). The
// stories are made up and say so on screen: an example, never the user's facts.
//
// Plain data, safe to import in client components.

import type { FieldId } from "@/lib/field/fields";
import type { StoryLevel } from "./levels";

export type ExampleAdds = "stakes" | "your part" | "a number" | "your thinking" | "the lesson";

export type ExampleSentence = { text: string; adds?: ExampleAdds };

export type ExampleStory = {
  // The interview question the story answers.
  question: string;
  // The story at Level 1, 2 and 3.
  levels: readonly [ExampleSentence[], ExampleSentence[], ExampleSentence[]];
};

// What changes from one level to the next, in one line, for the level being shown.
export const LEVEL_CHANGE: Record<StoryLevel, string> = {
  1: "It happened: the events in order. Easy to follow, but it doesn't show what was at stake or what you did yourself.",
  2: "It proves something: what was at stake, what you did yourself, and a result with a number.",
  3: "It shows how you think: the choice you faced, why you picked one option, and what you'd carry forward.",
};

const GENERIC: ExampleStory = {
  question: "Tell me about a time you improved how your team worked.",
  levels: [
    [
      { text: "We had a lot of overtime in the warehouse." },
      { text: "I looked at the schedules and changed how shifts were planned." },
      { text: "After that, things got better." },
    ],
    [
      {
        text: "Our warehouse was paying for about 300 overtime hours a month, and next year's budget assumed we'd cut it.",
        adds: "stakes",
      },
      {
        text: "I pulled six months of scan data and saw that our busiest hours didn't match when people were scheduled.",
        adds: "your part",
      },
      { text: "I rebuilt the shift plan around those peaks and moved 2 people to a split shift." },
      {
        text: "Overtime fell from about 300 hours a month to under 200 in the first quarter, going by payroll.",
        adds: "a number",
      },
    ],
    [
      {
        text: "Our warehouse was paying for about 300 overtime hours a month, and next year's budget assumed we'd cut it.",
      },
      {
        text: "I pulled six months of scan data and saw that our busiest hours didn't match when people were scheduled.",
      },
      {
        text: "I had two options: ask to hire 2 more people, or move the hours we already had. Hiring was easier to explain, but the data said we had enough people, just at the wrong times, so I moved the hours.",
        adds: "your thinking",
      },
      { text: "I rebuilt the shift plan around those peaks and moved 2 people to a split shift." },
      { text: "Overtime fell from about 300 hours a month to under 200 in the first quarter, going by payroll." },
      {
        text: "What I carry forward: look at when the work happens before asking for more people.",
        adds: "the lesson",
      },
    ],
  ],
};

const EXAMPLES: Partial<Record<FieldId, ExampleStory>> = {
  generic: GENERIC,
  sales_engineering: {
    question: "Tell me about a deal you helped win.",
    levels: [
      [
        { text: "We had a big prospect comparing us with a competitor." },
        { text: "I ran the proof of concept and it went well." },
        { text: "We won the deal." },
      ],
      [
        {
          text: "The deal was worth about $400K a year, and the customer had already run a pilot with our competitor.",
          adds: "stakes",
        },
        {
          text: "I cut the proof of concept down to the 3 integrations their security team cared about and built the demo environment myself.",
          adds: "your part",
        },
        {
          text: "We finished in 2 weeks instead of our usual 6, and they signed that quarter.",
          adds: "a number",
        },
      ],
      [
        {
          text: "The deal was worth about $400K a year, and the customer had already run a pilot with our competitor.",
        },
        {
          text: "I cut the proof of concept down to the 3 integrations their security team cared about and built the demo environment myself.",
        },
        {
          text: "Halfway in, their architect asked for a fourth integration. I could say yes and risk the timeline, or hold the scope. I held it, because their CISO had told us the decision rested on the first three, and I offered the fourth as a second phase.",
          adds: "your thinking",
        },
        { text: "We finished in 2 weeks instead of our usual 6, and they signed that quarter." },
        {
          text: "Since then, I agree the success criteria in writing before any proof of concept starts.",
          adds: "the lesson",
        },
      ],
    ],
  },
  data_governance: {
    question: "Tell me about a data problem you fixed at the root.",
    levels: [
      [
        { text: "Finance and sales reported different revenue numbers every month." },
        { text: "I traced the reports and got the teams to agree on one definition." },
        { text: "The problem went away." },
      ],
      [
        {
          text: "Finance and sales reported different revenue every month, and the CFO had stopped trusting either number.",
          adds: "stakes",
        },
        {
          text: "As the data steward for sales data, I traced both reports back and found they used two different customer tables.",
          adds: "your part",
        },
        { text: "I got both teams to agree on one customer definition and moved both reports to one table." },
        {
          text: "The monthly gap went from about $2M to zero, and the CFO dropped the monthly reconciliation meeting.",
          adds: "a number",
        },
      ],
      [
        {
          text: "Finance and sales reported different revenue every month, and the CFO had stopped trusting either number.",
        },
        {
          text: "As the data steward for sales data, I traced both reports back and found they used two different customer tables.",
        },
        {
          text: "I could fix the reports quietly in the warehouse, or get the teams to agree on the definition first. The quiet fix was faster, but without an agreed definition the next report would drift again, so I went for the agreement.",
          adds: "your thinking",
        },
        { text: "I got both teams to agree on one customer definition and moved both reports to one table." },
        {
          text: "The monthly gap went from about $2M to zero, and the CFO dropped the monthly reconciliation meeting.",
        },
        { text: "Now I settle the definition before I touch the data.", adds: "the lesson" },
      ],
    ],
  },
  product_design: {
    question: "Tell me about a design you changed because of research.",
    levels: [
      [
        { text: "A lot of people dropped off in our sign-up flow." },
        { text: "I did some research and redesigned it." },
        { text: "Sign-ups went up." },
      ],
      [
        {
          text: "About 60% of people who started our sign-up flow never finished it, and growth was the team's main goal that half.",
          adds: "stakes",
        },
        {
          text: "I ran 8 user interviews and watched session recordings, and saw people stall on the step that asked for company size.",
          adds: "your part",
        },
        { text: "I redesigned the flow to ask for it later, after people had seen the product." },
        { text: "Completion went from 40% to 58% in the first month.", adds: "a number" },
      ],
      [
        {
          text: "About 60% of people who started our sign-up flow never finished it, and growth was the team's main goal that half.",
        },
        {
          text: "I ran 8 user interviews and watched session recordings, and saw people stall on the step that asked for company size.",
        },
        {
          text: "The PM wanted to drop the question entirely. I pushed to move it instead, because sales used it to route leads, and cutting it would only move the problem to their team.",
          adds: "your thinking",
        },
        { text: "I redesigned the flow to ask for it later, after people had seen the product." },
        { text: "Completion went from 40% to 58% in the first month." },
        {
          text: "I learned to ask who depends on a field before I cut it.",
          adds: "the lesson",
        },
      ],
    ],
  },
  product_management: {
    question: "Tell me about a time you said no to a customer.",
    levels: [
      [
        { text: "A big customer asked for a custom feature." },
        { text: "I said no and we built something else." },
        { text: "It worked out." },
      ],
      [
        {
          text: "Our largest customer, about 15% of revenue, asked for a custom reporting feature and hinted they might not renew.",
          adds: "stakes",
        },
        {
          text: "I met their team, learned that what they needed was to get data into their own BI tool, and wrote the case for a general export instead.",
          adds: "your part",
        },
        {
          text: "We shipped the export in 5 weeks. They renewed, and 30 other customers used it in the first quarter.",
          adds: "a number",
        },
      ],
      [
        {
          text: "Our largest customer, about 15% of revenue, asked for a custom reporting feature and hinted they might not renew.",
        },
        {
          text: "I met their team, learned that what they needed was to get data into their own BI tool, and wrote the case for a general export instead.",
        },
        {
          text: "Building exactly what they asked for was the safe answer with sales, but it would serve one customer and cost us a quarter. The export solved their problem and other customers' too, so I picked it.",
          adds: "your thinking",
        },
        {
          text: "We shipped the export in 5 weeks. They renewed, and 30 other customers used it in the first quarter.",
        },
        {
          text: "Now I ask for the job behind a request before I say yes or no.",
          adds: "the lesson",
        },
      ],
    ],
  },
  software_engineering: {
    question: "Tell me about a hard technical problem you solved.",
    levels: [
      [
        { text: "Our API was slow." },
        { text: "I found the problem and fixed it." },
        { text: "It got much faster." },
      ],
      [
        {
          text: "Our checkout API slowed to about 3 seconds at peak, and the mobile team was seeing carts abandoned.",
          adds: "stakes",
        },
        {
          text: "I profiled it and found one query running once for every item in the cart.",
          adds: "your part",
        },
        { text: "I rewrote it as a single batched query and added an index." },
        { text: "Peak latency dropped from 3 seconds to 300 milliseconds.", adds: "a number" },
      ],
      [
        {
          text: "Our checkout API slowed to about 3 seconds at peak, and the mobile team was seeing carts abandoned.",
        },
        { text: "I profiled it and found one query running once for every item in the cart." },
        {
          text: "The team suggested a cache, which would ship in a day; fixing the query would take a week. I chose the query, because a cache would hide the problem and serve stale prices.",
          adds: "your thinking",
        },
        { text: "I rewrote it as a single batched query and added an index." },
        { text: "Peak latency dropped from 3 seconds to 300 milliseconds." },
        { text: "Now I profile before I propose a fix.", adds: "the lesson" },
      ],
    ],
  },
  sales: {
    question: "Tell me about a deal you turned around.",
    levels: [
      [
        { text: "A deal I was working on stalled." },
        { text: "I found a new contact and got it moving again." },
        { text: "We closed it." },
      ],
      [
        {
          text: "A $250K deal had gone quiet for 6 weeks, with 3 weeks left in the quarter.",
          adds: "stakes",
        },
        {
          text: "I found out our champion had moved teams, so I asked her to introduce me to the new budget owner and rebuilt the business case around his goals.",
          adds: "your part",
        },
        {
          text: "We closed 10 days later at $230K, which put me at 104% of quota.",
          adds: "a number",
        },
      ],
      [
        { text: "A $250K deal had gone quiet for 6 weeks, with 3 weeks left in the quarter." },
        {
          text: "My manager wanted to offer a discount to force a decision. I held off, because the deal hadn't stalled on price: it had stalled because nobody owned it any more.",
          adds: "your thinking",
        },
        {
          text: "I found out our champion had moved teams, so I asked her to introduce me to the new budget owner and rebuilt the business case around his goals.",
        },
        { text: "We closed 10 days later at $230K, which put me at 104% of quota." },
        {
          text: "Now I keep at least two contacts on every deal over $100K.",
          adds: "the lesson",
        },
      ],
    ],
  },
  customer_success: {
    question: "Tell me about a customer you kept from leaving.",
    levels: [
      [
        { text: "One of my accounts was unhappy and wanted to leave." },
        { text: "I worked with them on their issues." },
        { text: "They stayed." },
      ],
      [
        {
          text: "A $120K account told us they wouldn't renew after two outages in one month.",
          adds: "stakes",
        },
        {
          text: "I set up weekly calls, brought in an engineer for their top 3 issues, and sent a written status every Friday.",
          adds: "your part",
        },
        {
          text: "All 3 issues were closed in 6 weeks, and they renewed for 2 years.",
          adds: "a number",
        },
      ],
      [
        { text: "A $120K account told us they wouldn't renew after two outages in one month." },
        {
          text: "They asked for a credit. I could offer it right away or fix the issues first. I thought a credit up front would read as paying them to stay, so I fixed things first and offered it afterwards as a thank-you.",
          adds: "your thinking",
        },
        {
          text: "I set up weekly calls, brought in an engineer for their top 3 issues, and sent a written status every Friday.",
        },
        { text: "All 3 issues were closed in 6 weeks, and they renewed for 2 years." },
        {
          text: "I learned that an unhappy customer wants to see a plan before they want money.",
          adds: "the lesson",
        },
      ],
    ],
  },
  finance: {
    question: "Tell me about a time you found a problem in the numbers.",
    levels: [
      [
        { text: "I noticed our forecast was off." },
        { text: "I looked into it and fixed the model." },
        { text: "The forecast got more accurate." },
      ],
      [
        {
          text: "Our quarterly forecast had missed actual spend by about 12% three quarters running, and the board had started asking why.",
          adds: "stakes",
        },
        {
          text: "I traced the miss to cloud costs, which the model grew at a flat rate even though usage grew with customers.",
          adds: "your part",
        },
        { text: "I rebuilt that line to scale with customer count." },
        { text: "The next quarter's forecast landed within 2% of actuals.", adds: "a number" },
      ],
      [
        {
          text: "Our quarterly forecast had missed actual spend by about 12% three quarters running, and the board had started asking why.",
        },
        {
          text: "I traced the miss to cloud costs, which the model grew at a flat rate even though usage grew with customers.",
        },
        {
          text: "We could pad the forecast, as we had before, or rebuild the driver. Padding was quicker, but it would hide the real cause from the people making hiring plans, so I rebuilt it.",
          adds: "your thinking",
        },
        { text: "I rebuilt that line to scale with customer count." },
        { text: "The next quarter's forecast landed within 2% of actuals." },
        {
          text: "Now I check that every big line in a model has a real driver behind it.",
          adds: "the lesson",
        },
      ],
    ],
  },
};

// The example for the user's field; the general one for no field or a field without its own.
export function exampleStoryFor(field: FieldId | null | undefined): ExampleStory {
  return (field && EXAMPLES[field]) || GENERIC;
}

// The fields that have their own example (for tests).
export const FIELDS_WITH_EXAMPLES = Object.keys(EXAMPLES) as FieldId[];
