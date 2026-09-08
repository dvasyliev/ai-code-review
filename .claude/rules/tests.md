---
description: Testing Library and Vitest best practices
globs: ["src/**/*.test.tsx", "src/**/*.test.ts"]
---

# Test guidelines

Applies to `src/**/*.test.tsx` and `src/**/*.test.ts`.

## 1. Query by role and accessible name first

`getByRole` is the top of Testing Library's query priority: it finds elements the way a
user — including a screen-reader user — finds them. A component you cannot query by role
is usually a component that is genuinely inaccessible.

```tsx
// ✅ Good — asserts the element is a real, labelled control
await user.click(screen.getByRole("button", { name: /submit/i }));
expect(screen.getByRole("alert")).toHaveTextContent("Saved");
```

```tsx
// ❌ Bad — passes on a non-focusable div and breaks on any class rename
await user.click(container.querySelector(".btn-primary"));
expect(container.querySelector(".toast").textContent).toBe("Saved");
```

## 2. Use `data-testid` only as an escape hatch

Test ids are invisible to users, so they prove nothing about accessibility and they let a
broken UI keep passing. Reach for one only when there is no role, label or text to query —
for example a purely decorative wrapper you need to assert on.

```tsx
// ✅ Good — the query doubles as an accessibility assertion
screen.getByLabelText("Email address");
screen.getByText("3 items in cart");
```

```tsx
// ❌ Bad — a test id bolted onto an input that simply has no label
<input data-testid="email-input" />;
screen.getByTestId("email-input");
```

## 3. Simulate interaction with `userEvent`, never `fireEvent`

`fireEvent` dispatches one synthetic event. A real click also produces pointer, mouse,
focus and blur events, and typing produces keydown/keypress/input/keyup per character.
`userEvent` fires the whole sequence, so tests catch handlers that depend on it.

```tsx
// ✅ Good — one session per test, every interaction awaited
const user = userEvent.setup();
render(<Form />);
await user.type(screen.getByRole("textbox", { name: /email/i }), "ada@example.com");
await user.click(screen.getByRole("button", { name: /submit/i }));
```

```tsx
// ❌ Bad — no focus, no keydown; a component that validates on blur is never exercised
fireEvent.change(screen.getByRole("textbox"), { target: { value: "ada@example.com" } });
fireEvent.click(screen.getByRole("button"));
```

## 4. Assert on what the user observes, not on implementation details

State variables, prop names and internal function calls are implementation. A test coupled
to them fails on every harmless refactor and still passes when the feature is visibly
broken. Assert on rendered output and on calls that cross a real boundary.

```tsx
// ✅ Good — survives any rewrite of the internals; fails only when behaviour changes
await user.click(screen.getByRole("button", { name: /add to cart/i }));
expect(screen.getByRole("status")).toHaveTextContent("1 item");
```

```tsx
// ❌ Bad — asserts the shape of the hook, not anything a user could notice
const { result } = renderHook(() => useCart());
expect(result.current.internalItems).toHaveLength(1);
```

## 5. Await async UI with `findBy*`, never with a fixed delay

`findBy*` polls until the element appears and fails with a useful DOM dump on timeout. A
hard-coded `setTimeout` is slow when it is too long and flaky when it is too short, and it
gives no diagnostic when it fails.

```tsx
// ✅ Good — resolves as soon as the element is there
expect(await screen.findByRole("alert")).toHaveTextContent("Saved");
expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
```

```tsx
// ❌ Bad — arbitrary wait; flakes on a slow CI runner, wastes 500ms when it passes
await new Promise((r) => setTimeout(r, 500));
expect(screen.getByRole("alert")).toBeInTheDocument();
```

## 6. Set up per test with a helper function, not nested `beforeEach`

Shared mutable variables assigned in `beforeEach` make a test unreadable in isolation — you
have to scroll through several `describe` levels to learn what the state is. A setup
function returns everything explicitly and lets each test override what it needs.

```tsx
// ✅ Good — the whole context of the test is visible in the test
function setup(overrides = {}) {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} {...overrides} />);
  return { user, onSubmit };
}

it("submits the entered email", async () => {
  const { user, onSubmit } = setup();
  …
});
```

```tsx
// ❌ Bad — `onSubmit` is assigned three describes up; reading one test is not enough
let onSubmit;
beforeEach(() => {
  onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} />);
});
```

## 7. Name a test for the behaviour it pins, not for the function it calls

The test name is the failure report. "submits the entered email" tells you what broke;
"handleSubmit works" sends you to open the file. Keep one behaviour per test so the name
can stay specific.

```tsx
// ✅ Good — the CI log alone tells you what regressed
describe("checkout form", () => {
  it("disables submit until an email is entered", async () => { … });
  it("shows a validation error for a malformed email", async () => { … });
});
```

```tsx
// ❌ Bad — named after internals, and three behaviours share one failure message
describe("Form", () => {
  it("handleSubmit works", async () => { … });
});
```

## References

- [About Queries — query priority](https://testing-library.com/docs/queries/about/)
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Avoid Nesting when you're Testing](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing)
- [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details)
