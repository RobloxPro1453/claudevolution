# Development

## Build and test

The commands are in `.evrim/config.json` (`build`, `test`); the skills and the cheap model read them from there. Here only a summary for people:

```
{{build}}
```

```
{{test}}
```

- Build time: <minutes>. Test time: <minutes>. Long runs go to the background with a time limit.
- Tests use <which temp folder/profile>; they never touch real user data.

## Adding a feature

1. <Which file gets what; e.g. "Add the command to the `src/commands.js` list.">
2. <How it connects to the interface.>
3. Add a test for the behaviour (<test file>); the test must fail when the behaviour breaks.

## Rules for writing tests

- Every test leaves the state as it found it (closes what it opens, restores settings it changed). Tests that pass one by one break together for exactly this reason.
- Test processes must be told apart from the owner's open window (separate profile, separate window title).

## Tools

| Command | What it does |
|---|---|
| `.evrim/cv status` | round, quota, lanes, memory digest |
| `.evrim/cv doctor` | prerequisites for unattended work |
| `.evrim/cv guard --show` | what the quota guard sees now |
| `.evrim/cv delegate ...` | the cheap model agent and lanes (used by the `calis` skill) |
