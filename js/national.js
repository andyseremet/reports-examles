// Property Location Check – the national services for Scotland, Wales and Northern Ireland, for a topic whose data
// does not cover that country (js/coverage.js) and for links in some topics. Plain data, with no imports.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

// The national service to use instead, for a topic left out in that country.
const NATIONAL = {
  "Scotland": {
    env: ["SEPA (Scottish Environment Protection Agency)", "https://www.sepa.org.uk/"],
    flood: ["SEPA flood maps", "https://map.sepa.org.uk/floodmaps"],
    prices: ["Registers of Scotland", "https://www.ros.gov.uk/"],
    police: ["Police Scotland", "https://www.scotland.police.uk/"]   // also used by checkCrime
  },
  "Wales": {
    env: ["Natural Resources Wales", "https://naturalresources.wales/"],
    flood: ["Natural Resources Wales flood maps", "https://flood-risk-maps.naturalresources.wales/"]
  },
  "Northern Ireland": {
    env: ["DAERA (Department of Agriculture, Environment and Rural Affairs)", "https://www.daera-ni.gov.uk/"],
    flood: ["Flood Maps NI (Department for Infrastructure)", "https://www.infrastructure-ni.gov.uk/topics/rivers-and-flooding/flood-maps-ni"],
    radon: ["UKHSA radon maps", "https://www.ukradon.org/"],
    prices: ["nidirect", "https://www.nidirect.gov.uk/"]
  }
};

export { NATIONAL };
