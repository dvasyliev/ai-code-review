import { useState } from "react";

type BinaryOperator = "+" | "-" | "×" | "÷" | "^";

type CalcResult = { ok: true; value: number } | { ok: false; message: string };

/**
 * What the display is showing, and what the next press may do with it.
 *
 * - `typing`  the user is entering digits; the text is the source of truth
 * - `operand` a computed value, ready to be used as an operand; a digit replaces it
 * - `prompt`  the left operand, echoed while we wait for the right one
 * - `error`   the last operation failed; nothing here can be operated on
 */
type Entry =
  | { kind: "typing"; text: string }
  | { kind: "operand"; value: number }
  | { kind: "prompt"; value: number }
  | { kind: "error"; message: string };

type Pending = { value: number; operator: BinaryOperator };

/** Operator and right-hand operand of the last `=`, so a second `=` can repeat it. */
type Repeat = { operator: BinaryOperator; operand: number };

type HistoryEntry = { id: number; text: string };

const MAX_DIGITS = 15;
const HISTORY_LIMIT = 5;
/** Significant figures shown: enough to be useful, few enough to hide float artefacts. */
const DISPLAY_PRECISION = 12;
/** A number digits can be appended to — no exponent notation, no error text. */
const PLAIN_NUMBER = /^-?\d*\.?\d*$/;

function bounded(value: number): CalcResult {
  if (Number.isNaN(value)) return { ok: false, message: "Not a real number" };
  if (!Number.isFinite(value)) return { ok: false, message: "Result is out of range" };
  return { ok: true, value };
}

function calculate(a: number, b: number, op: BinaryOperator): CalcResult {
  switch (op) {
    case "+":
      return bounded(a + b);
    case "-":
      return bounded(a - b);
    case "×":
      return bounded(a * b);
    case "÷":
      return b === 0 ? { ok: false, message: "Cannot divide by zero" } : bounded(a / b);
    case "^":
      return bounded(a ** b);
    /* v8 ignore next 4 -- unreachable: exists so a new variant fails the build */
    default: {
      const exhaustive: never = op;
      throw new Error(`Unhandled operator: ${String(exhaustive)}`);
    }
  }
}

/**
 * Full precision stays in state and only the string on screen is trimmed, so a
 * chained result stays exact: 1 ÷ 3 × 3 is 1, not 0.99.
 */
function formatNumber(value: number): string {
  if (value === 0) return "0"; // also collapses -0
  if (Number.isInteger(value)) return String(value); // never trim digits the user typed
  return String(Number(value.toPrecision(DISPLAY_PRECISION)));
}

function displayText(entry: Entry): string {
  switch (entry.kind) {
    case "typing":
      return entry.text;
    case "operand":
    case "prompt":
      return formatNumber(entry.value);
    case "error":
      return entry.message;
    /* v8 ignore next 4 -- unreachable: exists so a new variant fails the build */
    default: {
      const exhaustive: never = entry;
      throw new Error(`Unhandled entry: ${String(exhaustive)}`);
    }
  }
}

/** The number the display is offering as an operand. `error` is excluded by the type. */
function operandOf(entry: Exclude<Entry, { kind: "error" }>): number {
  return entry.kind === "typing" ? Number(entry.text) : entry.value;
}

const buttonClass =
  "rounded-lg py-4 text-xl font-medium transition-colors active:scale-95";

