// Property Location Check – the list of data tasks (TASKS): each fetch, its topic and the service it waits for.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import { getAirModel, getAmenities, getCoal, getCoastalErosion, getCrime, getCrimeArea, getFloodNational,
  getLandfill, getLandslides, getOtherMining, getPastFloods, getPlace, getPlanningAtPoint, getPlanningNearby,
  getRadon, getRailNoise, getReservoirFlood, getRoadNoise, getShrinkSwell, getSoldPrices, getSurfaceWater } from "./data.js";
import { getCoalTips, getWalesSites } from "./data-wales.js";
import { getScotlandSites, getSimdCrime, getWasteSites } from "./data-scotland.js";
import { getNISites } from "./data-ni.js";

// Each data task: key, topic name, fetch function, and the service it waits for (named in the
// "Still waiting for" note when a report is slow). Tasks start in this order. The Environment Agency
// server answers only a few requests at a time (PACED_HOSTS), so its most important topic,
// flooding from heavy rain, is listed first and road and rail noise last.
const TASKS = [
  ["place", "Nearest postcode and council", getPlace, "postcodes.io"],
  ["surfaceWater", "Flooding from heavy rain", getSurfaceWater, "Environment Agency"],
  ["pastFloods", "Past floods recorded", getPastFloods, "Environment Agency via Defra (Wales: DataMapWales)"],
  ["reservoirs", "Flooding if a reservoir failed", getReservoirFlood, "Environment Agency via Defra"],
  ["landfill", "Old landfill sites", getLandfill, "Environment Agency"],
  ["coastal", "Coastal erosion", getCoastalErosion, "Environment Agency (Wales: DataMapWales; Scotland: NatureScot; NI: DAERA)"],
  ["planningPoint", "Flood zone and planning rules at the property", getPlanningAtPoint, "planning.data.gov.uk"],
  ["planningNearby", "Things nearby: flood zones, contaminated land, heritage, nature", getPlanningNearby, "planning.data.gov.uk"],
  ["radon", "Radon gas", getRadon, "British Geological Survey"],
  ["coal", "Coal mining", getCoal, "Mining Remediation Authority"],
  ["air", "Air quality", getAirModel, "Open-Meteo"],
  ["landslides", "Landslides", getLandslides, "British Geological Survey"],
  ["shrinkSwell", "Shrinking and swelling clay", getShrinkSwell, "British Geological Survey"],
  ["otherMining", "Mining other than coal", getOtherMining, "British Geological Survey"],
  ["crime", "Reported crime", getCrime, "data.police.uk"],
  ["soldPrices", "Recent sale prices nearby", getSoldPrices, "HM Land Registry"],
  ["floodNational", "Scotland and Wales flood maps", getFloodNational, "SEPA and Natural Resources Wales"],
  ["amenities", "Schools, doctors and transport", getAmenities, "NHS and planning.data.gov.uk"],
  ["crimeArea", "Crime compared with England and Wales", getCrimeArea, "Office for National Statistics"],
  ["noise", "Road noise", getRoadNoise, "Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA)"],
  ["railNoise", "Railway noise", getRailNoise, "Environment Agency (Wales: DataMapWales; Scotland: SEPA; NI: DAERA)"],
  ["walesSites", "Heritage, nature and air hotspots in Wales", getWalesSites, "DataMapWales"],
  ["coalTips", "Disused coal tips in Wales", getCoalTips, "DataMapWales"],
  ["scotlandSites", "Heritage, nature and air hotspots in Scotland", getScotlandSites, "Historic Environment Scotland and NatureScot"],
  ["wasteSites", "Licensed waste sites in Scotland", getWasteSites, "SEPA"],
  ["simdCrime", "Crime rank in Scotland", getSimdCrime, "Scottish Government"],
  ["niSites", "Heritage and nature in Northern Ireland", getNISites, "Department for Communities and DAERA"]
];

export { TASKS };
