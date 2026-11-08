// 1. Data services: answer, expected content, and readable by web pages (CORS).
import { BASE, ORIGIN, UA, EA_MAP_SERVER, EA_REFUSAL_NOTE } from "./settings.mjs";
import { record } from "./results.mjs";
import { noteEARequest, NOMINATIM, nominatimTurn } from "./recording.mjs";

export const isReportDataService = ([, , , options = {}]) => !options.alwaysChecked && !options.sameSite;

export const LAT = 53.5526, LON = -1.4797;            // Barnsley town centre
export const box = (lat, lon, d = 0.0005) => [lat - d, lon - d, lat + d, lon + d].join(",");
export const wms = (base, layer, lat = LAT, lon = LON, d = 0.0005) => `${base}?` + new URLSearchParams({
  service: "WMS", version: "1.3.0", request: "GetFeatureInfo", layers: layer, query_layers: layer, styles: "",
  crs: "EPSG:4326", bbox: box(lat, lon, d), width: 11, height: 11, i: 5, j: 5, info_format: "application/json"
});
export const arcgis = (base, extra = "") => `${base}?geometry=${LON},${LAT}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json${extra}`;

export const SERVICES = [
  ["Postcodes (postcodes.io)", `https://api.postcodes.io/postcodes?lon=${LON}&lat=${LAT}&limit=1`, d => d.result && d.result[0].postcode, { alwaysChecked: true }],
  ["Planning data (planning.data.gov.uk)", `https://www.planning.data.gov.uk/entity.json?latitude=${LAT}&longitude=${LON}&limit=5`, d => Array.isArray(d.entities)],
  ["Surface water (Environment Agency)", wms("https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms", "rofsw"), d => Array.isArray(d.features)],
  ["Radon (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/radon/MapServer/0/query"), d => d.features && d.features.length === 1],
  ["Landslides (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hazards/MapServer/2/query", "&distance=1000&units=esriSRUnit_Meter"), d => Array.isArray(d.features)],
  ["Coal mining (Mining Remediation Authority)", arcgis("https://services-eu1.arcgis.com/Qn4lKcPDVHNivEyr/arcgis/rest/services/DevelopmentLowRiskArea/FeatureServer/0/query"), d => d.features && d.features.length >= 1],
  ["Road noise (Defra)", wms("https://environment.data.gov.uk/spatialdata/road-noise-all-metrics-england-round-4/wms", "Road_Noise_Lden_England_Round_4_All"), d => Array.isArray(d.features)],
  ["Rail noise (Defra)", wms("https://environment.data.gov.uk/spatialdata/rail-noise-england-round-4-all/wms", "Rail_Noise_Lden_England_Round_4_All_1000Hz"), d => Array.isArray(d.features)],
  ["Historic landfill (Environment Agency)", `https://environment.data.gov.uk/spatialdata/historic-landfill/ogc/features/v1/collections/Historic_Landfill_Sites/items?f=json&limit=5&bbox=${LON - 0.02},${LAT - 0.02},${LON + 0.02},${LAT + 0.02}`, d => Array.isArray(d.features)],
  ["Coastal erosion (Environment Agency)", "https://environment.data.gov.uk/spatialdata/ncern-national-2024/ogc/features/v1/collections/NCERM_SMP_2105_70CC/items?f=json&limit=5&bbox=1.52,52.82,1.54,52.83",
    d => Array.isArray(d.features) && d.features.some(f => f.properties.smp2105_70 > 0)],
  ["Sold prices (HM Land Registry)", "https://landregistry.data.gov.uk/landregistry/query?query=" + encodeURIComponent(
    'PREFIX ppi: <http://landregistry.data.gov.uk/def/ppi/> PREFIX lrc: <http://landregistry.data.gov.uk/def/common/> ' +
    'SELECT ?price WHERE { VALUES ?pc { "S70 2TA" "S70 1SL" "S70 2AT" } ?a lrc:postcode ?pc . ?s ppi:propertyAddress ?a ; ppi:pricePaid ?price } LIMIT 5'),
    d => d.results && d.results.bindings.length > 0],
  ["Air quality model (Open-Meteo)", `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&hourly=pm2_5&past_days=1&forecast_days=0&timeformat=unixtime`, d => d.hourly && d.hourly.pm2_5.length > 0],
  ["Crime (data.police.uk)", `https://data.police.uk/api/crimes-street/all-crime?lat=${LAT}&lng=${LON}`, d => Array.isArray(d) && d.length > 0, { alwaysChecked: true }],
  ["Police force for a place (data.police.uk)", `https://data.police.uk/api/locate-neighbourhood?q=${LAT},${LON}`, d => d.force === "south-yorkshire"],
  ["Census boundaries (ONS)", "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Middle_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V3/FeatureServer/0/query?where=MSOA21CD%3D%27E02001521%27&outFields=MSOA21CD&returnGeometry=false&f=json", d => d.features && d.features.length === 1],
  ["Scotland flood maps (SEPA)", "https://map.sepa.org.uk/server/rest/services/Open/Flood_Maps/MapServer/2/query?geometry=-3.43,56.404&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnCountOnly=true&f=json", d => Number.isFinite(d.count)],
  ["Wales flood maps (Natural Resources Wales)", wms("https://datamap.gov.wales/geoserver/ows", "inspire-nrw:NRW_FLOODZONE_RIVERS_SEAS_MERGED", 51.47, -3.188, 0.00005), d => Array.isArray(d.features) && d.features.length > 0],
  ["Wales heritage, nature and air sites (DataMapWales)", wms("https://datamap.gov.wales/geoserver/ows", "geonode:conservation_areas_wales", 51.4816, -3.1791, 0.00005),
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Wales noise maps (Welsh Government)", wms("https://datamap.gov.wales/geoserver/ows", "geonode:cog_WG_RD_LDEN_All", 51.488, -3.16),
    d => Array.isArray(d.features) && d.features[0] && d.features[0].properties.GRAY_INDEX > 0],
  ["Wales coastal erosion (Natural Resources Wales)", "https://datamap.gov.wales/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geonode:nrw_ncerm_all_smp&propertyName=epoch&count=5&outputFormat=application/json&bbox=52.48,-4.06,52.49,-4.04,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Wales disused coal tips (Welsh Government)", wms("https://datamap.gov.wales/geoserver/ows", "geonode:disused_coal_tips_in_wales_public", 51.6265, -3.452, 0.01),
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland heritage sites (Historic Environment Scotland)", "https://inspire.hes.scot/arcgis/rest/services/HES/Conservation_Areas/MapServer/0/query?geometry=-3.1907,55.9497&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=DES_TITLE&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland protected nature sites (NatureScot)", "https://ogc.nature.scot/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=protectedareas:sssi&propertyName=NAME&count=5&outputFormat=application/json&bbox=55.94,-3.17,55.95,-3.15,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland National Parks and Scenic Areas (Scottish Government)", "https://maps.gov.scot/server/rest/services/ScotGov/ProtectedSites/MapServer/0/query?geometry=-3.95,57.08&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=npname&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland air pollution hotspots (Scottish Air Quality)", "https://geoserver.rcdo.co.uk/geoserver/scotarc/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=scotarc:scottland_aqma_3857&propertyName=title&count=5&outputFormat=application/json&bbox=55.949,-3.191,55.950,-3.190,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland noise maps (SEPA)", "https://map.sepa.org.uk/server/rest/services/Noise/Noise_Road_LDEN_ALL/ImageServer/identify?geometry=" + encodeURIComponent('{"x":-3.1907,"y":55.9497,"spatialReference":{"wkid":4326}}') + "&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json",
    d => Number(d.value) > 0],
  ["Scotland coastal erosion (Dynamic Coast)", "https://ogc.nature.scot/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=dynamiccoast:dc2erosion2100high&propertyName=ERODETYPE&count=5&outputFormat=application/json&bbox=55.946,-3.12,55.964,-3.09,urn:ogc:def:crs:EPSG::4326",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland licensed waste sites (SEPA)", "https://map.sepa.org.uk/server/rest/services/Open/Utility_and_Governmental_Services/MapServer/416/query?geometry=-4.25,55.86&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=3000&units=esriSRUnit_Meter&outFields=authorisation_activity&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Scotland crime rank (Scottish Government, SIMD 2020)", "https://maps.gov.scot/server/rest/services/ScotGov/PeopleSociety/MapServer/7/query?geometry=-3.1907,55.9497&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=crimerank&returnGeometry=false&f=json",
    d => d.features && d.features.length === 1 && d.features[0].attributes.crimerank > 0],
  ["Northern Ireland heritage (Department for Communities)", "https://services2.arcgis.com/BdBkthNLO9mzGAMO/arcgis/rest/services/Historic_Environment_Division_GIS_Data/FeatureServer/1/query?geometry=-5.9301,54.5964&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=200&units=esriSRUnit_Meter&returnCountOnly=true&f=json",
    d => d.count > 0],
  ["Northern Ireland protected areas (DAERA)", "https://gis.daera-ni.gov.uk/server/rest/services/NIEAEnvironmentViewer/ProtectedAreas/MapServer/2/query?geometry=-5.893,54.212&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NAME&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Northern Ireland noise maps (DAERA)", "https://gis.daera-ni.gov.uk/server/rest/services/NoiseMapsRound4/Agglomeration_Roads/MapServer/identify?geometry=-5.946,54.592&geometryType=esriGeometryPoint&sr=4326&layers=all:0&tolerance=0&mapExtent=-5.96,54.58,-5.93,54.60&imageDisplay=200,200,96&returnGeometry=false&f=json",
    d => Array.isArray(d.results) && Number(d.results[0]?.attributes?.["Classify.Pixel Value"]) > 0],
  ["Northern Ireland coastal erosion (DfI and DAERA)", "https://gis.daera-ni.gov.uk/server/rest/services/Marine/CoastalErosionStudy/MapServer/3/query?geometry=-5.90,54.66&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=1000&units=esriSRUnit_Meter&outFields=risk&returnGeometry=false&f=json",
    d => Array.isArray(d.features) && d.features.length > 0],
  ["Address search (OpenStreetMap Nominatim)", "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=Barnsley%20Town%20Hall", d => Array.isArray(d) && d.length > 0],
  ["Schools register (planning.data.gov.uk)", `https://www.planning.data.gov.uk/entity.json?dataset=educational-establishment&latitude=${LAT}&longitude=${LON}&limit=1`, d => Array.isArray(d.entities)],
  ["Heritage backup (Historic England)", "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/National_Heritage_List_for_England_NHLE_v02_VIEW/FeatureServer/0/query?geometry=-2.3590,51.3811&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=100&units=esriSRUnit_Meter&outFields=Name&returnGeometry=false&f=json", d => d.features && d.features.length > 0],
  ["Clay shrink-swell (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer/6/query"), d => d.features && d.features.length === 1],
  ["Mining other than coal (British Geological Survey)", arcgis("https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/hex_grids/MapServer/1/query"), d => d.features && d.features.length === 1],
  ["Conservation areas backup (Historic England)", "https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/Conservation_Areas/FeatureServer/0/query?geometry=-2.3590,51.3811&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NAME&returnGeometry=false&f=json", d => d.features && d.features.length > 0],
  ["Place backup (OpenStreetMap reverse lookup)", `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${LAT}&lon=${LON}`, d => d.address && d.address["ISO3166-2-lvl4"] === "GB-ENG", { alwaysChecked: true }],
  ["Address search backup (Photon)", "https://photon.komoot.io/api/?limit=1&q=Barnsley", d => Array.isArray(d.features) && d.features.length > 0, { alwaysChecked: true }],
  ["Landfill backup (Defra copy)", "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/HistoricLandfill/FeatureServer/0/query?geometry=-1.4797,53.5526&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=2000&units=esriSRUnit_Meter&outFields=site_name&returnGeometry=false&f=json", d => d.features && d.features.length > 0],
  ["Past floods (Defra copy)", "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/HistoricFloodMap/FeatureServer/0/query?geometry=-2.1595,51.9925&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnCountOnly=true&f=json", d => d.count > 0],
  ["Reservoir flooding, normal day (Defra copy)", "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/ReservoirFloodExtentsDryDay/FeatureServer/0/query?geometry=-1.4730,52.9235&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=reservoir&returnGeometry=false&f=json", d => Array.isArray(d.features) && d.features.some(f => f.attributes.reservoir === "Ladybower")],
  ["Reservoir flooding, rivers already flooding (Defra copy)", "https://services-eu1.arcgis.com/KB6uNVj5ZcJr7jUP/arcgis/rest/services/ReservoirFloodExtentsWetDay/FeatureServer/0/query?geometry=-1.4730,52.9235&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=reservoir&returnGeometry=false&f=json", d => Array.isArray(d.features) && d.features.length > 0],
  ["Past floods in Wales (DataMapWales)", "https://datamap.gov.wales/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=inspire-nrw:NRW_HISTORIC_FLOODMAP&count=1&propertyName=name&outputFormat=application/json", d => d.features && d.features.length > 0],
  ["Flood zone backup (Environment Agency)", wms("https://environment.data.gov.uk/spatialdata/flood-map-for-planning-flood-zones/wms", "Flood_Zones_2_3_Rivers_and_Sea"), d => Array.isArray(d.features)],
  ["Nature backup (Natural England)", arcgis("https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/SSSI_England/FeatureServer/0/query", "&distance=5000&units=esriSRUnit_Meter"), d => Array.isArray(d.features)],
  ["GP surgeries and pharmacies (NHS Organisation Data Service)", "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations?PrimaryRoleId=RO182&PostCode=S70&Status=Active&Limit=5", d => Array.isArray(d.Organisations) && d.Organisations.length > 0],
  ["Postcode lookup for many postcodes (postcodes.io)", "https://api.postcodes.io/postcodes", d => Array.isArray(d.result) && d.result[0].result,
    { method: "POST", body: JSON.stringify({ postcodes: ["S70 2TA"] }), headers: { "Content-Type": "application/json" } }],
  ["Railway station list (saved with the app)", new URL("data/rail-stations.json", BASE).href, d => Array.isArray(d.stations) && d.stations.length > 2000, { sameSite: true }],
  ["Census 2021 residents (saved with the app)", new URL("data/census2021-msoa-residents.json", BASE).href, d => Object.keys(d.residents || {}).length === 7264 && d.residents.E02001521 > 0, { sameSite: true }]
];

