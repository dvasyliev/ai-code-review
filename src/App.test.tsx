import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

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
    /** The history panel; only present while it is open. */
    log: () => within(ui.getByRole("log", { name: "history" })),
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

  it("says why a press was rejected once the 15-digit cap is reached", async () => {
    const { press, bulk, ui } = setup();
    await bulk("9", 15);
    expect(ui.queryByRole("alert")).toBeNull();
    await press("9");
    expect(ui.getByRole("alert")).toHaveTextContent("at most 15 digits");
    await press("C");
    expect(ui.queryByRole("alert")).toBeNull();
  });

  it("accepts a decimal point at the 15-digit cap, but no further digits", async () => {
    const { press, bulk, display, ui } = setup();
    await bulk("9", 15);
    await press(".");
    expect(display()).toBe("999999999999999.");
    await press("5");
    expect(display()).toBe("999999999999999.");
    expect(ui.getByRole("alert")).toHaveTextContent("at most 15 digits");
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

  it("swaps the operator when two are pressed in a row", async () => {
    const { press, display } = setup();
    await press("8", "+", "×", "2", "=");
    expect(display()).toBe("16");
  });
});

describe("percent", () => {
  it("reads as a percentage of the left operand when adding", async () => {
    const { press, display } = setup();
    await press("5", "0", "+", "1", "0", "%");
    expect(display()).toBe("5");
    await press("=");
    expect(display()).toBe("55");
  });

  it("subtracts a percentage of the left operand", async () => {
    const { press, display } = setup();
    await press("1", "0", "0", "-", "1", "0", "%", "=");
    expect(display()).toBe("90");
  });

  it("is a plain division by 100 when multiplying", async () => {
    const { press, display } = setup();
    await press("5", "0", "×", "1", "0", "%", "=");
    expect(display()).toBe("5");
  });

  it("is a plain division by 100 with no operation pending", async () => {
    const { press, display } = setup();
    await press("5", "0", "%");
    expect(display()).toBe("0.5");
  });

  it("keeps small values instead of rounding them away", async () => {
    const { press, display } = setup();
    await press("0", ".", "0", "7", "%");
    expect(display()).toBe("0.0007");
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

  it("keeps a trailing decimal point through +/-", async () => {
    const { press, display } = setup();
    await press("5", ".", "+/-", "2");
    expect(display()).toBe("-5.2");
  });

  it("keeps the sign on a bare decimal point: '.' +/- '5' is -0.5", async () => {
    const { press, display } = setup();
    await press(".", "+/-", "5");
    expect(display()).toBe("-0.5");
  });

  it("+/- is reversible", async () => {
    const { press, display } = setup();
    await press("5", "+/-", "+/-");
    expect(display()).toBe("5");
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

  it("shows the intermediate result when the chain folds", async () => {
    const { press, display } = setup();
    await press("2", "÷", "3", "×");
    expect(display()).toBe("0.666666666667");
  });

  it("keeps full precision through a chain: 2 ÷ 3 × 3 is 2", async () => {
    const { press, display } = setup();
    await press("2", "÷", "3", "×", "3", "=");
    expect(display()).toBe("2");
  });

  it("repeats the last operation when = is pressed again", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "=");
    expect(display()).toBe("5");
    await press("=");
    expect(display()).toBe("8");
    await press("=");
    expect(display()).toBe("11");
  });

  it("repeats the last operation onto a freshly entered number", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "=", "9", "=");
    expect(display()).toBe("12");
  });

  it("C clears the repeat, so = does nothing after it", async () => {
    const { press, display } = setup();
    await press("2", "+", "3", "=", "C", "9", "=");
    expect(display()).toBe("9");
  });

  it("folds a pending operation into a square root: 9 + 4 √ × 2 is 22", async () => {
    const { press, display } = setup();
    await press("9", "+", "4", "√", "×", "2", "=");
    expect(display()).toBe("22");
  });

  it("gives the same answer whether √ is followed by an operator or by =", async () => {
    const withEquals = setup();
    await withEquals.press("9", "+", "4", "√", "=");
    expect(withEquals.display()).toBe("11");

    const withOperator = setup();
    await withOperator.press("9", "+", "4", "√", "+", "0", "=");
    expect(withOperator.display()).toBe("11");
  });

  it("folds a pending operation into a percentage", async () => {
    const { press, display } = setup();
    await press("2", "0", "0", "+", "1", "0", "%", "+", "5", "=");
    expect(display()).toBe("225"); // 200 + 10% is 220, then + 5
  });
});

