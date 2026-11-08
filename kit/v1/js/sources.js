// Property Location Check – data several topics share (each topic's own data is in its file in js/topics/). Each is
// asked once per report, whatever the number of topics that read it.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { getFloodNational, getPlace, getPlanningAtPoint, getPlanningNearby } from "./data.js";
import { getWalesSites } from "./data-wales.js";
import { getScotlandSites } from "./data-scotland.js";
import { getNISites } from "./data-ni.js";

// key: [name, fetch function, service it waits for (named in the "Still waiting for" note when a report is slow)]
const SHARED_DATA = {
  place: ["Nearest postcode and council", getPlace, "postcodes.io"],
  planningPoint: ["Flood zone and planning rules at the property", getPlanningAtPoint, "planning.data.gov.uk"],
  planningNearby: ["Things nearby: flood zones, contaminated land, heritage, nature", getPlanningNearby, "planning.data.gov.uk"],
  floodNational: ["Scotland and Wales flood maps", getFloodNational, "SEPA and Natural Resources Wales"],
  walesSites: ["Heritage, nature and air hotspots in Wales", getWalesSites, "DataMapWales"],
  scotlandSites: ["Heritage, nature and air hotspots in Scotland", getScotlandSites, "Historic Environment Scotland and NatureScot"],
  niSites: ["Heritage and nature in Northern Ireland", getNISites, "Department for Communities and DAERA"]
};

export { SHARED_DATA };
