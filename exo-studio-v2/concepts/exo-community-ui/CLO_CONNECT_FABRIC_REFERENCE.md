# CLO-SET CONNECT Fabric Store — public interface reference

**Observed:** October 16, 2026. **Reference:** https://connect.clo-set.com/store/fabric  
**Scope:** Public, unauthenticated HTML of the fabric storefront, checked through direct HTTPS retrieval and an independent rendered-page text extraction. EXO comparison uses local `index.html`, `app.js`, and `edition-three.css`. No login, external assets, proprietary code reuse, or private catalog access.

## Evidence levels

- **Verified visible:** Text or markup actually delivered in the public storefront response.
- **Markup inference:** Presentation or interaction suggested by delivered HTML/classes, without browser interaction proof.
- **Unverified:** Detail that cannot be established from the unauthenticated HTML response; do not label it as a reproduced feature.
- **EXO proposal:** A locally designed interaction inspired by the reference hierarchy; it is not an assertion about the original store.

## Verified public hierarchy

1. **Global header:** `Home`, `Store`, `Explore`, `Contest`, `Community`, `Apps`, plus `Sign In` and `Sign Up` controls. The response contains some duplicate header/category text, plausibly separate responsive compositions; do not interpret them as two simultaneously visible toolbars.
2. **Store identity/intro:** “Share your ideas. Empower your design.” There is a store-wide category/navigation row with **All / Garment / Fabric / Trim / Avatar / Scene**. Fabric is the active category implied by the route and category-specific search placeholder.
3. **Search:** Search input with the exact public placeholder **“Search for Fabric”**. At least one copy exists near the store catalog controls; responsive duplicates are present in the HTML.
4. **Filter row:** Ten named facets are available: **Fabric Type**, **Composition**, **Usage Type**, **Season**, **Color**, **Pattern**, **Physical Property**, **Supplier**, **Official**, **Price**. The leading facet displays **“Fabric Type | All”**, which establishes the unfiltered/default indication for that facet. There is a conspicuous **RESET** control.
5. **Result ordering:** The current visible order is **Featured**. Markup pairs this text with a chevron/dropdown-like SVG and a clickable-looking container. Further ordering choices have not been established.
6. **Catalog/results area:** Public HTML contains repeated skeleton/loading placeholders following the Featured row. Product titles, prices, badges, thumbnails, supplier names, and item counts were not verified from this response. Avoid inventing card placement, button labels, or stock metadata.
7. **Footer/discovery:** Links include Store, Curator's Pick, inZOI, VRChat, Gallery, Creator, Contest, Community and app links (EveryWear, LiveSync, AR Filter, Jinny), with Terms, Privacy and Help Center.

## Exact filters: observed versus unknown

| Filter heading | Verified public evidence | Options/behavior still unverified |
| --- | --- | --- |
| Fabric Type | Exact label; unfiltered text “All” | Named types, multi-select support, result counts |
| Composition | Exact label | Fiber choices, combination logic, percentages |
| Usage Type | Exact label | Uses/categories, nested options |
| Season | Exact label | Seasonal choices or range handling |
| Color | Exact label | Swatches, color names, multi-select |
| Pattern | Exact label | Pattern types and thumbnails |
| Physical Property | Exact label | Units, ranges, validated mechanical properties |
| Supplier | Exact label | Supplier directory, autocomplete, verified IDs |
| Official | Exact label | Toggle versus menu; qualification semantics |
| Price | Exact label | Free/paid values, currency, numeric range |

**Interaction boundaries:** The HTML also confirms `RESET`, `Search for Fabric`, and `Featured`. Actual search submission, filter expansion/selection, sort-menu items, reset effects, pagination/infinite scroll, hover behavior, favorites, add-to-cart, downloads, product detail screens and responsive breakpoint outcomes were **not exercised**. Do not claim they are verified. Public content appears to be hydrated dynamically; the server response alone is incomplete for live product cards.

## Dark visual treatment: grounded observations

The returned document explicitly sets `<html ... data-theme="dark" data-theme-product="connect">`. Visible class tokens include `text-grayscale-solid-g8`, `text-grayscale-solid-g10`, `border-grayscale-opacity-blevel3`, `bg-transparent`, `rounded-full`, `text-s3`, `gap-s1`, `transition-colors`, and `hover:bg-grayscale-opacity-fixed-glevel4`. This supports a dark, grayscale-token-driven interface with compact labels, subtle borders, rounded pill controls and restrained hover transitions. The sort control is described in markup as a full-width inline flex row with horizontally separated title and chevron.

