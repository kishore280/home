---
title: How I build this site with coding agents
description: I write the rules, coding agents write the code. What goes in AGENTS.md, why every change needs a test, and a bug the tests did not catch.
date: '2026-09-29'
tags: [agents, claude code, cloudflare]
---

I don't write most of this site's code by hand. I write the rules, and coding agents do the work: the
cat, the 88×31 buttons, the chai clock, the "brain rotting" row. Here is what works for me.

## One file with the rules

Every agent reads `AGENTS.md` first. It says what the site is, how to test it, how to ship it, and
what not to redo. Some of my rules:

- **Real data only.** A card with no data hides. No demo text, ever.
- **Show before you build.** For anything a visitor sees, the agent makes two or three mockups first.
  I pick one, and only then does it build.
- **Do not hand-roll.** Before a fix, look up how the library or the experts do it.
- **Free tier only.** Cloudflare Workers, D1 and Umami, all free. The site costs ₹0.

A rule that is not written down gets broken by the next agent. So when I correct an agent twice,
the correction goes into the file.

## Tests catch the agent

An agent is fast and sure of itself, also when it is wrong. So before any push:

```sh
npm run build && npm run lint && npm run audit
```

`audit` runs about a hundred Playwright tests on a phone and a desktop: every tap target, the ⌘K
menu, the offline page, accessibility with axe-core, and no layout shift while the page loads.

## A bug the tests did not catch

Today the counts card said "1 chai today", but the "my days" grid said "nothing logged". The counts
asked the server again every minute; the grid asked once. The fix was small: the grid now asks again
when a new entry comes in. Plus a new test that logs a chai while the page is open, so the tests
catch it next time.

That is the loop: I notice, the agent fixes and adds a test, and the rules file gets a little longer.
