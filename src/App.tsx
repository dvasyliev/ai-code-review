import { useState } from "react";

const BINARY_OPERATORS = ["+", "-", "×", "÷", "^", "%"] as const;
type BinaryOperator = (typeof BINARY_OPERATORS)[number];

function calculate(a: number, b: number, op: BinaryOperator): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return a / b;
    case "^":
      return power(a, b);
    case "%":
      return percentage(a, b);
    default:
      return 0;
  }
}

function power(a: number, b: number): number {
  return Math.pow(a, b);
}

function squareRoot(a: number): number {
  return Math.sqrt(a);
}

function percentage(value: number, percent: number): number {
  return (value * percent) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function App() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<BinaryOperator | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  function inputDigit(digit: string) {
    if (overwrite) {
      setDisplay(digit === "." ? "0." : digit);
      setOverwrite(false);
      return;
    }
    setDisplay(display + digit);
  }

  function chooseOperator(op: BinaryOperator) {
    const current = Number(display);
    if (stored !== null && operator !== null && !overwrite) {
      setStored(calculate(stored, current, operator));
    } else {
      setStored(current);
    }
    setOperator(op);
    setOverwrite(true);
  }

  function equals() {
    if (stored === null || operator === null) return;
    const current = Number(display);
    const result = round2(calculate(stored, current, operator));
    const op = operator;
    setDisplay(String(result));
    setHistory((h) => [
      ...h.slice(-4),
      `${stored} ${op} ${current} = ${result}`,
    ]);
    setStored(null);
    setOperator(null);
    setOverwrite(true);
  }

  function toggleSign() {
    const current = Number(display);
    const result = current * -1;
    setDisplay(String(result));
    setHistory((h) => [...h.slice(-4), `+/-${current} = ${result}`]);
  }

  function applyUnary() {
    const current = Number(display);
    const result = round2(squareRoot(current));
    setDisplay(String(result));
    setHistory((h) => [...h.slice(-4), `√${current} = ${result}`]);
    setOverwrite(true);
  }

  function clear() {
    setDisplay("0");
    setStored(null);
    setOperator(null);
    setOverwrite(true);
  }

  const buttonClass =
    "rounded-lg py-4 text-xl font-medium transition-colors active:scale-95";

  return (
    <main className="grid min-h-svh place-items-center bg-neutral-100">
      <div className="w-80 rounded-2xl bg-neutral-900 p-4 shadow-xl">
        <div className="mb-4 truncate rounded-lg bg-neutral-800 px-4 py-6 text-right text-4xl text-white">
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
            onClick={clear}
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
          <button
            type="button"
            onClick={() => chooseOperator("÷")}
            className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400 ${
              operator === "÷" && overwrite ? "ring-2 ring-white" : ""
            }`}
          >
            ÷
          </button>

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
          <button
            type="button"
            onClick={() => chooseOperator("×")}
            className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400 ${
              operator === "×" && overwrite ? "ring-2 ring-white" : ""
            }`}
          >
            ×
          </button>

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
          <button
            type="button"
            onClick={() => chooseOperator("-")}
            className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400 ${
              operator === "-" && overwrite ? "ring-2 ring-white" : ""
            }`}
          >
            -
          </button>

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
          <button
            type="button"
            onClick={() => chooseOperator("+")}
            className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-400 ${
              operator === "+" && overwrite ? "ring-2 ring-white" : ""
            }`}
          >
            +
          </button>

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
