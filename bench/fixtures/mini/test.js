// Visible tests of the mini project. Run: node test.js (or deno run -A test.js). Exit code 1 on failure.
import { slugify } from "./src/text.js";
import { Stack } from "./src/stack.js";
import { total } from "./src/sum.js";

let failed = 0;
const check = (name, cond) => { if (!cond) { failed++; console.log("FAIL " + name); } else console.log("ok   " + name); };

check("slugify keeps a plain word", slugify("abc") === "abc");
check("stack push then pop", new Stack().push(1).push(2).pop() === 2);
check("total with qty", total([{ price: 2, qty: 3 }, { price: 1 }]) === 7);
check("total ignores qty 0", total([{ price: 5, qty: 0 }]) === 0);

console.log(failed ? `${failed} failed` : "all passed");
if (failed) globalThis.process ? process.exit(1) : Deno.exit(1);