function App() {
  const [entry, setEntry] = useState<Entry>({ kind: "operand", value: 0 });
  const [pending, setPending] = useState<Pending | null>(null);
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  function pushHistory(text: string) {
    setHistory((h) => [
      ...h.slice(-(HISTORY_LIMIT - 1)),
      { id: (h.at(-1)?.id ?? -1) + 1, text },
    ]);
  }

  function reset() {
    setEntry({ kind: "operand", value: 0 });
    setPending(null);
    setRepeat(null);
    setNotice(null);
  }

  function fail(message: string) {
    setEntry({ kind: "error", message });
    setPending(null);
    setRepeat(null);
    setNotice(null);
  }

  function inputDigit(digit: string) {
    setNotice(null);
    if (entry.kind !== "typing" || !PLAIN_NUMBER.test(entry.text)) {
      setEntry({ kind: "typing", text: digit === "." ? "0." : digit });
      return;
    }
    const { text } = entry;
    if (digit === ".") {
      // A decimal point is not a digit, so the cap below must not reject it.
      if (!text.includes(".")) setEntry({ kind: "typing", text: `${text}.` });
      return;
    }
    if (text.replace(/[-.]/g, "").length >= MAX_DIGITS) {
      setNotice(`A number can be at most ${MAX_DIGITS} digits`);
      return;
    }
    setEntry({ kind: "typing", text: text === "0" ? digit : text + digit });
  }

  function chooseOperator(op: BinaryOperator) {
    setNotice(null);
    if (entry.kind === "error") return;

    // Nothing entered since the last operator: the user is swapping it out.
    if (pending !== null && entry.kind === "prompt") {
      setPending({ value: pending.value, operator: op });
      return;
    }

    const current = operandOf(entry);
    if (pending === null) {
      setPending({ value: current, operator: op });
      setEntry({ kind: "prompt", value: current });
      setRepeat(null);
      return;
    }

    const result = calculate(pending.value, current, pending.operator);
    if (!result.ok) {
      fail(result.message);
      return;
    }
    pushHistory(
      `${formatNumber(pending.value)} ${pending.operator} ${formatNumber(current)} = ${formatNumber(result.value)}`,
    );
    setPending({ value: result.value, operator: op });
    setEntry({ kind: "prompt", value: result.value });
    setRepeat(null);
  }

  function equals() {
    setNotice(null);
    if (entry.kind === "error") return;
    const current = operandOf(entry);

    // A second `=` repeats the operation the first one performed.
    const step: Pending | null =
      pending ?? (repeat === null ? null : { value: current, operator: repeat.operator });
    if (step === null) return;
    const operand = pending === null && repeat !== null ? repeat.operand : current;

    const result = calculate(step.value, operand, step.operator);
    if (!result.ok) {
      fail(result.message);
      return;
    }
    pushHistory(
      `${formatNumber(step.value)} ${step.operator} ${formatNumber(operand)} = ${formatNumber(result.value)}`,
    );
    setRepeat({ operator: step.operator, operand });
    setPending(null);
    setEntry({ kind: "operand", value: result.value });
  }

  function squareRoot() {
    setNotice(null);
    if (entry.kind === "error") return;
    const current = operandOf(entry);
    const value = Math.sqrt(current);
    if (Number.isNaN(value)) {
      fail("Cannot take √ of a negative number");
      return;
    }
    pushHistory(`√${formatNumber(current)} = ${formatNumber(value)}`);
    // `operand`, not `prompt`: a pending operation is still waiting and this is its
    // right-hand side, so the next operator press must fold it in.
    setEntry({ kind: "operand", value });
  }

  function applyPercent() {
    setNotice(null);
    if (entry.kind === "error") return;
    const current = operandOf(entry);
    // "50 + 10 %" means 10 percent *of 50*; "50 × 10 %" means a plain 0.1.
    const value =
      pending !== null && (pending.operator === "+" || pending.operator === "-")
        ? (pending.value * current) / 100
        : current / 100;
    const result = bounded(value);
    if (!result.ok) {
      fail(result.message);
      return;
    }
    setEntry({ kind: "operand", value: result.value });
  }

  function toggleSign() {
    setNotice(null);
    if (entry.kind === "error") return;
    if (entry.kind === "typing") {
      const { text } = entry;
      if (text === "0") return; // there is no -0 worth showing
      setEntry({
        kind: "typing",
        text: text.startsWith("-") ? text.slice(1) : `-${text}`,
      });
      return;
    }
    // Negating a result hands it back for editing — unless it is in exponent form,
    // which is not something digits can be appended to.
    const negated = -entry.value;
    const text = formatNumber(negated);
    setEntry(
      PLAIN_NUMBER.test(text)
        ? { kind: "typing", text }
        : { kind: "operand", value: negated },
    );
  }

  const isPending = (op: BinaryOperator) =>
    pending?.operator === op && entry.kind === "prompt";

  const digitButton = (digit: string, extraClass = "") => (
    <button
      key={digit}
      type="button"
      onClick={() => inputDigit(digit)}
      className={`${buttonClass} ${extraClass} bg-neutral-700 text-white hover:bg-neutral-600`}
    >
      {digit}
    </button>
  );

  const opButton = (op: BinaryOperator) => (
    <button
      type="button"
      onClick={() => chooseOperator(op)}
      className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400 ${
        isPending(op) ? "ring-2 ring-white" : ""
      }`}
    >
      {op}
    </button>
  );

  const functionButton = (label: string, onClick: () => void, active = false) => (
    <button
      type="button"
      onClick={onClick}
      className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-500 ${
        active ? "ring-2 ring-white" : ""
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="grid min-h-svh place-items-center bg-neutral-100">
      <div className="w-80 rounded-2xl bg-neutral-900 p-4 shadow-xl">
        <div
          role="status"
          aria-label="display"
          className={`mb-2 overflow-x-auto whitespace-nowrap rounded-lg bg-neutral-800 px-4 py-6 text-right text-white ${
            entry.kind === "error" ? "text-xl" : "text-4xl"
          }`}
        >
          {displayText(entry)}
        </div>
        {notice !== null && (
          <p
            role="alert"
            className="mb-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-200"
          >
            {notice}
          </p>
        )}
        <div className="mb-2 grid grid-cols-4 gap-2">
          {functionButton("+/-", toggleSign)}
          {functionButton("x^y", () => chooseOperator("^"), isPending("^"))}
          {functionButton("√", squareRoot)}
          {functionButton("%", applyPercent)}
        </div>
        {showHistory && (
          <div
            role="log"
            aria-label="history"
            className="mb-2 max-h-32 overflow-y-auto rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
          >
            <div className="space-y-1">
              {history.map((item) => (
                <div key={item.id}>{item.text}</div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={reset}
            className={`${buttonClass} col-span-2 bg-neutral-700 text-white hover:bg-neutral-600`}
          >
            C
          </button>
          <button
            type="button"
            onClick={() => setShowHistory((shown) => !shown)}
            className={`${buttonClass} bg-purple-600 text-white hover:bg-purple-500`}
          >
            Hist
          </button>
          {opButton("÷")}

          {["7", "8", "9"].map((digit) => digitButton(digit))}
          {opButton("×")}

          {["4", "5", "6"].map((digit) => digitButton(digit))}
          {opButton("-")}

          {["1", "2", "3"].map((digit) => digitButton(digit))}
          {opButton("+")}

          {digitButton("0", "col-span-2")}
          {digitButton(".")}
          <button
            type="button"
            onClick={equals}
            className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400`}
          >
            =
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;
