---
name: feedback-frontend-style
description: User dislikes generic AI-looking frontend code — strings of class names, scattered magic numbers, innerHTML, wrapper divs
metadata:
  type: feedback
---

When writing or refactoring frontend code in this user's projects, aim for senior-dev quality:

- Pull every magic number into a single design-token module (durations, dimensions, palette, defaults, bounds) — never sprinkle `5000`, `200`, `1600` inside view code
- Avoid `innerHTML = ...` for dynamic content — use a small `h()` hyperscript helper or DOM APIs
- Don't wrap content in throwaway `<div>` layers — every container must earn its place by participating in layout or accessibility
- Centralize state in one store with subscribers, not module-level `let snapshot` variables scattered across files
- Cast `as HTMLElement` is a smell — prefer a `query<T>()` helper that throws on missing
- Tailwind class strings: keep them short and use design-token classes (`p-4`, `gap-6`) consistently across siblings
- Mobile-first responsive layout is required, not nice-to-have — test at 360px width mentally
- One CSS variable for things that drive geometry (floor height, cabin width) rather than recomputing numbers in JS

**Why:** The user explicitly called out "слишком видно, что ИИ делало, однотипный иишный фронтенд" — meaning the typical pattern of long inline class strings, repeated template literals, magic-number ms values, and over-nested divs reads as machine-generated and looks unprofessional

**How to apply:** When asked to build any web UI, default to: design.ts (tokens) + lib/dom.ts (h helper) + lib/store.ts (subscribers) + views/ (pure functions returning Node) + minimal CSS variables in style.css. Never inline magic numbers in view code
