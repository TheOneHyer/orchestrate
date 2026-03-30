---
description: "Resolve open review comments on the active pull request via agent with strict validation and a thread-by-thread fix report"
name: "Resolve Open Comments"
argument-hint: "Constraints and priority comments to handle first"
agent: "agent"
---
Resolve Open Comments.

Objective:
- Invoke the agent.
- Address all open review comments in the active pull request.
- Implement concrete fixes in the codebase where needed.
- Report back exactly which issues were fixed so threads can be resolved on GitHub.

Execution requirements:
1. Always target the active pull request and gather all currently open comments, grouped by file/symbol.
2. Invoke the agent with the grouped comments and any user-provided constraints from this prompt invocation.
3. Apply fixes for each valid comment.
4. Run strict validation after fixes: `pnpm lint`, `pnpm build`, and `pnpm test:coverage`; if any command fails, abort and report the exact failing command and errors back to the reviewer.
5. If validation fails, attempt at most one deterministic safe fix (for example, a lint autofix or a clearly flaky build/test retry) and rerun the failed command once; report both the attempted fix and rerun result. If a safe fix is not possible, do not continue silently: keep current changes, explain required manual steps/context, and optionally include rollback instructions for reverting partial changes.
6. If any comment is not actionable or cannot be fixed safely, explain why and what is needed.

Output format:
- Summary: one paragraph on overall status.
- Fixed Issues: numbered list where each item includes:
  - Comment identifier or short quote.
  - Root cause.
  - Exact change made.
  - File references.
  - Validation performed and result.
- Not Fixed: numbered list with blocker/reason and next action.
- Ready to Resolve Checklist: bullet list of comment IDs/threads that are now safe to resolve.

Quality bar:
- Prioritize correctness and behavior preservation over stylistic edits.
- Do not claim a fix unless code and validations support it.
- Keep the report specific enough that a reviewer can verify each fix quickly.
