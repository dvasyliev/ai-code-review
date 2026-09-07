import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Interaction tests for the calculator.
 *
 * Assertions still marked BUG pin the behaviour the component has today, not
 * the behaviour a user would expect. They are here so the suite is green and
 * the defect is visible; flip them when the corresponding fix lands.
 */

function setup() {
  const user = userEvent.setup();
  const { container } = render(<App />);
  const ui = within(container);

  const keys = new Map<string, HTMLElement>();
  const key = (name: string) => {
    let button = keys.get(name);
    if (!button) {
      button = ui.getByRole("button", { name });
      keys.set(name, button);
    }
    return button;
  };

  const press = async (...names: string[]) => {
    for (const name of names) await user.click(key(name));
  };

  return {
    ui,
    key,
    press,
    display: () => ui.getByRole("status").textContent,
    /** Same input path as press, for sequences of many identical presses. */
    bulk: (name: string, times: number) =>
      press(...Array<string>(times).fill(name)),
  };
}

describe("digit and decimal input", () => {
  it("starts at 0", () => {
    const { display } = setup();
    expect(display()).toBe("0");
  });

  it("appends digits left to right", async () => {
    const { press, display } = setup();
    await press("1", "2", "3");
    expect(display()).toBe("123");
  });

  it("starts a decimal from 0 when '.' is the first press", async () => {
    const { press, display } = setup();
    await press(".");
    expect(display()).toBe("0.");
  });

  it("builds a decimal number", async () => {
    const { press, display } = setup();
    await press("1", ".", "5");
    expect(display()).toBe("1.5");
  });

  it("ignores a second decimal point", async () => {
    const { press, display } = setup();
    await press("1", ".", "5", ".", "2");
    expect(display()).toBe("1.52");
  });

  it("collapses a leading zero", async () => {
    const { press, display } = setup();
    await press("0", "0", "5");
    expect(display()).toBe("5");
  });

  it("caps entry at 15 digits", async () => {
    const { bulk, display } = setup();
    await bulk("9", 16);
    expect(display()).toBe("999999999999999");
  });

  it("BUG: at 15 digits the '.' press is silently dropped", async () => {
    const { press, bulk, display } = setup();
    await bulk("9", 15);
    await press(".", "5");
    expect(display()).toBe("999999999999999"); // no decimal, no feedback
  });

  it("C resets the display and any pending operation", async () => {
    const { press, display } = setup();
    await press("7", "+", "8", "C");
    expect(display()).toBe("0");
    await press("=");
    expect(display()).toBe("0");
  });
});

describe("binary operations", () => {
  const cases: [name: string, entry: string[], result: string][] = [
    ["adds", ["2", "+", "3"], "5"],
    ["subtracts", ["9", "-", "4"], "5"],
    ["multiplies", ["6", "×", "7"], "42"],
    ["divides", ["8", "÷", "2"], "4"],
    ["raises to a power", ["2", "x^y", "1", "0"], "1024"],
    ["treats % as 'b percent of a'", ["5", "0", "%", "1", "0"], "5"],
  ];

  it.each(cases)("%s", async (_name, entry, result) => {
    const { press, display } = setup();
    await press(...entry, "=");
    expect(display()).toBe(result);
  });

  it("highlights the pending operator until the next entry", async () => {
    const { press, key } = setup();
    await press("5", "+");
    expect(key("+").className).toContain("ring-2");
    await press("3");
    expect(key("+").className).not.toContain("ring-2");
  });
});

