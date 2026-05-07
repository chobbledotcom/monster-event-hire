---
permalink: false
---

# Location Pages - Audit & Improvement Plan

A working audit of the 41 location pages under `/areas-covered/`, with concrete recommendations for surfacing the EEAT credentials from `EEAT-CREDENTIALS.md` and breaking the duplicate-content pattern.

---

## 1. The headline problem

| Issue                                                                                                          | Count                                                                                    | Impact                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pages sharing the identical "stewards of fun" boilerplate (same 4 paragraphs, only place name swapped)         | **39 of 41**                                                                             | Duplicate content. Google deduplicates and only ranks one. The other 38 effectively don't exist for SEO.                              |
| Pages with AI-generated rewrites (ChatGPT `data-start`/`data-end` markers + emoji-style structure)             | **7** (Berkshire, Dorking, Farnham, Fareham, Gosport, Farnborough, Richmond-upon-Thames) | Templated, machine-detectable, no trust signal.                                                                                       |
| Pages using the old WordPress h1 + category-list layout                                                        | **1** (Enfield)                                                                          | Out of step with the rest of the site.                                                                                                |
| The "area testimonial" included on **every** area page is hardcoded to a single quote                          | All 41                                                                                   | Same Matt / Head of Boarding testimonial appears on every page. Another duplicate-content signal. (`_includes/area-testimonial.html`) |
| Pages that mention the Havant base or proximity to the customer                                                | **3 of 41**                                                                              | Missed trust signal - "we're 18 miles down the A3" beats a generic landing page.                                                      |
| Pages that surface ANY of the EEAT credentials (£10m PLI, PIPA, RPII, DBS, established 2002, anemometer, etc.) | **0 of 41**                                                                              | The strongest selling points are completely absent from the highest-intent local landing pages.                                       |

**Net effect:** the area pages are absorbing keyword traffic but converting none of the trust signal that the home page, About page and Health & Safety page contain. They read as auto-generated SEO filler - which they currently are.

---

## 2. What the layout already does for you

Before recommending what to add to each page, it's worth being clear what the `wp-area.html` layout already injects automatically (so we don't waste body content duplicating it):

- **Page title and breadcrumb** (driven by `page_title` in front-matter)
- **Category grid** with the area name interpolated into each card (`area-loc-cats.html`)
- **Sidebar, enquiry form, footer locations, logos**
- **Area testimonial** (`area-testimonial.html` - but this is hardcoded; see §6)

So the **body content of each area page** only needs to contribute:

1. The locally-distinctive intro (the bit that _isn't_ shared)
2. The trust strip
3. Optional: area-specific testimonials, featured products, related-links list

Currently, most pages use the body for nothing but generic boilerplate.

---

## 3. The three patterns observed

### Pattern A - "Stewards of fun" boilerplate (39 pages)

Example: `areas-covered/havant/index.html`, `areas-covered/waterlooville/index.html`, and 37 others.

```
You can't have an event or party in {PLACE} without entertainment! Not only that,
but the entertainment has to be enjoyed by all. Fear not, for Monster has you covered!

In {PLACE} and surrounding regions, we've built a fantastic reputation for being the
party and events specialists. Whether it's a photo booth for your wedding or an
assault course for your fundraiser, Monster has all the gear you need. With our
trained and friendly team, you can rest assured that your event is equipped and
ready to go.

[area-related-links include]

We are the stewards of fun, so if you're unsure about the entertainment, get in
touch and we'll guide you to a great party. If you're already sure about what you
want, give us a call anyway and we'll provide your party needs.

Ring us on 02392 788 427 or enquire on site today.
[area image]
```

This text contains **zero local information** and **zero trust signals**. Copying it 39 times with different town names is a classic "doorway page" pattern that Google's helpful-content updates explicitly devalue.

### Pattern B - AI-generated rewrites (7 pages)

Example: `areas-covered/dorking/index.html`. Has H2s like _"Wide Range of Event Entertainment in Dorking"_, _"Your Local Dorking Event Hire Specialists"_, _"Book Your Dorking Event Hire Today"_, an SEO keyword list at the bottom (_"event hire Dorking, party hire Dorking..."_), and ChatGPT export markers (`data-start`, `data-end`).

Reads more naturally than Pattern A but is still entirely generic - swap "Dorking" for any other town and nothing changes. And the `data-start`/`data-end` markers are a giveaway to anyone (including search-engine quality reviewers) that the content was machine-generated.

### Pattern C - Old WordPress (1 page)

`areas-covered/enfield/index.html` (covers London). One H1, two paragraphs of mediocre copy, then a manual list of category links each suffixed with " London". Functionally similar to Pattern A but visually different. Should be brought into line with whatever new template is adopted.

---

## 4. Recommended new content structure

A target structure for every area page, in body-content order. This is what should go inside the `{{ content }}` block of `wp-area.html`. It should produce **roughly the same length per page (~400–500 words)** but with **the locally-distinctive bits genuinely different** and the trust signals consistent.

### 4.1 Locally-distinctive intro (1–2 short paragraphs - must differ between pages)

Pick from any combination of the following, depending on the area:

- **Distance / route from the Havant base** - _"We're based 14 miles from Aldershot, just up the A3 and across the M27"_. Concrete, true, and signals "we actually deliver here", not "we'd love your money".
- **Local landmarks or venue context** - _"From village halls in Petersfield to corporate sites at Whiteley and Lakeside North Harbour, we deliver across the Havant–Portsmouth corridor most weeks of the year."_
- **Named local client where one exists** (see §7 for the testimonial → area mapping).
- **Local event types they actually serve** - school summer fairs, council fun days, scout/guide camps, weddings at named venues, university summer balls.

### 4.2 Trust strip (consistent across pages - surfaces EEAT)

A short bullet list, identical or near-identical on every page. Pulled directly from `EEAT-CREDENTIALS.md` §8:

- Established 2002 - family-run by Joanne and David Morris
- £10 million Public Liability Insurance - certificate on request
- All inflatables PIPA-tagged and RPII-inspected annually
- In-house PIPA-certified inflatable inspector and RPII inspector
- Every member of staff enhanced-DBS registered
- All electrical equipment annually PAT-tested
- Anemometer + documented wind-safety protocol issued with every hire
- Licensed-premises insurance - cleared for pubs, clubs and bars
- Trusted by councils, charities, government research agencies and corporates

This block can live in a new `_includes/area-trust-strip.html` so it's edited in one place. **Crucially** - when this exists on the page, the duplicate-content risk _decreases_ rather than increases, because Google evaluates page-level uniqueness; a consistent trust block alongside genuinely unique local content is fine, whereas the current state (consistent generic block alongside _no_ local content) is what gets penalised.

### 4.3 Area-specific testimonial (where available)

Replace the hardcoded `area-testimonial.html` with a lookup that surfaces a testimonial **for that area** if one exists, falling back to the generic Matt quote otherwise. See §7 for the mapping.

### 4.4 The auto-included category grid (no change)

The `area-loc-cats.html` block at the bottom of the layout already provides the category-link grid with the area name interpolated. That's fine. No body-content action needed.

### 4.5 Local CTA paragraph (1 sentence - can vary slightly)

E.g. _"Booking an event in Aldershot? Call us on 02392 788 427, or use the enquiry form for a same-day quote."_ Keep the phone number consistent; vary the opener.

---

## 5. Priority tiers - where to spend the effort first

Not every area page is worth equal investment. Suggested priority order:

### Tier 1 - Core local market (rewrite first; full local content + trust strip + named clients)

These are the areas closest to the Havant base, where Monster has the strongest local credibility and the highest expected booking rate per visit.

- **Havant** - home base. Should be the strongest page on the site. Mention the Havant base address, the Joanne/David founding story, the in-house workshop.
- **Portsmouth** - closest major city; high search volume.
- **Southampton** - Enham testimonial places a documented charity rodeo here. Use that.
- **Petersfield, Alton** - East Hampshire territory; the Lucy Soal / East Hampshire District Council testimonial belongs on these pages (see §7).
- **Fareham, Gosport, Waterlooville** - closest to base; should explicitly note "we're often 20 minutes away".
- **Winchester, Basingstoke, Andover, Romsey** - established Hampshire reach.

### Tier 2 - Extended Hampshire/Surrey/Sussex (rewrite second; local content + trust strip)

- **Guildford** (mentioned in inspections page as second office), **Farnham, Farnborough, Aldershot, Camberley, Fleet, Alton** - Surrey/north-Hants belt.
- **West Sussex, Lymington, Ringwood** - coastal/New Forest reach.

### Tier 3 - London + Oxfordshire (rewrite third; reposition as travel-aware)

- **London, Enfield, Barnet, Brent, Croydon, Dorking, Harrow, Hounslow, Islington, Kensington, Lewisham, Richmond-upon-Thames, Sutton, Wandsworth** - these need a different angle: "we travel to London regularly with marquees, photo booths, rodeos and assault courses for corporate events". Mention the **Ealing Playday** repeat client.
- **Oxford, Oxfordshire** - the **STFC / Cosener's House** event was in Abingdon (Oxfordshire). Use Andrew McGregor's testimonial here.

### Tier 4 - Regional umbrella pages (consolidate)

- **Hampshire, Surrey, Sussex, West Sussex, Berkshire, Oxfordshire, London** - these are county/region-level pages. They should serve as **hubs** linking to the town pages within them, with a regional-level intro and the standard trust strip.

### Quick-win across all tiers

Replace the hardcoded `area-testimonial.html` with a per-area lookup (§7) - a single layout change that lifts every page at once.

---

## 6. The hardcoded-testimonial problem

`_includes/area-testimonial.html` is currently a single fixed block:

> _"Dear Joanne, Please do pass on my thanks and best wishes to the two guys who set up and took down the equipment on Friday night..."_ - Matt, Head of Boarding (SLT)

This appears on every one of the 41 area pages, identically. That's a strong duplicate-content signal and a missed local-relevance opportunity.

**Recommended fix:** make `area-testimonial.html` look up a testimonial associated with the page's area (via front-matter `area_testimonial: <reviews-slug>` on the area page, or a tag/data lookup), falling back to the current Matt quote if nothing matches. Eleventy can do this with a simple collection filter; happy to spec the implementation if useful.

---

## 7. Testimonial → area mapping (where evidence ties a review to a place)

From the 34 archived testimonials in `reviews/`:

| Testimonial                                                                | Area page(s) it should appear on                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Lucy Soal - East Hampshire District Council** (5+ year council festival) | `petersfield/`, `alton/`, `havant/` (East Hants is the council's territory). Also `hampshire/` umbrella. |
| **Andrew McGregor - STFC at Cosener's House** (Abingdon, Oxfordshire)      | `oxford/`, `oxfordshire/`                                                                                |
| **Fran Regan & Karen Esprit - Ealing Playday**                             | `london/`, `brent/`, `hounslow/`, `harrow/` (Ealing is in/near these)                                    |
| **Enham - charity rodeo, Southampton shopping centre**                     | `southampton/`                                                                                           |
| **Tim Smith - Havant Family Church**                                       | `havant/`                                                                                                |
| **Lee Alexander - CooperVision** (UK office: Hampshire)                    | `southampton/` or `fareham/` (CooperVision UK is in Hampshire) - owner to confirm exact location         |
| **Karen - Maynard family birthday (rodeo bull, sumos, human bowling)**     | Owner to confirm location, then place                                                                    |
| **Tamara and Adrian - wedding (crazy golf)**                               | Owner to confirm location                                                                                |
| **Anne Porter - wedding (marquee)**                                        | Owner to confirm location                                                                                |

For testimonials where the review file doesn't record the location, owner clarification would let many of the 34 testimonials be tied to specific area pages.

---

## 8. The duplicate-template-wording cleanup

The 39 "stewards of fun" pages need their body content rewritten from scratch - there's no salvaging it by tweaking phrasing, because the duplicate-content problem is structural. A reasonable workflow:

1. **Build a single new template** (per §4) with placeholders for `{LOCAL_INTRO}`, `{LOCAL_TESTIMONIAL_SLUG}`, `{LOCAL_CTA}`.
2. **Tier 1 pages first** - handcraft these in the owner's voice (they should be the best, since they convert the most).
3. **Tier 2 pages next** - same template, lighter local detail (one local landmark / route reference is fine).
4. **Tier 3 pages** - emphasise the travel/specialism angle rather than trying to fake local knowledge.
5. **Tier 4 umbrella pages** - write last, once the town pages exist to link from them.

For the 7 AI-generated pages: same treatment - strip the `data-start`/`data-end` markers, drop the SEO-keyword footer list, rewrite in the owner's voice with local detail and the trust strip.

---

## 9. Quick-win checklist for the owner

If only one thing gets done from this audit, do this:

- [ ] Replace `_includes/area-testimonial.html` with a per-area lookup (instant lift across all 41 pages).
- [ ] Add a `_includes/area-trust-strip.html` containing the EEAT bullet list, and include it on every area page (instant trust signal across all 41 pages).
- [ ] Rewrite the **Havant** page first, in your own voice, mentioning the workshop, the Morris family, and the local market. This becomes the model for all the others.
- [ ] Add 2–3 sentences of local distinctiveness to **Tier 1 pages only**. Even one true local sentence per page kills the duplicate-content pattern.
- [ ] Strip `data-start`/`data-end` markers from the 7 AI-generated pages - this is a five-minute find-and-replace and removes the most obvious "this is machine-generated" tell.
