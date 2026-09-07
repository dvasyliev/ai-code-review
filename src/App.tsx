import { useState } from "react";

const OPERATORS = ["+", "-", "×", "÷"] as const;
type Operator = (typeof OPERATORS)[number];

function calculate(a: number, b: number, op: Operator): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return a / b;
  }
}

function App() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [overwrite, setOverwrite] = useState(true);

  function inputDigit(digit: string) {
    if (overwrite) {
      setDisplay(digit === "." ? "0." : digit);
      setOverwrite(false);
      return;
    }
    setDisplay(display + digit);
  }

  function chooseOperator(op: Operator) {
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
    const result = calculate(stored as number, Number(display), operator as Operator);
    setDisplay(String(result));
    setStored(null);
    setOperator(null);
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
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={clear}
            className={`${buttonClass} col-span-3 bg-neutral-700 text-white hover:bg-neutral-600`}
          >
            C
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
