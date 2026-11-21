# Knowledge

Things you cannot see by reading the code: pitfalls, paths tried and dropped, quirks of the environment. What the code shows is not written here. Each item 1-3 lines; information that turns out wrong is fixed at once.

## Pitfalls

- **<short name>:** <what happens> → <what to do>. (how it was found, date)
  Example: **Building during tests:** a build while tests run fails because the output file is locked → wait for the tests to finish first. (2026-01-15)

## Paths tried and dropped

- **<path>:** <why it did not work>; if it is tried again, <which condition must change>.

## Environment

- <e.g. "Line endings are CRLF on Windows; multi-line text matching must allow for it.">

## Test environment

- <which profile/folder the tests use, how long they take, what they must not open>