// The report topics each service feeds, shown on the data service status page (status.html).
// Every row of SERVICES must have an entry here; the check fails if one is missing.
export const SERVICE_TOPICS = {
  "Postcodes (postcodes.io)": ["Every topic (finds the nearest postcode, council and country)", "Recent sale prices nearby"],
  "Planning data (planning.data.gov.uk)": ["Flooding from rivers and the sea", "Past use of the land", "Air quality", "Planning restrictions and heritage", "Protected nature sites"],
  "Surface water (Environment Agency)": ["Flooding from heavy rain (surface water)"],
  "Radon (British Geological Survey)": ["Radon gas"],
  "Landslides (British Geological Survey)": ["Landslides and ground movement"],
  "Coal mining (Mining Remediation Authority)": ["Mining (coal and other)"],
  "Road noise (Defra)": ["Noise: road, railway and aircraft"],
  "Rail noise (Defra)": ["Noise: road, railway and aircraft"],
  "Historic landfill (Environment Agency)": ["Past use of the land"],
  "Coastal erosion (Environment Agency)": ["Coastal erosion"],
  "Sold prices (HM Land Registry)": ["Recent sale prices nearby"],
  "Air quality model (Open-Meteo)": ["Air quality"],
  "Crime (data.police.uk)": ["Reported crime"],
  "Police force for a place (data.police.uk)": ["Reported crime"],
  "Census boundaries (ONS)": ["Reported crime (crime per 1,000 residents)"],
  "Scotland flood maps (SEPA)": ["Flooding, for homes in Scotland"],
  "Wales flood maps (Natural Resources Wales)": ["Flooding, for homes in Wales"],
  "Wales heritage, nature and air sites (DataMapWales)": ["Planning restrictions and heritage, for homes in Wales", "Protected nature sites, for homes in Wales", "Air quality, for homes in Wales"],
  "Wales noise maps (Welsh Government)": ["Noise, for homes in Wales"],
  "Wales coastal erosion (Natural Resources Wales)": ["Coastal erosion, for homes in Wales"],
  "Wales disused coal tips (Welsh Government)": ["Past use of the land, for homes in Wales"],
  "Scotland heritage sites (Historic Environment Scotland)": ["Planning restrictions and heritage, for homes in Scotland"],
  "Scotland protected nature sites (NatureScot)": ["Protected nature sites, for homes in Scotland"],
  "Scotland National Parks and Scenic Areas (Scottish Government)": ["Planning restrictions and heritage, for homes in Scotland"],
  "Scotland air pollution hotspots (Scottish Air Quality)": ["Air quality, for homes in Scotland"],
  "Scotland noise maps (SEPA)": ["Noise, for homes in Scotland"],
  "Scotland coastal erosion (Dynamic Coast)": ["Coastal erosion, for homes in Scotland"],
  "Scotland licensed waste sites (SEPA)": ["Past use of the land, for homes in Scotland"],
  "Scotland crime rank (Scottish Government, SIMD 2020)": ["Reported crime, for homes in Scotland"],
  "Northern Ireland heritage (Department for Communities)": ["Planning restrictions and heritage, for homes in Northern Ireland"],
  "Northern Ireland protected areas (DAERA)": ["Planning restrictions and heritage, for homes in Northern Ireland", "Protected nature sites, for homes in Northern Ireland"],
  "Northern Ireland noise maps (DAERA)": ["Noise, for homes in Northern Ireland"],
  "Northern Ireland coastal erosion (DfI and DAERA)": ["Coastal erosion, for homes in Northern Ireland"],
  "Address search (OpenStreetMap Nominatim)": ["Finding the property by address"],
  "Schools register (planning.data.gov.uk)": ["Schools, doctors and transport"],
  "Heritage backup (Historic England)": ["Planning restrictions and heritage, when planning.data.gov.uk is not answering"],
  "Clay shrink-swell (British Geological Survey)": ["Shrinking and swelling clay"],
  "Mining other than coal (British Geological Survey)": ["Mining (coal and other)"],
  "Conservation areas backup (Historic England)": ["Planning restrictions and heritage, when planning.data.gov.uk is not answering"],
  "Place backup (OpenStreetMap reverse lookup)": ["Every topic (finds the country), when postcodes.io is not answering"],
  "Address search backup (Photon)": ["Finding the property by address, when the main address search is not answering"],
  "Landfill backup (Defra copy)": ["Past use of the land, when the Environment Agency map server is not answering"],
  "Past floods (Defra copy)": ["Past floods recorded here"],
  "Past floods in Wales (DataMapWales)": ["Past floods recorded here (Wales)"],
  "Reservoir flooding, normal day (Defra copy)": ["Flooding from rivers and the sea (the reservoir line)"],
  "Reservoir flooding, rivers already flooding (Defra copy)": ["Flooding from rivers and the sea (the reservoir line)"],
  "Flood zone backup (Environment Agency)": ["Flooding from rivers and the sea, when planning.data.gov.uk is not answering"],
  "Nature backup (Natural England)": ["Planning restrictions and heritage, and Protected nature sites, when planning.data.gov.uk is not answering"],
  "GP surgeries and pharmacies (NHS Organisation Data Service)": ["Schools, doctors and transport"],
  "Postcode lookup for many postcodes (postcodes.io)": ["Schools, doctors and transport"],
  "Railway station list (saved with the app)": ["Schools, doctors and transport"],
  "Census 2021 residents (saved with the app)": ["Reported crime (crime per 1,000 residents)"]
};

