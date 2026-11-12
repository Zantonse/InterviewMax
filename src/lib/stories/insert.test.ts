import { describe, expect, it } from "vitest";
import { applyInsert } from "./insert";

describe("applyInsert", () => {
  it("adds a starter at the end, once", () => {
    expect(applyInsert("", { text: "I led it. ", n: 1 })).toBe("I led it. ");
    expect(applyInsert("Some notes", { text: "I led it. ", n: 1 })).toBe("Some notes\nI led it. ");
    expect(applyInsert("I led it. more", { text: "I led it. ", n: 2 })).toBe("I led it. more");
  });

  it("takes a starter out when it's tapped again", () => {
    expect(applyInsert("Some notes\nI led it. ", { text: "I led it. ", n: 2, remove: true })).toBe("Some notes");
    expect(applyInsert("I led it. and then", { text: "I led it. ", n: 2, remove: true })).toBe("and then");
    expect(applyInsert("other", { text: "I led it. ", n: 2, remove: true })).toBe("other");
  });

  it("swaps one pick for another in a one-pick row", () => {
    expect(
      applyInsert("At stake: Money.\nWe shipped", {
        text: "At stake: A deadline. ",
        replace: "At stake: Money. ",
        n: 3,
      }),
    ).toBe("We shipped\nAt stake: A deadline. ");
  });
});
