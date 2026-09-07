import { useState } from "react";

type BinaryOperator = "+" | "-" | "×" | "÷" | "^" | "%";

function calculate(a: number, b: number, op: BinaryOperator): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
    case "^":
      return a ** b;
    case "%":
      return percentage(a, b);
  }
}

function percentage(value: number, percent: number): number {
  return (value * percent) / 100;
}

function round2(n: number): number {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return n;
  return Math.round(Number((n * 100).toPrecision(15))) / 100;
}

function applyPending(a: number, b: number, op: BinaryOperator): number {
  return round2(calculate(a, b, op));
}

const buttonClass =
  "rounded-lg py-4 text-xl font-medium transition-colors active:scale-95";

function App() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<BinaryOperator | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  function reset(text = "0") {
    setDisplay(text);
    setStored(null);
    setOperator(null);
    setOverwrite(true);
  }

  function pushHistory(entry: string) {
    setHistory((h) => [...h.slice(-4), entry]);
  }

  function inputDigit(digit: string) {
    if (overwrite) {
      setDisplay(digit === "." ? "0." : digit);
      setOverwrite(false);
      return;
    }
    if (digit === "." && display.includes(".")) return;
    if (display === "0" && digit !== ".") {
      setDisplay(digit);
      return;
    }
    if (display.replace(/[-.]/g, "").length >= 15) return;
    setDisplay(display + digit);
  }

  function chooseOperator(op: BinaryOperator) {
    const current = Number(display);
    if (!Number.isFinite(current)) {
      reset("Error");
      return;
    }
    if (stored !== null && operator !== null && !overwrite) {
      const next = applyPending(stored, current, operator);
      if (!Number.isFinite(next)) {
        reset("Error");
        return;
      }
      setStored(next);
    } else {
      setStored(current);
    }
    setOperator(op);
    setOverwrite(true);
  }

  function equals() {
    if (stored === null || operator === null) return;
    const current = Number(display);
    const result = applyPending(stored, current, operator);
    if (!Number.isFinite(result)) {
      reset("Error");
      return;
    }
    pushHistory(`${stored} ${operator} ${current} = ${result}`);
    reset(String(result));
  }

  function toggleSign() {
    const current = Number(display);
    if (Number.isNaN(current)) return;
    const result = current * -1;
    setDisplay(String(result));
    setOverwrite(false);
  }

  function applyUnary() {
    const current = Number(display);
    const result = round2(Math.sqrt(current));
    if (!Number.isFinite(result)) {
      reset("Error");
      return;
    }
    pushHistory(`√${current} = ${result}`);
    setDisplay(String(result));
    setOverwrite(true);
  }

  const opButton = (op: BinaryOperator) => (
    <button
      type="button"
      onClick={() => chooseOperator(op)}
      className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400 ${
        operator === op && overwrite ? "ring-2 ring-white" : ""
      }`}
    >
      {op}
    </button>
  );

  return (
    <main className="grid min-h-svh place-items-center bg-neutral-100">
      <div className="w-80 rounded-2xl bg-neutral-900 p-4 shadow-xl">
        <div
          role="status"
          aria-label="display"
          className="mb-4 overflow-x-auto whitespace-nowrap rounded-lg bg-neutral-800 px-4 py-6 text-right text-4xl text-white"
        >
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <button
            type="button"
            onClick={() => toggleSign()}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-500`}
          >
            +/-
          </button>
          <button
            type="button"
            onClick={() => chooseOperator("^")}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-500`}
          >
            x^y
          </button>
          <button
            type="button"
            onClick={() => applyUnary()}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-500`}
          >
            √
          </button>
          <button
            type="button"
            onClick={() => chooseOperator("%")}
            className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-500`}
          >
            %
          </button>
        </div>
        {showHistory && (
          <div className="mb-2 rounded-lg bg-neutral-800 px-3 py-2 text-white text-sm max-h-32 overflow-y-auto">
            <div className="space-y-1">
              {history.map((entry, idx) => (
                <div key={idx}>{entry}</div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className={`${buttonClass} col-span-2 bg-neutral-700 text-white hover:bg-neutral-600`}
          >
            C
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`${buttonClass} bg-purple-600 text-white hover:bg-purple-500`}
          >
            Hist
          </button>
          {opButton("÷")}

          {["7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => inputDigit(digit)}
              className={`${buttonClass} bg-neutral-700 text-white hover:bg-neutral-600`}
            >
              {digit}
            </button>
          ))}
          {opButton("×")}

          {["4", "5", "6"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => inputDigit(digit)}
              className={`${buttonClass} bg-neutral-700 text-white hover:bg-neutral-600`}
            >
              {digit}
            </button>
          ))}
          {opButton("-")}

          {["1", "2", "3"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => inputDigit(digit)}
              className={`${buttonClass} bg-neutral-700 text-white hover:bg-neutral-600`}
            >
              {digit}
            </button>
          ))}
          {opButton("+")}

          <button
            type="button"
            onClick={() => inputDigit("0")}
            className={`${buttonClass} col-span-2 bg-neutral-700 text-white hover:bg-neutral-600`}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => inputDigit(".")}
            className={`${buttonClass} bg-neutral-700 text-white hover:bg-neutral-600`}
          >
            .
          </button>
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
