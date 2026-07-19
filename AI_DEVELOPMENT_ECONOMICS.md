# AI Development Economics Report

<!-- markdownlint-disable MD013 -->

## Executive summary

The initial Golden Gate Bridge application was built in one Kimi Code session using the `kimi-code/k3` model at maximum thinking effort. Local session records show **1 hour, 18 minutes, and 21 seconds of active successful agent-turn time**.

The same application is estimated to require **21–36 full developer-days** for an experienced Three.js engineer to implement manually from a clear specification. On those assumptions, Kimi compressed the implementation work by approximately **129×–221× when comparing model-active time with manual engineering time**.

The session processed **14.50 million tokens**. At Kimi K3's published API rates, those tokens represent approximately **¥48.12, or US$7.10**, of API-equivalent model usage. Comparable manual labor is estimated at **$12,600–$43,200**, depending on time and fully loaded hourly rate.

These figures demonstrate the leverage of AI-assisted implementation, but they are not a claim that a complete software project costs only $7.10. Product direction, prompting, review, production deployment, and subsequent maintenance still require human judgment.

## What was measured

The source was Kimi Code CLI `0.27.0` session:

```text
session_935268ec-b49c-4955-bef9-37fd9fb1ded8
model: kimi-code/k3
thinking effort: max
successful model responses: 123
user turns: 8
```

The session created the initial repository commit, including the interactive Three.js application, procedural bridge and environment, camera controls, traffic simulation, vendored runtime dependencies, and browser automation scripts.

Cloudflare productionization, GitHub Actions CI, and the later project documentation were separate follow-up work and are not counted as Kimi output in the primary comparison.

## Time methodology

Wall-clock session duration is deliberately excluded. The session hit Kimi's subscription rate limit twice and contained long periods when no agent work was occurring. Counting the full session span would therefore misrepresent implementation time.

Active time was calculated separately for each successful agent turn:

1. Start at the first logged Kimi request for that turn.
2. End at the last successful response for that turn.
3. Sum the resulting turn spans.
4. Exclude both failed rate-limit requests and all gaps between turns.

| Turn | Active span |
| ---: | ---: |
| 0 | 29m 12s |
| 1 | 9m 6s |
| 2 | 7m 44s |
| 3 | 25m 10s |
| 4 | 58s |
| 5 | 2m 19s |
| 6 | 3m 52s |
| **Total** | **1h 18m 21s** |

The 123 successful model calls spent approximately **1h 11m** waiting for first tokens and streaming responses. The remaining active-turn time was used for tool execution and orchestration. Failed rate-limit latency is excluded from both figures.

## Token usage

Kimi Code's exported `usage.record` entries contain per-request input, cache, and output accounting.

| Token category | Tokens | Share of all tokens |
| --- | ---: | ---: |
| Uncached input | 425,631 | 2.94% |
| Cached input | 13,959,273 | 96.26% |
| Output | 116,926 | 0.81% |
| **Total input** | **14,384,904** | |
| **All processed tokens** | **14,501,830** | **100%** |

The unusually large cached-input total reflects agentic coding behavior: each model step revisits a substantial working context. Prompt caching makes that repeated context much less expensive than uncached input.

## AI cost calculation

The session used Kimi's managed OAuth subscription provider. Kimi Code did not store a per-session invoice or USD charge, so **actual subscription cost attributable to this single session cannot be determined**. There is no evidence of a separate metered charge for the session.

For a reproducible comparison, this report calculates its API-equivalent value using the K3 prices published on July 18, 2026:

| Usage | Price per million tokens | Calculation | Cost |
| --- | ---: | ---: | ---: |
| Uncached input | ¥20 | 0.425631 × ¥20 | ¥8.51 |
| Cached input | ¥2 | 13.959273 × ¥2 | ¥27.92 |
| Output | ¥100 | 0.116926 × ¥100 | ¥11.69 |
| **Total** | | | **¥48.12** |

Using the July 18, 2026 exchange rate of **6.7767 CNY per USD**:

```text
¥48.123766 ÷ 6.7767 = US$7.10
```