describe("unary operations", () => {
  it("takes a square root", async () => {
    const { press, display } = setup();
    await press("9", "√");
    expect(display()).toBe("3");
  });

  it("negates", async () => {
    const { press, display } = setup();
    await press("5", "+/-");
    expect(display()).toBe("-5");
  });

  it("negating 0 shows 0, not -0", async () => {
    const { press, display } = setup();
    await press("0", "+/-");
    expect(display()).toBe("0");
  });

  it("keeps appending after +/-", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "=", "+/-");
    expect(display()).toBe("-5");
    await press("7");
    expect(display()).toBe("-57");
  });

  it("BUG: +/- drops a trailing decimal point — '5.' +/- '2' gives -52", async () => {
    const { press, display } = setup();
    await press("5", ".", "+/-", "2");
    expect(display()).toBe("-52"); // the user meant -5.2
  });

  it("BUG: '.' then +/- then '5' gives 5, not -0.5", async () => {
    const { press, display } = setup();
    await press(".", "+/-", "5");
    expect(display()).toBe("5"); // String(-0) is "0", so the decimal is lost
  });
});

describe("chaining", () => {
  it("applies a pending operation when a second operator is pressed", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "+", "4", "=");
    expect(display()).toBe("9");
  });

  it("continues from the previous result", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "=", "+", "4", "=");
    expect(display()).toBe("9");
  });

  it("BUG: the intermediate result is never shown — 2 ÷ 3 × leaves 3 on screen", async () => {
    const { press, display } = setup();
    await press("2", "÷", "3", "×");
    expect(display()).toBe("3"); // stored is 0.67, the display never says so
  });

  it("BUG: rounding the intermediate breaks the chain — 2 ÷ 3 × 3 gives 2.01", async () => {
    const { press, display } = setup();
    await press("2", "÷", "3", "×", "3", "=");
    expect(display()).toBe("2.01"); // by hand: 2
  });

  it("BUG: pressing = twice does not repeat the operation", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "=", "=");
    expect(display()).toBe("5"); // most calculators give 8
  });

  it("BUG: '50 + 10 %' folds the addition first, so = gives 10% of 60", async () => {
    const { press, display } = setup();
    await press("5", "0", "+", "1", "0", "%", "=");
    expect(display()).toBe("6");
  });
});

describe("error states", () => {
  it("division by zero shows Error", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=");
    expect(display()).toBe("Error");
  });

  it("square root of a negative shows Error", async () => {
    const { press, display } = setup();
    await press("5", "+/-", "√");
    expect(display()).toBe("Error");
  });

  it("a digit starts a fresh entry after Error", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "7");
    expect(display()).toBe("7");
  });

  it("√ on Error stays Error", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "√");
    expect(display()).toBe("Error");
  });

  it("an operator after Error clears the pending state", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "+", "2", "=");
    expect(display()).toBe("2"); // the 2 is left standing, nothing is applied to it
  });

  it("a failed √ clears the pending operation", async () => {
    const { press, display } = setup();
    await press("9", "+", "5", "+/-", "√");
    expect(display()).toBe("Error");
    await press("7", "=");
    expect(display()).toBe("7");
  });

  it("0 ^ -1 is Infinity and surfaces as the same bare Error", async () => {
    const { press, display } = setup();
    await press("0", "x^y", "1", "+/-", "=");
    expect(display()).toBe("Error");
  });

  it("a non-finite intermediate errors on the next operator press, not on =", async () => {
    const { press, display } = setup();
    await press("0", "x^y", "1", "+/-", "+");
    expect(display()).toBe("Error");
  });

  it("(-8) ^ 0.5 is NaN and surfaces as the same bare Error", async () => {
    const { press, display } = setup();
    await press("8", "+/-", "x^y", "0", ".", "5", "=");
    expect(display()).toBe("Error");
  });
});

