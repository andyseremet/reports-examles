# Monetisation plan

How Property Location Check could accept **voluntary** support, as decided with the owner on 5 November 2026.
Nothing here is built yet. The app stays exactly as it is until the owner decides to switch support on, when the
product is complete.

## 1. Principles

- The app is and stays **free for everyone**, with every feature. Nobody is ever asked to pay to see, save, print,
  download or share a report.
- Support is **voluntary**: anyone who finds the app useful can choose to contribute to, or sponsor, its development.
- Sharing the app is encouraged as much as possible.
- No paywall, no forced payment, no adverts, no tracking, no accounts.
- The support code is a **separate module**: it can be added or removed at any time with a one-line change, and the
  app works the same without it.

These principles are also a rule in `CLAUDE.md` ("Free for everyone").

## 2. How it fits into the app: a module and three hooks

### The module

| File | What it holds |
|---|---|
| `js/support.js` | All support code: the three ways to give, the amounts, the wording, and what is shown at each hook. |
| `css/support.css` | Its styles. `support.js` adds this stylesheet itself, so the app needs no second line. |

**Switching it on:** add one line to `index.html`, after `js/app.js` (the last script):

```html
<script src="js/support.js"></script>
```

**Switching it off:** delete that line. Nothing else changes. Offline support (`sw.js`) saves files in `js/` and
`css/` when they are first used, so it needs no change. The files can stay in the repository while switched off.

### The hooks (added to the app once, when support is built)

The app never mentions payments itself. It only offers three named places where a module may add something. With no
module loaded, each place stays empty and invisible.

| Hook | Where | What the module would show |
|---|---|---|
| `summary` | An empty slot after the report summary, once the report is complete. | One quiet line: "Found this useful? Support this free tool." with the ways to give. |
| `saved` | An event after someone downloads or prints a report. | A short thank-you note with the ways to give, which can be closed. |
| `footer` | An empty slot in the page footer, next to "Privacy" and "Data credits and licences". | A "Support this tool" link. |

How the hooks would work (a sketch, to be confirmed when built):
- Slots are empty elements such as `<div data-support-slot="summary" class="no-print"></div>`, hidden while empty.
- The app announces moments with a browser event, for example
  `document.dispatchEvent(new CustomEvent("plc:support", { detail: { hook: "saved" } }))`. If no module listens,
  nothing happens.
- The module fills the slots and listens for the events. It must not change or read anything else in the app.

### Rules for the module

- Never shown in printed or downloaded reports (slots carry `no-print`, and the download removes them).
- Never slows down or blocks a report: it loads after the app, and does nothing until a hook is reached.
- Uses plain links to the payment pages. It loads **no** payment provider scripts, so nothing is sent to Stripe,
  GitHub or PayPal until a visitor chooses to click.
- At most one message per report, never a pop-up over the report, always easy to close.
- The daily live check must pass both with and without the module (a test step runs the report with
  `js/support.js` removed).

## 3. Ways to give

All three are plain links, so no server is needed for voluntary contributions.

| Way | What the visitor can use | Cost to the project | Notes |
|---|---|---|---|
| **Stripe Payment Links** | Cards, Apple Pay, Google Pay, and PayPal (Stripe accounts in the UK can accept PayPal through Stripe) | Standard UK cards 1.5% + 20p; no monthly fee | One link per amount, or a link where the visitor chooses the amount. Refunds from the Stripe dashboard. |
| **GitHub Sponsors** | One-off or monthly sponsorship of the project on GitHub | No fee for sponsorships from personal accounts; up to 6% from organisations | Suits people who want to sponsor the development. The UK is a supported region. |
| **PayPal donate button** | PayPal account or card, on PayPal's own page | Standard PayPal rate (2.9% + 30p for UK payments; charity rates apply to registered charities only) | For people who prefer PayPal directly. |

**Suggested amounts:** £5, £10, £15, or any other amount the person is comfortable to give.

## 4. Before switching it on

1. Create the accounts and links: a Stripe account and Payment Links; a GitHub Sponsors profile; a PayPal donate
   button. Only the owner can do this.
2. Update "Privacy: what is sent where": the payment provider receives the visitor's payment details on its own
   page, and nothing is sent until the visitor clicks.
3. Add short terms for contributions: a voluntary gift, nothing is bought, and how to ask for a refund.
4. Check the terms of the services the app uses. Open-Meteo's free service is for non-commercial use only, and
   GitHub Pages must not be used mainly for commercial transactions. Neither lists a voluntary contribution link as
   commercial, but ask both before launch.
5. Tax: income from contributions may need declaring; VAT registration is needed only above £90,000 a year.
6. Build the module and the hooks as one version, released with `/release`, and test with and without the module.

## 5. Not planned: paid features

Considered on 5 November 2026 and **not wanted**: the app stays free. Ideas noted at the time were a free summary
with paid details, paying per report, a paid professional PDF sent by email, extra licensed data (BGS ground
stability and groundwater flooding), a conveyancer pack, and a report kept up to date before exchange of contracts.

If a paid product were ever wanted, it would need all of these first:
- a host that allows commercial sites (GitHub Pages does not allow e-commerce sites);
- a small server part that confirms each payment before anything is supplied (a paywall inside the page alone can be
  bypassed, because the app's code and data are public);
- commercial terms or replacements for the services whose free terms do not allow it: Open-Meteo (air quality),
  CARTO and Esri (map pictures), and Nominatim (address search, at most 1 request a second for all users together);
- terms of sale with the buyer's express consent and acknowledgement that the 14-day right to cancel is lost once
  digital content is supplied (Consumer Contracts Regulations 2013, regulation 37), a privacy policy, and a clear
  "not a legal search or advice" statement.

## 6. Decisions so far

| Date | Decision |
|---|---|
| 5 November 2026 | Paid report options explored (Stripe, PayPal, cards; pay per report). |
| 5 November 2026 | Chosen instead: the app stays free; support is voluntary, as a separate optional module added later. |
| 5 November 2026 | Amounts £5, £10, £15 or any amount; ways to give: Stripe Payment Links, GitHub Sponsors, PayPal donate button. |
| 5 November 2026 | Switched on and off by one script line; hooks after the report summary, after download or print, and in the footer. |

## Sources (checked 5 November 2026)

- GitHub Pages usage limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Sponsors fees and regions: https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors
- Stripe UK pricing: https://stripe.com/gb/pricing
- PayPal through Stripe: https://docs.stripe.com/payments/paypal
- Stripe Payment Links: https://docs.stripe.com/payment-links
- PayPal UK business fees: https://www.paypal.com/uk/business/paypal-business-fees
- PayPal donations: https://www.paypal.com/uk/cshelp/article/how-do-i-accept-donations-with-paypal-help200
- Open-Meteo terms: https://open-meteo.com/en/terms
- CARTO basemap licence: https://github.com/CartoDB/basemap-styles/blob/master/LICENSE.md
- Esri World Imagery (community answer): https://community.esri.com/t5/arcgis-location-platform-developers-ques/inquiry-about-world-imagery/m-p/1569266
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- VAT registration threshold: https://www.gov.uk/vat-registration/when-to-register
- Consumer Contracts Regulations 2013, regulation 37: https://www.legislation.gov.uk/uksi/2013/3134/regulation/37