export async function checkService([name, url, expect, options = {}]) {
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (url.includes(EA_MAP_SERVER)) noteEARequest();
      if (url.startsWith(NOMINATIM)) await nominatimTurn();
      const { sameSite, ...fetchOptions } = options;
      const res = await fetch(url, { ...fetchOptions, headers: { Origin: ORIGIN, "User-Agent": UA, Accept: "application/json", ...(options.headers || {}) },
        signal: AbortSignal.timeout(15000) });   // a hung service gives up after 15 s, then has a second try
      if (!res.ok) throw new Error("HTTP " + res.status);
      const cors = res.headers.get("access-control-allow-origin");
      if (!options.sameSite && (!cors || (cors !== "*" && cors !== ORIGIN))) throw new Error("web pages are not allowed to read it (no CORS header)");
      const data = await res.json();
      if (!expect(data)) throw new Error("unexpected content");
      return [name, true, `${Date.now() - started} ms`];
    } catch (e) {
      if (attempt === 2) {
        const refusedByEA = e.message === "HTTP 403" && url.includes(EA_MAP_SERVER);
        return [name, refusedByEA ? "warn" : false, refusedByEA ? `HTTP 403: ${EA_REFUSAL_NOTE}` : e.message];
      }
      // A refusal (403) from the Environment Agency map server is its short block on
      // busy addresses (it lasts up to about 40 s), so wait it out before trying again.
      await new Promise(r => setTimeout(r, e.message === "HTTP 403" ? 45000 : 3000));
    }
  }
}

// Ask the services 6 at a time; the Environment Agency map server's one at a time, in their own lane (it refuses
// addresses that send many requests at once). Results are recorded in SERVICES order, whatever order they finish in.
export async function checkServices(list) {
  const ea = list.filter(([, url]) => url.includes(EA_MAP_SERVER)), others = list.filter(([, url]) => !url.includes(EA_MAP_SERVER));
  const answers = new Map();
  const lane = async queue => { for (let s; (s = queue.shift());) answers.set(s[0], await checkService(s)); };
  await Promise.all([lane(ea), ...Array.from({ length: 6 }, () => lane(others))]);
  list.forEach(([name]) => record("Data services", ...answers.get(name)));
}
