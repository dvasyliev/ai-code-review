import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Interaction tests for the calculator.
 *
 * Assertions still marked BUG pin the behaviour the component has today, not
 * the behaviour a user would expect. They are here so the suite is green and
 * the defect is visible; flip them when the corresponding fix lands.
 */

const display = () => screen.getByRole("status").textContent;

const key = (name: string) => screen.getByRole("button", { name });

function setup() {
  const user = userEvent.setup();
  render(<App />);
  return {
    user,
    press: async (...names: string[]) => {
      for (const name of names) await user.click(key(name));
    },
  };
}

/** Fast path for sequences with hundreds of presses. */
function bulk(name: string, times: number) {
  const button = key(name);
  for (let i = 0; i < times; i++) fireEvent.click(button);
}

describe("digit and decimal input", () => {
  it("starts at 0", () => {
    render(<App />);
    expect(display()).toBe("0");
  });

  it("appends digits left to right", async () => {
    const { press } = setup();
    await press("1", "2", "3");
    expect(display()).toBe("123");
  });

  it("starts a decimal from 0 when '.' is the first press", async () => {
    const { press } = setup();
    await press(".");
    expect(display()).toBe("0.");
  });

  it("builds a decimal number", async () => {
    const { press } = setup();
    await press("1", ".", "5");
    expect(display()).toBe("1.5");
  });

  it("ignores a second decimal point", async () => {
    const { press } = setup();
    await press("1", ".", "5", ".", "2");
    expect(display()).toBe("1.52");
  });

  it("collapses leading zeros — '0','0','5' shows 5", async () => {
    const { press } = setup();
    await press("0", "0", "5");
    expect(display()).toBe("5");
  });

  it("C resets the display and any pending operation", async () => {
    const { press } = setup();
    await press("7", "+", "8", "C");
    expect(display()).toBe("0");
    await press("=");
    expect(display()).toBe("0");
  });
});

describe("binary operations", () => {
  it("adds", async () => {
    const { press } = setup();
    await press("2", "+", "3", "=");
    expect(display()).toBe("5");
  });

  it("subtracts", async () => {
    const { press } = setup();
    await press("9", "-", "4", "=");
    expect(display()).toBe("5");
  });

  it("multiplies", async () => {
    const { press } = setup();
    await press("6", "×", "7", "=");
    expect(display()).toBe("42");
  });

  it("divides", async () => {
    const { press } = setup();
    await press("8", "÷", "2", "=");
    expect(display()).toBe("4");
  });

  it("raises to a power", async () => {
    const { press } = setup();
    await press("2", "x^y", "1", "0", "=");
    expect(display()).toBe("1024");
  });

  it("treats % as 'b percent of a'", async () => {
    const { press } = setup();
    await press("5", "0", "%", "1", "0", "=");
    expect(display()).toBe("5");
  });

  it("highlights the pending operator", async () => {
    const { press } = setup();
    await press("5", "+");
    expect(key("+").className).toContain("ring-2");
    await press("3");
    expect(key("+").className).not.toContain("ring-2");
  });
});

describe("unary operations", () => {
  it("takes a square root", async () => {
    const { press } = setup();
    await press("9", "√");
    expect(display()).toBe("3");
  });

  it("negates", async () => {
    const { press } = setup();
    await press("5", "+/-");
    expect(display()).toBe("-5");
  });

  it("negating 0 shows 0, not -0", async () => {
    const { press } = setup();
    await press("0", "+/-");
    expect(display()).toBe("0");
  });

  it("BUG: +/- drops a trailing decimal point — '5.' then +/- then '2' gives -52", async () => {
    const { press } = setup();
    await press("5", ".", "+/-", "2");
    expect(display()).toBe("-52"); // a user typing 5 . +/- 2 means -5.2
  });

  it("+/- after '=' keeps the negated result as an editable entry", async () => {
    const { press } = setup();
    await press("2", "+", "3", "=", "+/-");
    expect(display()).toBe("-5");
    await press("7");
    expect(display()).toBe("-57"); // the digit extends -5 instead of discarding it
  });
});

describe("chaining", () => {
  it("applies a pending operation when a second operator is pressed", async () => {
    const { press } = setup();
    await press("2", "+", "3", "+", "4", "=");
    expect(display()).toBe("9");
  });

  it("continues from the previous result", async () => {
    const { press } = setup();
    await press("2", "+", "3", "=", "+", "4", "=");
    expect(display()).toBe("9");
  });

  it("BUG: the intermediate result is never shown — 2 ÷ 3 × leaves 3 on screen", async () => {
    const { press } = setup();
    await press("2", "÷", "3", "×");
    expect(display()).toBe("3"); // stored is 0.666…, the display never says so
  });

  it("BUG: pressing = twice does not repeat the operation", async () => {
    const { press } = setup();
    await press("2", "+", "3", "=", "=");
    expect(display()).toBe("5"); // most calculators give 8
  });

  it("BUG: '50 + 10 %' folds the addition first, so = gives 10% of 60", async () => {
    const { press } = setup();
    await press("5", "0", "+", "1", "0", "%", "=");
    expect(display()).toBe("6");
  });
});

