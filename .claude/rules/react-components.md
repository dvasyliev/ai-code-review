---
description: React component and state best practices
globs: ["src/**/*.tsx", "!src/**/*.test.tsx"]
---

# React component guidelines

Applies to `src/**/*.tsx`, excluding `*.test.tsx`.

## 1. Keep rendering pure — no side effects during render

A component must return the same output for the same props, state and context. React may
render a component more than once before committing, and in StrictMode it deliberately
double-renders. Anything that mutates the outside world during render therefore runs an
unpredictable number of times.

```tsx
// ✅ Good — render only computes; the side effect lives in an event handler
function Cart({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return (
    <button onClick={() => analytics.track("cart_viewed", { total })}>
      {total}
    </button>
  );
}
```

```tsx
// ❌ Bad — fires twice in StrictMode and again on every re-render
function Cart({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  analytics.track("cart_viewed", { total });
  return <button>{total}</button>;
}
```

## 2. Never mutate props or state — replace them

Props and state are immutable snapshots of a single render. Mutating an object in place
leaves the reference unchanged, so React's comparison sees nothing new and skips the
re-render — the classic "my state changed but the UI didn't" bug.

```tsx
// ✅ Good — a new array identity, so React sees the change
setItems([...items, newItem]);
setUser({ ...user, name: "Ada" });
```

```tsx
// ❌ Bad — same reference, no re-render; and it corrupts the previous render's snapshot
items.push(newItem);
setItems(items);
user.name = "Ada";
```

## 3. Call Hooks unconditionally, at the top level

React identifies Hooks by call order, not by name. A Hook inside a condition, loop or
early return changes that order between renders, and React starts handing a `useState` the
value that belonged to a different one.

```tsx
// ✅ Good — every Hook runs on every render; the condition moves inside
function Profile({ userId, enabled }) {
  const [name, setName] = useState("");
  const data = useQuery(userId, { enabled });
  if (!enabled) return null;
  return <span>{name}</span>;
}
```

```tsx
// ❌ Bad — the early return skips `useQuery`, shifting the Hook order
function Profile({ userId, enabled }) {
  const [name, setName] = useState("");
  if (!enabled) return null;
  const data = useQuery(userId);
  return <span>{name}</span>;
}
```

## 4. Don't put derived data in state — compute it during render

If a value can be calculated from existing props or state, calculating it is always
correct. Copying it into its own state creates a second source of truth that has to be
kept in sync by hand, and every missed update is a stale-UI bug.

```tsx
// ✅ Good — one source of truth; `fullName` can never go stale
function Form() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const fullName = `${first} ${last}`;
  return <p>{fullName}</p>;
}
```

```tsx
// ❌ Bad — three states to keep in sync; any setter that forgets the third desyncs the UI
function Form() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [fullName, setFullName] = useState("");
  return <p>{fullName}</p>;
}
```

## 5. Don't use an Effect to react to your own state

An Effect that only reads state and writes more state runs an extra render pass after
paint, and the user sees the intermediate frame. Do the work in the event handler that
caused the change. Reserve Effects for synchronising with systems outside React.

```tsx
// ✅ Good — everything the click implies happens in the click
function handleSubmit(item) {
  setItems([...items, item]);
  showToast(`Added ${item.name}`);
}
```

```tsx
// ❌ Bad — an extra render, and it fires on mount and on unrelated `items` changes too
useEffect(() => {
  showToast(`Added ${items.at(-1)?.name}`);
}, [items]);
```

## 6. Key lists by a stable id, not by array index

A key is an item's identity. An index ties identity to position, so inserting, removing or
reordering makes React reuse the wrong DOM node — inputs keep the previous row's text and
animations play on the wrong element.

```tsx
// ✅ Good — identity travels with the item through any reorder
{
  todos.map((todo) => <TodoRow key={todo.id} todo={todo} />);
}
```

```tsx
// ❌ Bad — delete the first todo and every row below inherits the wrong state
{
  todos.map((todo, index) => <TodoRow key={index} todo={todo} />);
}
```

## 7. Reset a component's state with a `key`, not with an Effect

To clear state when the subject changes, give the component a `key` bound to that subject.
React then treats it as a different component and remounts it fresh. Watching the prop in
an Effect renders the stale state once before clearing it.

```tsx
// ✅ Good — a new userId is a new component; internal state starts clean
<Profile key={userId} userId={userId} />
```

```tsx
// ❌ Bad — the old comment flashes on screen for one render before it is cleared
function Profile({ userId }) {
  const [comment, setComment] = useState("");
  useEffect(() => setComment(""), [userId]);
}
```

## References

- [Rules of React](https://react.dev/reference/rules)
- [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