Pricing source: [Kimi API Platform](https://platform.kimi.com/). Exchange-rate source: [USD/CNY historical data](https://www.investing.com/currencies/usd-cny-historical-data).

## Manual development estimate

Lines of code alone are a poor predictor for 3D graphics work. Much of the effort is visual experimentation: tuning geometry, lighting, materials, cameras, animation, controls, and GPU performance. The following bottom-up estimate assumes an experienced Three.js developer, a clear specification, and reuse of Three.js rather than writing a rendering engine.

| Work area | Estimated developer-days |
| --- | ---: |
| Scene architecture and rendering pipeline | 2–3 |
| Procedural bridge geometry | 5–8 |
| Terrain, water, sky, lighting, and fog | 4–7 |
| Orbit, free-flight, presets, and object interaction | 3–5 |
| Traffic and day/night effects | 2–4 |
| Visual tuning, debugging, and browser validation | 4–7 |
| Packaging vendored assets and automation scripts | 1–2 |
| **Comparable Kimi scope** | **21–36 days** |

At eight hours per day, this is **168–288 engineering hours**. A midpoint planning estimate is **28.5 days, or 228 hours**.

Productionizing the entire current repository—including Cloudflare build configuration, CI, deployment verification, and durable documentation—raises the broader estimate to approximately **23–40 developer-days**. That broader scope is not used for the primary speed comparison because it was completed after the Kimi session.

## Human labor cost scenarios

Fully loaded engineering cost varies by geography, employment model, benefits, and overhead. This report uses $75, $100, and $150 per hour rather than presenting one rate as universal.

| Manual effort | At $75/hour | At $100/hour | At $150/hour |
| --- | ---: | ---: | ---: |
| 168 hours / 21 days | $12,600 | $16,800 | $25,200 |
| 228 hours / 28.5 days | $17,100 | $22,800 | $34,200 |
| 288 hours / 36 days | $21,600 | $28,800 | $43,200 |

The central planning scenario is therefore **$22,800 of manual labor**: 228 hours at $100/hour.

## Comparison

| Metric | Kimi K3 session | Manual implementation |
| --- | ---: | ---: |
| Active implementation time | 1.306 hours | 168–288 hours |
| Time multiple | 1× baseline | 129×–221× longer |
| Central time comparison | 1.306 hours | 228 hours / 175× longer |
| Model or labor cost | $7.10 API-equivalent | $12,600–$43,200 |
| Central cost comparison | $7.10 | $22,800 / 3,211× higher |
| Authored application and automation code | ~1,250 logical lines | Similar deliverable |

Across the full scenario range, manual labor is approximately **1,774×–6,083× the API-equivalent model cost**. The range should be interpreted as economic leverage, not literal net savings: it does not price the user's prompting time, review, local hardware, subscription fee, future maintenance, or the risk of defects.

## Why the acceleration was possible

Several characteristics made this project well suited to agentic generation:

- The desired output was visually demonstrable in a browser, enabling rapid screenshot-driven iteration.
- Three.js supplied a mature rendering engine and reusable controls, water, sky, and post-processing components.
- Procedural geometry represented the bridge more compactly than hand-authored 3D assets.
- Kimi could repeatedly edit, serve, inspect, and refine the application within one tool-using session.
- Prompt caching reduced the cost of repeatedly providing the growing project context.

## What the comparison does not prove

This is a case study of one project, model, prompt sequence, and developer. It does not establish a universal productivity multiplier.

- Active model time is not the same as total human elapsed time. The user's steering and review time was not recorded precisely.
- Human estimates are forecasts, not measurements from a parallel implementation.
- AI output still requires ownership, testing, security review, accessibility work, and maintenance.
- The Kimi session exhausted its subscription quota twice; API-equivalent pricing does not describe the subscription's actual billing allocation.
- The current production repository includes improvements made after the measured Kimi session.
- A developer might reduce manual time by starting from a template, purchasing a 3D model, or narrowing visual quality.

The defensible conclusion is narrower: **for this project, Kimi produced a substantial, working 3D implementation in about 78 minutes of measured active agent time, using tokens with an API-equivalent value near $7.10, while a comparable manual implementation plausibly represents several weeks of expert work.**

## Reproducibility

The audit used local Kimi Code artifacts rather than estimates from chat history:

- `~/.kimi-code/session_index.jsonl` identified the Golden Gate session.
- The session's `state.json` supplied its title, workspace, and timestamps.
- The session diagnostic log supplied model name, thinking effort, request timing, output-token checks, and rate-limit failures.
- `kimi export` supplied `agents/main/wire.jsonl`, containing 123 structured `usage.record` entries.
- Token totals were calculated by summing `inputOther`, `inputCacheRead`, `inputCacheCreation`, and `output` across those records.
- Active time was calculated from per-turn request/response timestamps, excluding inter-turn gaps and failed rate-limit requests.

All token and timing values in this report can be regenerated from session `session_935268ec-b49c-4955-bef9-37fd9fb1ded8` on the originating computer.
