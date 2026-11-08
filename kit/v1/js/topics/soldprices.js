// Property Location Check – topic: Recent sale prices nearby. Everything about it in one file: its own data, how it is rated
// and worded, its icon and what to look at on a viewing. Listed in js/topics/index.js.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { escapeHTML, formatRadius, link, LINKS, plural, term, today } from "../core.js";
import { API, fetchJSON } from "../api.js";
import { unavailable } from "./helpers.js";

// Recent home sales near the pin, from HM Land Registry Price Paid Data (England and Wales).
// The data has no map positions, so we ask postcodes.io for the postcodes within SOLD_RADIUS_M,
// then ask Land Registry for standard sales of houses and flats in those postcodes.
const SOLD_RADIUS_M = 500, SOLD_YEARS = 3;

const SOLD_TYPES = { detached: "Detached", "semi-detached": "Semi-detached", terraced: "Terraced", "flat-maisonette": "Flat" };

async function getSoldPrices(loc) {
  const near = await fetchJSON(API.postcodes + "?lon=" + loc.lon + "&lat=" + loc.lat + "&radius=" + SOLD_RADIUS_M + "&limit=100");
  const postcodes = (near.result || []).map(r => r.postcode).filter(pc => /^[A-Z0-9 ]+$/.test(pc || ""));
  if (!postcodes.length) return { postcodes: 0, sales: [] };
  const since = new Date();
  since.setFullYear(since.getFullYear() - SOLD_YEARS);
  const query = `PREFIX ppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX lrc: <http://landregistry.data.gov.uk/def/common/>
    SELECT ?price ?date ?type ?newBuild ?street WHERE {
      VALUES ?pc { ${postcodes.map(pc => `"${pc}"`).join(" ")} }
      ?address lrc:postcode ?pc .
      ?sale ppi:propertyAddress ?address ; ppi:pricePaid ?price ; ppi:transactionDate ?date ;
        ppi:propertyType ?type ; ppi:transactionCategory ppi:standardPricePaidTransaction .
      OPTIONAL { ?sale ppi:newBuild ?newBuild }
      OPTIONAL { ?address lrc:street ?street }
      FILTER(?date >= "${since.toISOString().slice(0, 10)}"^^<http://www.w3.org/2001/XMLSchema#date>)
    } ORDER BY DESC(?date) LIMIT 1000`;
  const d = await fetchJSON(API.landRegistry + "?query=" + encodeURIComponent(query));
  const sales = (d.results?.bindings || []).map(b => ({
    price: Number(b.price.value), date: b.date.value,
    type: b.type.value.split("/").pop(), newBuild: b.newBuild?.value === "true",
    street: b.street?.value || ""
  })).filter(x => SOLD_TYPES[x.type] && x.price > 0);
  return { postcodes: postcodes.length, sales };
}

function median(values) {
  const v = [...values].sort((a, b) => a - b), mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const pounds = n => "£" + Math.round(n).toLocaleString("en-GB");

function checkSoldPrices(R) {
  const base = {
    source: { name: "HM Land Registry Price Paid Data", url: LINKS.pricePaidData },
    dataDate: "Sales are added about 1 to 2 months after they complete. Checked live on " + today()
  };
  if (!R.soldPrices.ok) return unavailable(base, R, "soldPrices");
  const { sales } = R.soldPrices.value;
  const where = `within ${formatRadius(SOLD_RADIUS_M)} in the last ${SOLD_YEARS} years`;
  const licence = `<p>Contains HM Land Registry data © Crown copyright and database right ${new Date().getFullYear()}.
    This data is licensed under the Open Government Licence v3.0.</p>`;
  const searchLink = link(LINKS.soldPrices, "Search house price data on GOV.UK");
  if (!sales.length) {
    return {
      ...base, status: "manual",
      found: `No home sales were found ${where}.`,
      meaning: `<p>This does not mean homes here have no value: there may simply have been no sales recorded nearby,
        or the area has few postcodes. Ask local estate agents, and look further afield.</p>${licence}`,
      actions: [`Look up sale prices for nearby streets on ${searchLink}.`]
    };
  }
  const rows = Object.entries(SOLD_TYPES).map(([key, label]) => {
    const prices = sales.filter(x => x.type === key).map(x => x.price);
    return prices.length ? `<tr><td>${label}</td><td>${prices.length}</td><td>${pounds(median(prices))}</td>
      <td>${pounds(Math.min(...prices))} to ${pounds(Math.max(...prices))}</td></tr>` : "";
  }).join("");
  const recent = sales.slice(0, 10).map(x => `<tr><td>${escapeHTML(new Date(x.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" }))}</td>
    <td>${pounds(x.price)}</td><td>${SOLD_TYPES[x.type]}${x.newBuild ? ' <span class="chip">New build</span>' : ""}</td>
    <td>${escapeHTML(x.street ? x.street.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "Not given")}</td></tr>`).join("");
  return {
    ...base, status: "info",
    found: `${plural(sales.length, "home sale")} ${where}. The median price was ${pounds(median(sales.map(x => x.price)))}.`,
    details: `<div class="table-wrap"><table><thead><tr><th>Type</th><th>Sales</th><th>Median price</th><th>Range</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p><strong>Most recent sales</strong></p>
      <div class="table-wrap"><table class="site-list"><thead><tr><th>Sold</th><th>Price</th><th>Type</th><th>Street</th></tr></thead>
      <tbody>${recent}</tbody></table></div>`,
    meaning: `<p>These are completed sales of houses and flats at market value, recorded by HM Land Registry. Sales of
      shops, offices and homes bought in bulk are left out. Prices depend on size, condition and the exact street, so use
      them as a rough guide only.</p>
      <p>The ${term("median", "The middle price when all sales are put in order")} is the middle price: half the homes sold for more and
      half for less. A few very high or low sales change it less than they would change an average.</p>
      <p>A “New build” tag marks a newly built home; these often sell for more than similar older homes nearby.</p>${licence}`,
    actions: [
      `See every sale on a street on ${searchLink}.`,
      "Compare the asking price with similar homes sold nearby, and ask the estate agent which sales they used to set it."
    ],
    seller: ["What did you pay for the property, and what work has been done since?"],
    conveyancer: ["Does the price paid history on the title register match what the seller has told us?"]
  };
}

// The topic, as the report, the runner (js/runner.js) and other small apps use it. data: the data tasks only this
// topic uses ([name, fetch function, service], started in the order of TASK_ORDER in js/tasks.js); deps: all the
// data it reads, shared data included (js/sources.js; "place" is added for every topic).
const soldpricesTopic = {
  id: "soldprices", group: "living", title: "Recent sale prices nearby",
  countries: ["England", "Wales"],
  data: {
    soldPrices: ["Recent sale prices nearby", getSoldPrices, "HM Land Registry"]
  },
  deps: ["soldPrices"],
  build: checkSoldPrices,
  icon: ['<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5A2.5 2.5 0 0 0 10 10v6M8 16h8M8.5 12.5h4.5"/>', "Prices"]
};

export { checkSoldPrices, getSoldPrices, soldpricesTopic };