describe("error states", () => {
  it("division by zero shows Error", async () => {
    const { press } = setup();
    await press("5", "÷", "0", "=");
    expect(display()).toBe("Error");
  });

  it("square root of a negative shows Error", async () => {
    const { press } = setup();
    await press("5", "+/-", "√");
    expect(display()).toBe("Error");
  });

  it("a digit starts a fresh entry after Error", async () => {
    const { press } = setup();
    await press("5", "÷", "0", "=", "7");
    expect(display()).toBe("7");
  });

  it("√ on Error stays Error — the a < 0 guard does not catch NaN", async () => {
    const { press } = setup();
    await press("5", "÷", "0", "=", "√");
    expect(display()).toBe("Error");
  });

  it("an operator after Error clears the pending state", async () => {
    const { press } = setup();
    await press("5", "÷", "0", "=", "+");
    expect(display()).toBe("Error"); // the operator is swallowed, not queued
    await press("2", "=");
    expect(display()).toBe("2"); // nothing pending, so = just keeps the entry
  });

  it("a failed √ discards the pending operation", async () => {
    const { press } = setup();
    await press("9", "+", "5", "+/-", "√");
    expect(display()).toBe("Error");
    await press("7", "=");
    expect(display()).toBe("7"); // the 9 + did not survive the error
  });

  it("0 ^ -1 is Infinity and surfaces as the same generic Error", async () => {
    const { press } = setup();
    await press("0", "x^y", "1", "+/-", "=");
    expect(display()).toBe("Error");
  });

  it("(-8) ^ 0.5 is NaN and surfaces as the same generic Error", async () => {
    const { press } = setup();
    await press("8", "+/-", "x^y", "0", ".", "5", "=");
    expect(display()).toBe("Error");
  });
});

describe("rounding and float precision", () => {
  it("rounds away the classic 0.1 + 0.2 artefact", async () => {
    const { press } = setup();
    await press("0", ".", "1", "+", "0", ".", "2", "=");
    expect(display()).toBe("0.3");
  });

  it("rounds 1.005 up — the 100.49999999999999 artefact is normalised away", async () => {
    const { press } = setup();
    await press("1", ".", "0", "0", "5", "+", "0", "=");
    expect(display()).toBe("1.01");
  });

  it("rounds 8.165 up", async () => {
    const { press } = setup();
    await press("8", ".", "1", "6", "5", "+", "0", "=");
    expect(display()).toBe("8.17");
  });

  it("BUG: 0.001 + 0 gives 0 — anything under half a cent is erased", async () => {
    const { press } = setup();
    await press("0", ".", "0", "0", "1", "+", "0", "=");
    expect(display()).toBe("0");
  });

  it("BUG: 0.07 % 1 gives 0", async () => {
    const { press } = setup();
    await press("0", ".", "0", "7", "%", "1", "=");
    expect(display()).toBe("0"); // by hand: 0.0007
  });

  it("BUG: 1 ÷ 3 × 3 gives 0.99", async () => {
    const { press } = setup();
    await press("1", "÷", "3", "=");
    expect(display()).toBe("0.33");
    await press("×", "3", "=");
    expect(display()).toBe("0.99"); // by hand: 1
  });

  it("caps entry at 15 digits and carries that value through round2 unchanged", async () => {
    const { press } = setup();
    await press(
      "9", "9", "9", "9", "9", "9", "9", "9", "9", "9", "9", "9", "9", "9",
      ".", "9", "9",
      "+", "0", "=",
    );
    expect(display()).toBe("99999999999999.9"); // the 16th digit never lands
  });
});

describe("overflow and near-zero guards", () => {
  it("an entry cannot overflow — extra digits are ignored past 15", async () => {
    const { press } = setup();
    // 400 presses, but only the first 15 digits are accepted
    bulk("9", 400);
    expect(display()).toBe("999999999999999");
    await press("+", "1", "=");
    expect(display()).toBe("1000000000000000");
  });

  it("+/- on a maxed-out entry stays finite", async () => {
    setup();
    bulk("9", 400);
    fireEvent.click(key("+/-"));
    expect(display()).toBe("-999999999999999");
  });

  it("a denormal divisor cannot be entered — the digit cap turns it into 0", async () => {
    const { press } = setup();
    await press("5", "÷", "0", ".");
    bulk("0", 320);
    await press("1", "=");
    expect(display()).toBe("Error"); // caught by the b === 0 divisor guard
  });
});

describe("history panel", () => {
  it("is hidden until Hist is pressed", async () => {
    const { press } = setup();
    await press("2", "+", "3", "=");
    expect(screen.queryByText("2 + 3 = 5")).toBeNull();
    await press("Hist");
    expect(screen.getByText("2 + 3 = 5")).toBeInTheDocument();
  });

  it("toggles back off", async () => {
    const { press } = setup();
    await press("2", "+", "3", "=", "Hist", "Hist");
    expect(screen.queryByText("2 + 3 = 5")).toBeNull();
  });

  it("keeps only the last five entries", async () => {
    const { press } = setup();
    await press("4", "√", "√", "√", "√", "√", "√", "Hist");
    expect(screen.queryByText("√4 = 2")).toBeNull();
    expect(screen.getByText("√2 = 1.41")).toBeInTheDocument();
    expect(screen.getByText("√1.04 = 1.02")).toBeInTheDocument();
  });

  it("BUG: +/- writes an arithmetic-looking entry into history", async () => {
    const { press } = setup();
    await press("5", "+/-", "Hist");
    expect(screen.getByText("+/-5 = -5")).toBeInTheDocument();
  });

  it("logs the rounded intermediate operand", async () => {
    const { press } = setup();
    await press("2", "÷", "3", "×", "3", "=", "Hist");
    expect(screen.getByText("0.67 × 3 = 2.01")).toBeInTheDocument();
  });
});
