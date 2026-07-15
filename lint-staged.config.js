module.exports = {
  "*.{ts,tsx}": [
    "eslint --fix",
    // tsc has no concept of "check just these files" that respects the
    // project's types, so re-run the full project typecheck instead of
    // passing along the staged filenames.
    () => "tsc --noEmit",
  ],
};