describe("error states", () => {
  it("names division by zero", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=");
    expect(display()).toBe("Cannot divide by zero");
  });

  it("names a square root of a negative", async () => {
    const { press, display } = setup();
    await press("5", "+/-", "√");
    expect(display()).toBe("Cannot take √ of a negative number");
  });

  it("names an out-of-range result", async () => {
    const { press, display } = setup();
    await press("0", "x^y", "1", "+/-", "=");
    expect(display()).toBe("Result is out of range");
  });

  it("names an overflow produced by a percentage", async () => {
    const { press, bulk, display } = setup();
    await press("1");
    await bulk("0", 14); // 1e14
    await press("x^y", "2", "1", "="); // 1e294
    await press("+", "%"); // 1e294 percent of 1e294
    expect(display()).toBe("Result is out of range");
  });

  it("names a result that is not a real number", async () => {
    const { press, display } = setup();
    await press("8", "+/-", "x^y", "0", ".", "5", "=");
    expect(display()).toBe("Not a real number");
  });

  it("reports a non-finite intermediate on the operator press", async () => {
    const { press, display } = setup();
    await press("0", "x^y", "1", "+/-", "+");
    expect(display()).toBe("Result is out of range");
  });

  it("a digit starts a fresh entry after an error", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "7");
    expect(display()).toBe("7");
  });

  it("√ on an error leaves the error standing", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "√");
    expect(display()).toBe("Cannot divide by zero");
  });

  it("+/- on an error leaves the error standing", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "+/-");
    expect(display()).toBe("Cannot divide by zero");
  });

  it("% on an error leaves the error standing", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "%");
    expect(display()).toBe("Cannot divide by zero");
  });

  it("= on an error leaves the error standing", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "=");
    expect(display()).toBe("Cannot divide by zero");
  });

  it("an operator after an error clears the pending state", async () => {
    const { press, display } = setup();
    await press("5", "÷", "0", "=", "+", "2", "=");
    expect(display()).toBe("2");
  });

  it("a failed √ clears the pending operation", async () => {
    const { press, display } = setup();
    await press("9", "+", "5", "+/-", "√");
    expect(display()).toBe("Cannot take √ of a negative number");
    await press("7", "=");
    expect(display()).toBe("7");
  });
});

describe("precision", () => {
  it("hides the classic 0.1 + 0.2 artefact", async () => {
    const { press, display } = setup();
    await press("0", ".", "1", "+", "0", ".", "2", "=");
    expect(display()).toBe("0.3");
  });

  it("keeps a value smaller than a cent", async () => {
    const { press, display } = setup();
    await press("0", ".", "0", "0", "1", "+", "0", "=");
    expect(display()).toBe("0.001");
  });

  it("keeps three decimal places", async () => {
    const { press, display } = setup();
    await press("8", ".", "1", "6", "5", "+", "0", "=");
    expect(display()).toBe("8.165");
  });

  it("treats a negative the same as its positive counterpart", async () => {
    const { press, display } = setup();
    await press("8", ".", "1", "6", "5", "+/-", "+", "0", "=");
    expect(display()).toBe("-8.165");
  });

  it("round-trips a division: 1 ÷ 3 × 3 is 1", async () => {
    const { press, display } = setup();
    await press("1", "÷", "3", "=");
    expect(display()).toBe("0.333333333333");
    await press("×", "3", "=");
    expect(display()).toBe("1");
  });

  it("keeps every digit of a 15-digit integer", async () => {
    const { press, display } = setup();
    await press("1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "1", "2", "3", "4", "5");
    await press("+", "0", "=");
    expect(display()).toBe("123456789012345");
  });

  it("carries past 15 digits without truncating", async () => {
    const { press, bulk, display } = setup();
    await bulk("9", 15);
    await press("+", "1", "=");
    expect(display()).toBe("1000000000000000");
  });
});

describe("exponent-notation results", () => {
  it("shows a very large result in exponent form", async () => {
    const { press, bulk, display } = setup();
    await press("1");
    await bulk("0", 14);
    await press("×", "1");
    await bulk("0", 14);
    await press("=");
    expect(display()).toBe("1e+28");
  });

  it("refuses to append digits to an exponent-form result", async () => {
    const { press, bulk, display } = setup();
    await press("1");
    await bulk("0", 14);
    await press("×", "1");
    await bulk("0", 14);
    await press("=", "+/-");
    expect(display()).toBe("-1e+28");
    await press("5");
    expect(display()).toBe("5");
  });
});

describe("history panel", () => {
  it("is hidden until Hist is pressed", async () => {
    const { press, ui, log } = setup();
    await press("2", "+", "3", "=");
    expect(ui.queryByRole("log", { name: "history" })).toBeNull();
    await press("Hist");
    expect(log().getByText("2 + 3 = 5")).toBeInTheDocument();
  });

  it("toggles back off", async () => {
    const { press, ui } = setup();
    await press("2", "+", "3", "=", "Hist", "Hist");
    expect(ui.queryByRole("log", { name: "history" })).toBeNull();
  });

  it("keeps only the last five entries", async () => {
    const { press, log } = setup();
    await press("4", "√", "√", "√", "√", "√", "√", "Hist");
    expect(log().queryByText("√4 = 2")).toBeNull();
    expect(log().getAllByText(/^√/)).toHaveLength(5);
  });

  it("survives C", async () => {
    const { press, log } = setup();
    await press("2", "+", "3", "=", "C", "Hist");
    expect(log().getByText("2 + 3 = 5")).toBeInTheDocument();
  });

  it("logs both halves of a chain", async () => {
    const { press, log } = setup();
    await press("2", "÷", "3", "×", "3", "=", "Hist");
    expect(log().getByText("2 ÷ 3 = 0.666666666667")).toBeInTheDocument();
    expect(log().getByText("0.666666666667 × 3 = 2")).toBeInTheDocument();
  });

  it("logs a repeated = as its own entry", async () => {
    const { press, log } = setup();
    await press("2", "+", "3", "=", "=", "Hist");
    expect(log().getByText("2 + 3 = 5")).toBeInTheDocument();
    expect(log().getByText("5 + 3 = 8")).toBeInTheDocument();
  });

  it("+/- is an edit, not an operation, so nothing is logged", async () => {
    const { press, log } = setup();
    await press("5", "+/-", "Hist");
    expect(log().queryByText(/./)).toBeNull();
  });

  it("% is an edit, not an operation, so nothing is logged", async () => {
    const { press, log } = setup();
    await press("5", "0", "+", "1", "0", "%", "Hist");
    expect(log().queryByText(/./)).toBeNull();
  });
});
