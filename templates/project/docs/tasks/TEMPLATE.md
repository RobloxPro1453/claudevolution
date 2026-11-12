# {{taskPrefix}}-NNN: <short title>

Status: ready
Budget: $1.00
Steps: 200

<!-- 15-40 lines. Goal, test and limits; the agent's scout pass explores the code itself.
     Known facts only when already known (never research just to fill this in).
     One spec = one thing the user will notice, or one whole group of similar small things.
     Do not write the spec if it would be longer than half the code it asks for: do that job yourself. -->

## Goal

<One or two sentences: what the user will notice.>

## Known facts

<Verified facts only, each with file:line or a quoted command output. Leave empty if none.>

## Steps

1. <Concrete step, with file and function if known.>
2. <...>

## How to test

<The check to add: its name, how it reaches the behaviour (which object or output to read), what it
asserts, and why it would fail if the behaviour broke.>

## Done when

- <Observable result.>
- Build and tests pass.

## Do not

- <Files or behaviours to leave alone.>

## Stop and report if

- <Conditions where the agent must finish with status "blocked".>
- A test still fails after 5 steps on it.
