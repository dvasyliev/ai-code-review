---
description: TypeScript type-safety best practices
globs: ["src/**/*.ts", "src/**/*.tsx"]
---

# TypeScript guidelines

Applies to all TypeScript in `src/`.

## 1. Use `unknown` at boundaries, never `any`

`any` switches off type checking for every value it touches and spreads silently through
the code it flows into. `unknown` accepts anything too, but forces a check before use — so
the validation happens once, at the edge, instead of failing at runtime deep inside.

```ts
// ✅ Good — the shape is proven before anything downstream trusts it
async function loadUser(id: string): Promise<User> {
  const data: unknown = await fetch(`/api/users/${id}`).then((r) => r.json());
  return userSchema.parse(data);
}
```

```ts
// ❌ Bad — `user.emial` compiles fine and is undefined at runtime
async function loadUser(id: string): Promise<any> {
  return fetch(`/api/users/${id}`).then((r) => r.json());
}
```

## 2. Model mutually exclusive states as a discriminated union

Optional fields on one flat object let impossible combinations compile — loading *and*
having an error, or data present with no success flag. A union with a literal discriminant
makes each state exact and lets the compiler narrow the rest of the shape from it.

```ts
// ✅ Good — `data` exists only in the success branch; no impossible combinations
type Result =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: User };

if (result.status === "success") console.log(result.data.name);
```

```ts
// ❌ Bad — every field optional, so `{ isLoading: true, error: "x" }` type-checks
type Result = {
  isLoading?: boolean;
  error?: string;
  data?: User;
};
```

## 3. Make a `switch` over a union exhaustive with a `never` check

Assigning the narrowed value to `never` in the default branch turns "someone added a union
member and forgot this switch" into a compile error, at the exact site that forgot it,
instead of a silent fall-through in production.

```ts
// ✅ Good — adding a variant to `Shape` fails the build here
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    default: {
      const exhaustive: never = shape;
      throw new Error(`Unhandled shape: ${exhaustive}`);
    }
  }
}
```

```ts
// ❌ Bad — a new variant silently returns 0 and nobody finds out until a bug report
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    default:
      return 0;
  }
}
```

## 4. Narrow with a type guard, not with a type assertion

`as` is an instruction to stop checking — it is right only for as long as the claim behind
it stays true, and nothing re-verifies it after a refactor. A runtime check narrows the
type and is still correct when the data changes shape.

```ts
// ✅ Good — the check the compiler trusts is the same one that runs
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "id" in value;
}

if (isUser(payload)) console.log(payload.id);
```

```ts
// ❌ Bad — a promise to the compiler that nothing enforces; crashes on a bad payload
const user = payload as User;
console.log(user.id);
```

## 5. Prefer a literal union to an enum

A union of string literals is erased at compile time, works with plain string values from
JSON and APIs, and narrows in a `switch`. A TS `enum` emits a runtime object, is nominally
typed (so a matching string is rejected), and is disallowed under `erasableSyntaxOnly`.

```ts
// ✅ Good — zero runtime cost, and a value straight off the wire is assignable
type Status = "idle" | "loading" | "done";

const status: Status = response.status; // fine if the string matches
```

```ts
// ❌ Bad — emits runtime code, and `"loading"` is not assignable to `Status`
enum Status {
  Idle = "idle",
  Loading = "loading",
  Done = "done",
}
```

## 6. Annotate the public surface; let local values infer

An explicit return type on an exported function is the contract — it catches the mistake
inside that function rather than three call sites away, and it stops a refactor from
silently widening the API. Local variables need no annotation; inference is more precise.

```ts
// ✅ Good — the exported signature is stated; locals stay inferred
export function parsePrice(input: string): number | null {
  const cleaned = input.trim().replace(/[^0-9.]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
```

```ts
// ❌ Bad — the return type silently became `number | null | undefined`; locals over-typed
export function parsePrice(input: string) {
  const cleaned: string = input.trim();
  if (!cleaned) return;
  return Number(cleaned);
}
```

## 7. Use `satisfies` to check an object literal without widening it

A type annotation validates the literal but replaces its inferred type, so you lose the
specific keys and value types. `satisfies` checks against the constraint and keeps the
narrow inference, giving you both autocomplete on the keys and a real error on a typo.

```ts
// ✅ Good — checked against the constraint, and `config.retries` is still `3`, not `number`
const config = {
  endpoint: "/api/users",
  retries: 3,
} satisfies Record<string, string | number>;

config.endpoint.toUpperCase(); // known to be a string
```

```ts
// ❌ Bad — the annotation widens every value, so this is a compile error
const config: Record<string, string | number> = {
  endpoint: "/api/users",
  retries: 3,
};

config.endpoint.toUpperCase(); // Property 'toUpperCase' does not exist on 'string | number'
```

## References

- [TypeScript Handbook — Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Handbook — Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [Unions, Literals, and Narrowing — Total TypeScript](https://www.totaltypescript.com/books/total-typescript-essentials/unions-literals-and-narrowing)
- [Discriminate Types — TypeScript Playground](https://www.typescriptlang.org/play/typescript/meta-types/discriminate-types.ts.html)