describe("rounding and float precision", () => {
  it("rounds away the classic 0.1 + 0.2 artefact", async () => {
    const { press, display } = setup();
    await press("0", ".", "1", "+", "0", ".", "2", "=");
    expect(display()).toBe("0.3");
  });

  it("rounds a positive half up: 1.005 + 0 gives 1.01", async () => {
    const { press, display } = setup();
    await press("1", ".", "0", "0", "5", "+", "0", "=");
    expect(display()).toBe("1.01");
  });

  it("BUG: a negative half rounds the other way — -1.005 + 0 gives -1", async () => {
    const { press, display } = setup();
    await press("1", ".", "0", "0", "5", "+/-", "+", "0", "=");
    expect(display()).toBe("-1"); // by hand: -1.01
  });

  it("BUG: -8.165 + 0 gives -8.16 while 8.165 gives 8.17", async () => {
    const { press, display } = setup();
    await press("8", ".", "1", "6", "5", "+/-", "+", "0", "=");
    expect(display()).toBe("-8.16");
  });

  it("BUG: 0.001 + 0 gives 0 — anything under half a cent is erased", async () => {
    const { press, display } = setup();
    await press("0", ".", "0", "0", "1", "+", "0", "=");
    expect(display()).toBe("0");
  });

  it("BUG: 0.07 % 1 gives 0", async () => {
    const { press, display } = setup();
    await press("0", ".", "0", "7", "%", "1", "=");
    expect(display()).toBe("0"); // by hand: 0.0007
  });

  it("BUG: 1 ÷ 3 × 3 gives 0.99", async () => {
    const { press, display } = setup();
    await press("1", "÷", "3", "=");
    expect(display()).toBe("0.33");
    await press("×", "3", "=");
    expect(display()).toBe("0.99"); // by hand: 1
  });

  it("leaves results at or above 1e15 unrounded", async () => {
    const { press, bulk, display } = setup();
    await bulk("9", 15);
    await press("+", "1", "=");
    expect(display()).toBe("1000000000000000");
  });
});

describe("exponent-notation results", () => {
  it("BUG: a result shown in exponent form can be appended to", async () => {
    const { press, bulk, display } = setup();
    await press("1");
    await bulk("0", 14); // 1e14
    await press("×", "1");
    await bulk("0", 14);
    await press("=");
    expect(display()).toBe("1e+28");
    await press("+/-"); // clears overwrite
    await press("5");
    expect(display()).toBe("-1e+285"); // the 15-digit cap does not see this
    await press("+", "0", "=");
    expect(display()).toBe("-1e+285");
  });
});

describe("history panel", () => {
  it("is hidden until Hist is pressed", async () => {
    const { press, ui } = setup();
    await press("2", "+", "3", "=");
    expect(ui.queryByText("2 + 3 = 5")).toBeNull();
    await press("Hist");
    expect(ui.getByText("2 + 3 = 5")).toBeInTheDocument();
  });

  it("toggles back off", async () => {
    const { press, ui } = setup();
    await press("2", "+", "3", "=", "Hist", "Hist");
    expect(ui.queryByText("2 + 3 = 5")).toBeNull();
  });

  it("keeps only the last five entries", async () => {
    const { press, ui } = setup();
    await press("4", "√", "√", "√", "√", "√", "√", "Hist");
    expect(ui.queryByText("√4 = 2")).toBeNull();
    expect(ui.getByText("√2 = 1.41")).toBeInTheDocument();
    expect(ui.getByText("√1.04 = 1.02")).toBeInTheDocument();
  });

  it("+/- is an edit, not an operation, so nothing is logged", async () => {
    const { press, ui } = setup();
    await press("5", "+/-", "Hist");
    expect(ui.queryByText("+/-5 = -5")).toBeNull();
  });

  it("BUG: history records the rounded intermediate, not what was entered", async () => {
    const { press, ui } = setup();
    await press("2", "÷", "3", "×", "3", "=", "Hist");
    expect(ui.getByText("0.67 × 3 = 2.01")).toBeInTheDocument();
    expect(ui.queryByText(/2 ÷ 3/)).toBeNull(); // the first half is never logged
  });

  it("BUG: a % entry reads like a modulo", async () => {
    const { press, ui } = setup();
    await press("5", "0", "+", "1", "0", "%", "=", "Hist");
    expect(ui.getByText("60 % 10 = 6")).toBeInTheDocument();
  });
});