**Not established:** Exact hex values, pixel spacing, final product-card geometry, media crop ratios, modal behavior and mobile screenshots. Treat any such implementation values as EXO design decisions, not measurements copied from CONNECT.

## Current EXO community comparison (local source audit)

| Area | CONNECT public reference | EXO community implementation found in source | Concrete design gap |
| --- | --- | --- | --- |
| Category navigation | All, Garment, Fabric, Trim, Avatar, Scene | Discover, Patterns, Materials, Studios and related views | Add a coherent fabric-store-specific taxonomy; preserve existing EXO navigation context |
| Fabric searching | “Search for Fabric” | Global `#catalog-search` searches title/creator/category; Pattern Lab has `#lab-search` | Give fabrics focused searching and meaningful material attributes |
| Faceted discovery | Ten fabric-specific filters and RESET | Discipline, license, format and remix filtering; limited material sample inventory | Build independent fabric facets and reset state |
| Ordering | Featured displayed | Curated first, Recently added, Name A–Z, Free first | Style a cleaner catalog sort; mark alternate options as EXO-owned |
| Result cards | Dynamic product card content not inspectable in public HTML | Local cards include generated asset previews, creator, title, price, description, formats and remix status | Create unified fabric specimen photography-style presentation with procedural original visuals and legible metadata |
| Material taxonomy | Fabric-store-specific structure | Two primary local `Materials` assets: Loopback French Terry and Washed Suede | Expand the library and attach composition, structure, weight, supplier and intended use metadata only when sourced |
| Physics | Public “Physical Property” filter heading | EXO currently labels sample GSM illustrative and physics unmeasured; material visualizations are procedural | Keep measured fabric data separate from cosmetic PBR; do not imply measured drape from visual mockups |
| Detail flow | Card interactions not verified | EXO detail modal and Pattern Lab preview, save/import concept controls | Improve specimen examination, map previews and provenance; keep demo import labeling honest |
| Surface styling | Explicit CONNECT dark mode and compact neutral controls | Existing EXO CSS and concept pages use a custom editorial aesthetic; some specimens use warm reading surfaces | Make materials browsing cohesive in dark mode, while retaining bespoke EXO identity |

## Proposed EXO fabric-store specification (design proposal, not CONNECT observation)

1. **Page layout:** EXO-branded dark header, secondary category tabs, left or collapsible faceted filters, top search/results/sort toolbar, dense responsive fabric card grid, optional inspector drawer. Reuse local type scales and design tokens.
2. **Facets:** Implement all ten reference *headings* in the exact order observed. Initially provide only values backed by EXO's local material records. Apply selections to a single deterministic filter function; RESET clears only catalog filter state, and a visible count reflects filtered records.
3. **Cards:** Original procedural square/portrait fabric specimens showing repeat scale, weave, roughness and tone; concise fiber/structure/weight metadata, supplier attribution when known, licensing/access state and a detail affordance. No imported CLO images.
4. **Details:** Offer zoomable flat texture and optional original 3D drape illustration, texture channels (albedo/normal/roughness/displacement) with clear visual-only labels, composition and measured physical properties with units and provenance, usage/season tags, and file format/licensing. Missing values should read **Unmeasured** or **Unknown**, not fabricated numbers.
5. **Interaction:** Search on input; keyboard-operable filters, selected filter chips, clear-all button, sort selection, card inspection, favorite/save locally where applicable, loading/empty states and mobile filter drawer. Verify with browser QA before declaring operational parity.
6. **Scientific fidelity:** Treat PBR appearance independently from cloth simulation parameters. When measured tensile/shear/bending or thickness data is available, identify methods, units, source and applicability. Wash and finishing effects can be procedurally previewed as appearance studies until production outcomes are measured.
7. **Visual system:** Deep charcoal panels, differentiated near-black background layers, subtle one-pixel neutral borders, clear white primary text, muted secondary labels, a single restrained interaction accent, square specimen presentation and compact controls. Contrast ratios and exact colors are EXO choices and require validation.

## Follow-up evidence needed before claiming exact parity

A real desktop browser session should capture an unauthenticated screenshot at wide and narrow widths, open each public filter and the Featured sort dropdown, record the visible option text, test search/reset, inspect the first accessible product card and its detail route, and note any sign-in gates. Keep dated screenshots and a browser observation log, with explicit separation between observed behavior and EXO interpretations.

**Reference URLs:** [Fabric store](https://connect.clo-set.com/store/fabric) · [Public Help Center](https://connect-hc.zendesk.com/). The public store HTML returned HTTP 200 at the time of review.
