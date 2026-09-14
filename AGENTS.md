# AGENTS.md - Antigravity Execution Safety Rules

## 1. ABSOLUTE SCOPE CONFINEMENT
- You may ONLY modify the exact files and lines explicitly requested by the user.
- DO NOT add unprompted sections, decorative widgets, fake stats, or placeholder buttons.
- DO NOT "improve", "refactor", or restyle adjacent components unless explicitly told to do so.
- DO NOT invent new state variables, dummy data arrays, or UI strings not present in the instructions.
- NEVER substitute hardcoded mock data or placeholder arrays for actual dynamic API bindings.

## 2. SURGICAL DIFF ENFORCEMENT
- Prioritize the minimal diff footprint required to complete the task.
- Preserve all existing comments, functions, props, and variable names verbatim.
- If fixing a CSS or JSX bug, touch ONLY the broken CSS selectors or JSX nodes.

## 3. ZERO ADDITIVE DRIFT
- Any new text, disclaimers, status badges, or headers not specified in the prompt will trigger an immediate revert.
- Self-check before output: "Did the user explicitly ask for this exact UI element?" If no, omit it.
