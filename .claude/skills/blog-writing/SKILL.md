---
name: blog-writing
description: "Write or edit a post for kichoow.com/blog (posts/*.md) so it is easy to read and has no filler: a how-to guide, a story, a note. Use when the user asks for a blog post, a guide, or to make a post clearer or shorter."
---

# Write a readable post

Readers scan first: 79% of people scan a new page and only 16% read word by word (Nielsen Norman
Group). A post must work for the scanner and reward the reader. The rules below come from the
sources at the end; each one says what to do, not why it is nice.

## Before you write

- **One goal.** Say in one sentence what the reader can do after the post. Cut anything that does
  not serve it (Google technical writing: "delete any sections that don't help satisfy the scope").
- **Real facts only.** Your own setup, numbers and stories, like the rest of the site. Say why you
  wrote it (Julia Evans).
- **Ask kish.** The post is kish's words: draft only when asked, and show it before it ships.

## The shape

1. **Title:** what the post does. A guide is "How to …" (Diátaxis). No clever titles.
2. **The top answers the scanner** (inverted pyramid): what you get, who it is for (**You need:**),
   and what it cannot do. The reader knows in 10 seconds if the post is for them.
3. **"How it works":** 3–6 lines, often a small `text` diagram. Then the steps.
4. **Steps:** numbered lists for a sequence, bullets for a set. One action per step.
5. **Headings** mean something and use sentence case ("Receive the reports", not "Backend").
6. **The end is useful:** tips, limits, a link to the full code. No "Conclusion", no "Thanks for
   reading".
7. **Alternatives:** one line on the obvious other way and why you did not use it ("Why not the
   Spotify API?"). It saves the reader a question.

## The sentences

- **15–20 words, never over 25** (GOV.UK). Split long ones, or make them a list.
- **Common words.** Many readers are not native speakers (Paul Graham, "Write Simply").
- **One idea per paragraph**, 1–3 sentences (Nielsen Norman Group).
- **"You", active voice, present tense** (Google developer style guide).
- **No filler:** no "In this post we will", "simply", "just", "basically", "it's worth noting",
  "powerful", "seamless". No promotional words; they make readers work harder (NN/g: objective
  text tested 27% better).
- **Jokes:** at most two, short and dry, like the site ("Green bubbles win this one."). Never
  self-praise.
- **Code words** in code font: `listen_type`, `/1/submit-listens`.

## Code

- **Run every snippet** before it goes in the post (wrangler dev, the real request bodies, the real
  API). A guide with broken code is worse than no guide.
- The shortest code that works, then a link to the full version.
- Comments say why, not what. Name the fence language (```js, ```sh, ```json) so Shiki colours it.
- Secrets: say where they go (a Worker secret), never show a real one.

## Data stories (The Pudding's way)

For a post built on kish's own data (chai, Reels, songs, beach and badminton days):

- **One curious question** as the title, answered with real data ("When does kish drink chai?").
  The description is one clear number ("I logged 412 chais in 90 days").
- **The reader takes part first:** a guess or a pick, then the reveal next to the real data.
- **Open with the strongest finding, or with one real moment** ("Tuesday, 5 am, the third chai")
  before the big picture.
- **One point, one chart, stacked:** each step adds one idea and one picture. Charts carry the key
  points; text is short. For steps that change on scroll, use `react-scrollama` (Scrollama, what The
  Pudding uses) and the `d3-scale` / `d3-shape` already in the repo. No hand-rolled scroll code.
- **It can stay live:** read the numbers from the API, so the story updates (their "Updating" kind).
  Pre-render a real snapshot, so the page has no layout shift and works without JavaScript.
- **End with "how I got this":** where the data comes from, what it misses, and the dates.
- **Enough data first:** a pattern needs weeks of data. Do not publish a trend from a few days.
  Real data only: never fill a chart with made-up points.

## Check before you ship

1. Read it top to bottom as a scanner: headings, bold words and the first line of each part. Does
   that alone tell the story?
2. Find sentences over 25 words (outside code) and split them.
3. Cut: aim for half the words of the first draft (NN/g: concise text tested 58% better).
4. `npm run build` (front matter is checked), then screenshot the post at 1280 px and 390 px, in
   light and dark.
5. The link check (`lychee`, `.github/workflows/links.yml`) must pass on the pull request.

## Sources

- Nielsen Norman Group, "How Users Read on the Web": https://www.nngroup.com/articles/how-users-read-on-the-web/
- Diátaxis, "How-to guides": https://diataxis.fr/how-to-guides/
- Google, "Technical Writing: documents": https://developers.google.com/tech-writing/one/documents
- Google developer documentation style guide: https://developers.google.com/style/highlights
- GOV.UK, "Writing for GOV.UK": https://www.gov.uk/guidance/content-design/writing-for-gov-uk
- Paul Graham, "Write Simply": https://paulgraham.com/simply.html
- Julia Evans, "Some tactics for writing in public": https://jvns.ca/blog/2023/08/07/tactics-for-writing-in-public/
- The Pudding, "How to Make Dope Shit, Part 3: Storytelling": https://pudding.cool/process/how-to-make-dope-shit-part-3/
- The Pudding, example: "Why some people mow a lawn better than others": https://pudding.cool/2026/06/mow/
