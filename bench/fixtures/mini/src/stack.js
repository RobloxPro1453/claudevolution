// A last-in, first-out stack.
export class Stack {
    constructor() { this.items = []; }
    push(x) { this.items.push(x); return this; }
    pop() { return this.items.pop(); }
}
