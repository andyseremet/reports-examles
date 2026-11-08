// The country data steps: backups, Wales, Scotland, Northern Ireland and the other national data (desktop).
import { BASE } from "./settings.mjs";
import { results, record, timedStep } from "./results.mjs";
import { steadyContext } from "./recording.mjs";
import { DEVICES } from "./devices.mjs";

// Map data for Wales, Scotland and Northern Ireland, nearby places and sale prices. These test the data
// functions, not the screen, so they run once (on a desktop page) instead of on every device. They run
// during the pause before the first report: none of them uses the Environment Agency map server, and the
// page counts any request to it, so this part never adds to the requests the pause protects.
export async function testCountryData(browser) {
  const group = "Country data (desktop)";
  const context = await browser.newContext({ ...DEVICES[0].options });
  await steadyContext(context);
  const page = await context.newPage();
  let eaRequests = 0;
  await page.route("https://environment.data.gov.uk/spatialdata/**", r => { eaRequests++; return r.fulfill({ json: { features: [] } }); });
  const step = timedStep(group);
  try {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForFunction(() => typeof getScotlandSites === "function", null, { timeout: 30000 });
    await step("Backups: heritage and nature answer when planning.data.gov.uk does not", async () => {
      // Central Bath, with planning.data.gov.uk pretending to be down: the World Heritage Site, the Roman Baths and
      // listed buildings must come from Historic England, and the topic must name what it could not check.
      // The flood zone comes from the Environment Agency's Flood Map for Planning: here a stand-in answer (Flood Zone 3),
      // so this step sends nothing to its map server (the real service is checked in SERVICES).
      // Air quality has no backup and must still say "not answering", never "no issue".
      const floodMap = "**/flood-map-for-planning-flood-zones/**";
      await page.route(floodMap, r => r.fulfill({ json: { type: "FeatureCollection", features: [{ properties: { flood_zone: "FZ3", flood_source: "river" } }] } }));
      const r = await page.evaluate(async () => {
        const loc = { name: "Bath test", lat: 51.3811, lon: -2.3590, radius: 500 };
        const fail = msg => Promise.reject(new Error(msg));
        const failed = async (datasets, radius) => {
          try { await withBackup(() => fail("the data service replied with error 503"), loc, radius, datasets); }
          catch (e) { return { ok: false, error: e.message, backup: e.backup }; }
        };
        const R = { loc, planningPoint: await failed(PLANNING_AT_POINT, 0), planningNearby: await failed(PLANNING_NEARBY, loc.radius),
          floodNational: { ok: true, value: null }, air: { ok: true, value: { no2: 15, pm25: 7 } }, place: { ok: true, value: { country: "England" } } };
        const planning = checkPlanning(R), nature = checkNature(R), flood = checkFlood(R), air = checkAir(R);
        // A service that does not answer: this place's earlier answer is shown instead, with its date.
        const keep = run;
        run = { previous: { savedAt: "2026-11-03T10:00:00Z", results: [{ id: "flood", status: "medium", found: "Flood zone 2." }] } };
        let saved;
        try { saved = savedInstead({ id: "flood" }, { status: "error" }); } finally { run = keep; }
        return { saved: [saved.status, saved.fromSaved], floodSource: flood.source.name,
          planning: [planning.status, planning.found, planning.details.includes("Historic England")],
          nature: nature.status, flood: flood.status, air: air.status, airFound: air.found,
          listed: (R.planningNearby.backup?.entities || []).filter(e => e.dataset === "listed-building").length,
          missing: R.planningPoint.backup?.missing || [] };
      });
      if (r.planning[0] !== "info" || !/World Heritage Site/.test(r.planning[1]) || !/Scheduled monument/.test(r.planning[1]))
        throw new Error(`planning from the backup: ${r.planning[0]}: ${r.planning[1]}`);
      if (!r.planning[2]) throw new Error("the planning topic does not say it came from Historic England");
      // Conservation areas come from Historic England's map (the City of Bath conservation area); Green Belt has no backup.
      if (!/Conservation area/.test(r.planning[1])) throw new Error(`no conservation area from Historic England in central Bath: ${r.planning[1]}`);
      if (r.missing.includes("conservation-area") || !r.missing.includes("green-belt")) throw new Error(`backup coverage is wrong; not checked: ${r.missing.join(", ")}`);
      if (!r.listed) throw new Error("no listed buildings from Historic England in central Bath");
      if (!["low", "info"].includes(r.nature)) throw new Error(`nature from the backup rated ${r.nature}`);
      await page.unroute(floodMap);
      if (r.flood !== "high" || !/Environment Agency/.test(r.floodSource)) throw new Error(`flooding from the backup: ${r.flood} (${r.floodSource})`);
      // Air quality: the Open-Meteo estimate is the main source; without the council hotspot list it is "For information".
      if (r.air !== "info" || !/hotspots could not be checked/.test(r.airFound)) throw new Error(`with the hotspot list down, air quality is ${r.air}: ${r.airFound}`);
      if (r.saved.join() !== "medium,2026-11-03T10:00:00Z") throw new Error(`the saved answer came back as ${r.saved.join(", ")}`);
      return `${r.planning[1]} ${r.listed} listed buildings nearby`;
    });

    await step("Landfill backup: Defra's copy answers when the Environment Agency map server does not", async () => {
      // Barnsley has many old landfill sites. The Environment Agency's landfill service is made to fail here (no request
      // reaches it); the sites must come from Defra's copy on ArcGIS Online, with dates as text, and the topic must say so.
      const fail = r => r.fulfill({ status: 503, body: "" });
      await page.route("https://environment.data.gov.uk/spatialdata/historic-landfill/**", fail);
      try {
        const r = await page.evaluate(async () => {
          const loc = { lat: 53.5527, lon: -1.4797, radius: 1000 };
          const backup = await getLandfill(loc).then(() => null, e => e.backup);
          if (!backup) return { sites: 0 };
          const R = { loc, landfill: { ok: false, error: "the data service replied with error 503", backup },
            place: { ok: true, value: { country: "England", admin_district: "Barnsley" } }, planningNearby: { ok: true, value: [] }, planningPoint: { ok: true, value: [] } };
          const topic = checkLanduse(R);
          return { sites: backup.sites.length, years: backup.sites.map(x => x.firstinput).find(Boolean), nearest: backup.sites[0].distanceKm,
            status: topic.status, source: topic.source.name };
        });
        if (!r.sites) throw new Error("no landfill sites from the backup");
        if (typeof r.years !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.years)) throw new Error(`dates from the backup are not text: ${r.years}`);
        if (r.status === "error" || !/Defra's copy/.test(r.source)) throw new Error(`the topic did not use the backup: ${r.status}, "${r.source}"`);
        return `${r.sites} sites within 1 km, nearest ${r.nearest.toFixed(2)} km; ${r.status}`;
      } finally { await page.unroute("https://environment.data.gov.uk/spatialdata/historic-landfill/**", fail); }
    });

    await step("Past floods: England and Wales records, topic not shown in Scotland and Northern Ireland", async () => {
      // Tewkesbury (England) lies inside a recorded flood, Barnsley town centre has none within 250 m, Builth Wells (Wales) has
      // dated floods, and Edinburgh (Scotland) publishes none: the fetch asks nothing there and the topic is left out.
      const r = await page.evaluate(async () => {
        const at = (lat, lon) => getPastFloods({ lat, lon, radius: 1000 });
        const [tewkes, barnsley, builth, edinburgh] = await Promise.all([at(51.9925, -2.1595), at(53.5526, -1.4790), at(52.1500, -3.4020), at(55.9533, -3.1883)]);
        const topic = checkPastFloods({ pastFloods: { ok: true, value: builth }, place: { ok: true, value: { country: "Wales" } } });
        return { tewkes, barnsley, builth: { near: builth.near, n: builth.floods.length, date: builth.floods[0] && builth.floods[0].start_date },
          edinburgh, topic: { status: topic.status, found: topic.found },
          shown: ["England", "Wales", "Scotland", "Northern Ireland"].map(c => topicShown("pastfloods", c)) };
      });
      if (!r.tewkes.inside || r.tewkes.country !== "England") throw new Error(`Tewkesbury: ${JSON.stringify(r.tewkes)}`);
      if (r.barnsley.near) throw new Error("a recorded flood within 250 m of Barnsley town centre");
      if (!r.builth.near || !/^\d{4}-\d{2}-\d{2}/.test(r.builth.date || "")) throw new Error(`Builth Wells: ${JSON.stringify(r.builth)}`);
      if (!["high", "medium"].includes(r.topic.status) || !/\d{4}/.test(r.topic.found)) throw new Error(`Wales topic: ${r.topic.status}, "${r.topic.found}"`);
      if (r.edinburgh !== null) throw new Error("the fetch answered for Scotland");
      if (r.shown.join() !== "true,true,false,false") throw new Error(`shown in England, Wales, Scotland, NI: ${r.shown}`);
      return `Tewkesbury inside; Builth Wells ${r.builth.n} floods (${r.topic.status}): "${r.topic.found.slice(0, 70)}…"`;
    });

    await step("Backups for the place, the address search and recent answers", async () => {
      // postcodes.io not answering: OpenStreetMap gives the country (Leith → Scotland). Nominatim not answering: Photon
      // finds the address. A service that fails reuses its answer from the last 7 days, but never an older one.
      const r = await page.evaluate(async () => {
        const place = await placeFromOsm({ lat: 55.9755, lon: -3.17 });
        const found = await searchPhoton("May Day Green, Barnsley");
        const loc = { lat: 50.1, lon: -5.1, radius: 1000 };
        rememberAnswer(loc, "radon", { CLASS_MAX: 3 });
        const fresh = recentAnswer(loc, "radon");
        const k = "plc-recent:" + reportKey(loc), all = JSON.parse(localStorage.getItem(k));
        all.radon.at = new Date(Date.now() - 8 * 864e5).toISOString(); localStorage.setItem(k, JSON.stringify(all));
        const old = recentAnswer(loc, "radon");
        forgetAnswers(reportKey(loc));
        return { country: place && place.country, backup: place && place.fromBackup, photon: found.length, near: found[0] && Math.abs(found[0].lat - 53.55) < 0.1,
          fresh: !!fresh && fresh.value.CLASS_MAX === 3, old: old === null, gone: localStorage.getItem(k) === null };
      });
      if (r.country !== "Scotland" || r.backup !== "OpenStreetMap") throw new Error(`OpenStreetMap place for Leith: ${r.country} (${r.backup})`);
      if (!r.photon || !r.near) throw new Error(`Photon found ${r.photon} result(s), first near Barnsley: ${r.near}`);
      if (!r.fresh) throw new Error("a recent answer was not kept");
      if (!r.old) throw new Error("an answer older than 7 days was still used");
      if (!r.gone) throw new Error("recent answers were not forgotten with the saved property");
      return `Leith → Scotland (OpenStreetMap); Photon: ${r.photon} result(s); recent answers kept 7 days`;
    });

    await step("Clay and other mining from the British Geological Survey", async () => {
      // Islington (London Clay): clay "significant" → Worth checking. Camborne (Cornwall): old tin and copper mines →
      // the mining topic is Worth checking and asks for a mining search. Cotswolds: no known mining, so no such note.
      const r = await page.evaluate(async () => {
        const at = async (lat, lon) => { const loc = { lat, lon, radius: 1000 };
          const [ss, om, coal] = await Promise.all([getShrinkSwell(loc), getOtherMining(loc), getCoal(loc)]);
          return { clay: checkClay({ loc, shrinkSwell: { ok: true, value: ss } }),
            mining: checkCoal({ loc, coal: { ok: true, value: coal }, otherMining: { ok: true, value: om } }) }; };
        const [islington, camborne, cotswolds] = await Promise.all([at(51.5465, -0.1058), at(50.2132, -5.2977), at(52.0, -1.5)]);
        // With the other-mining overview not answering, a place outside the coalfield must not say "No issue found".
        const down = checkCoal({ loc: {}, coal: { ok: true, value: {} }, otherMining: { ok: false, error: "test" } });
        return { islington: islington.clay.status, camborne: [camborne.mining.status, camborne.mining.found, camborne.mining.conveyancer.join(" ")],
          cotswolds: cotswolds.mining.found + cotswolds.mining.conveyancer.join(" "), down: down.status };
      });
      if (r.islington !== "medium") throw new Error(`Islington clay rated ${r.islington}, not Worth checking`);
      if (r.camborne[0] !== "medium" || !/tin, copper/.test(r.camborne[1]) || !/mining search/.test(r.camborne[2]))
        throw new Error(`Camborne mining: ${r.camborne.join(" | ")}`);
      if (/other than coal/.test(r.cotswolds)) throw new Error("the other-mining note shows in the Cotswolds");
      if (r.down !== "manual") throw new Error(`with other mining not answering, the topic is ${r.down}, not Check yourself`);
      return "Islington clay: Worth checking; Camborne: other mining Worth checking";
    });

    await step("Missing data is never No issue found: noise, clay and mining when a service fails", async () => {
      // Built from made-up answers (nothing is sent): a failed road noise service, a blank clay rating and a failed
      // coal service must never read "No issue found", and the coal outage must not hide other mining.
      const r = await page.evaluate(() => {
        const loc = { lat: 53.5542, lon: -1.4827, radius: 1000, name: "test" };
        const place = { ok: true, value: { country: "England", admin_district: "Barnsley" } };
        const down = { ok: false, error: "HTTP 503" };
        const noise = checkNoise({ loc, place, noise: down, railNoise: { ok: true, value: {} } });
        const clay = checkClay({ loc, place, shrinkSwell: { ok: true, value: { level: NaN, localised: false } } });
        const sig = checkCoal({ loc, place, coal: down, otherMining: { ok: true, value: { level: "Significant" } } });
        const none = checkCoal({ loc, place, coal: down, otherMining: { ok: true, value: { level: "NA" } } });
        // Near Heathrow the airport already rates noise "Worth checking": road noise that failed must still be named.
        const heathrow = checkNoise({ loc: { ...loc, lat: 51.47, lon: -0.45 }, place, noise: down, railNoise: { ok: true, value: {} } });
        // A railway service that answered only in part (no night figure) is not "quiet".
        const partRail = checkNoise({ loc, place, noise: { ok: true, value: {} }, railNoise: { ok: true, value: { lden: null, lnight: null, unavailable: ["lnight"] } } });
        return { noise: [noise.status, /Road noise could not be checked/.test(noise.found)], clay: clay.status,
          sig: [sig.status, /Coal mining could not be checked/.test(sig.found) && /known or considered likely/.test(sig.found), sig.gap, sig.failedService], none: none.status,
          heathrow: [heathrow.status, heathrow.gap, /Road noise could not be checked/.test(heathrow.found)], partRail: [partRail.status, /Railway noise could not be checked/.test(partRail.found)] };
      });
      const ok = r.noise[0] === "manual" && r.noise[1] && r.clay === "manual" && r.sig[0] === "medium" && r.sig[1] && r.sig[2] === "down" &&
        r.sig[3] === "coal" && r.none === "error" && r.heathrow[0] === "medium" && r.heathrow[1] === "down" && r.heathrow[2] &&
        r.partRail[0] === "manual" && r.partRail[1];
      return ok ? "noise (also near an airport, and with a partial railway answer), clay and mining name what was not checked" : (() => { throw new Error(JSON.stringify(r)); })();
    });

    await step("Wales: coal tips, coast, noise, heritage and nature from Welsh data", async () => {
      // Treorchy (Rhondda): disused coal tips nearby. Borth: an eroding coast. Cardiff centre: a conservation
      // area, road noise and an air pollution hotspot nearby. Each must be answered from Welsh data, not "Check yourself".
      const r = await page.evaluate(async () => {
        const R = async (loc, keys) => {
          const out = { loc, place: { ok: true, value: await getPlace(loc) } };
          const fns = { coalTips: getCoalTips, coastal: getCoastalErosion, noise: getRoadNoise, railNoise: getRailNoise, walesSites: getWalesSites };
          await Promise.all(keys.map(async k => { out[k] = { ok: true, value: await fns[k](loc) }; }));
          out.air = { ok: false, error: "not asked" }; out.planningPoint = { ok: false, error: "England only" };
          return out;
        };
        const tre = await R({ lat: 51.653995, lon: -3.520821, radius: 1000 }, ["coalTips"]);
        const borth = await R({ lat: 52.486107, lon: -4.05112, radius: 1000 }, ["coastal"]);
        const cdf = await R({ lat: 51.485167, lon: -3.178668, radius: 1000 }, ["noise", "railNoise", "walesSites"]);
        return {
          tips: checkLanduse(tre), coast: checkCoastal(borth), noise: checkNoise(cdf),
          planning: checkPlanning(cdf), nature: checkNature(cdf), air: checkAir(cdf), country: cdf.place.value.country,
          // Missing hotspot data must never read as "not in a hotspot".
          airNoHotspotData: checkAir({ ...cdf, walesSites: { ok: false, error: "test" }, air: { ok: true, value: { no2: 10, pm25: 5 } } }).status
        };
      });
      if (r.country !== "Wales") throw new Error(`postcodes.io says Cardiff is in ${r.country}`);
      // The Open-Meteo estimate is the main source (owner, 7 November 2026): without hotspot data it is "For information", never "No issue found".
      if (r.airNoHotspotData !== "info") throw new Error(`with no hotspot data, air quality was rated "${r.airNoHotspotData}", not For information`);
      const bad = Object.entries(r).filter(([k, c]) => !["country", "airNoHotspotData"].includes(k) && ["manual", "error"].includes(c.status));
      if (bad.length) throw new Error(bad.map(([k, c]) => `${k}: ${c.found}`).join(" | "));
      if (!["medium", "info"].includes(r.tips.status)) throw new Error(`no coal tips found near Treorchy: ${r.tips.found}`);
      if (!/Conservation area/.test(r.planning.found)) throw new Error(`no conservation area in central Cardiff: ${r.planning.found}`);
      if (!/Road: (moderate|loud)/.test(r.noise.found)) throw new Error(`no road noise in central Cardiff: ${r.noise.found}`);
      if (r.coast.found.startsWith("Not near the coast")) throw new Error(`Borth not near the coast: ${r.coast.found}`);
      if (!/hotspot/.test(r.air.found) || !/within/.test(r.air.found)) throw new Error(`no air pollution hotspot near central Cardiff: ${r.air.found}`);
      return `coal tips ${r.tips.status}; Borth ${r.coast.status}; Cardiff: ${r.planning.found.slice(0, 50)}…`;
    });

    await step("Scotland: heritage, nature, air, noise, coast, waste sites and crime from Scottish data", async () => {
      // Edinburgh Old Town: a conservation area, World Heritage Site, listed building, air pollution hotspot, road noise
      // and a crime rank. Portobello: an eroding soft coast. Insh Marshes (Cairngorms): a National Park and an SSSI.
      // Oban: rocky coast and no waste site, so land use must say "Check yourself".
      const r = await page.evaluate(async () => {
        const fns = { coastal: getCoastalErosion, noise: getRoadNoise, railNoise: getRailNoise, scotlandSites: getScotlandSites, wasteSites: getWasteSites, simdCrime: getSimdCrime };
        const R = async (loc, keys) => {
          const out = { loc, place: { ok: true, value: await getPlace(loc) } };
          await Promise.all(keys.map(async k => { out[k] = { ok: true, value: await fns[k](loc) }; }));
          out.air = { ok: false, error: "not asked" }; out.planningPoint = { ok: false, error: "England only" };
          out.crime = { ok: false, error: "England and Wales only" };
          return out;
        };
        const edi = await R({ lat: 55.9497, lon: -3.1907, radius: 1000 }, ["noise", "railNoise", "scotlandSites", "wasteSites", "simdCrime"]);
        const por = await R({ lat: 55.955, lon: -3.105, radius: 1000 }, ["coastal"]);
        const insh = await R({ lat: 57.08, lon: -3.95, radius: 1000 }, ["scotlandSites"]);
        const oban = await R({ lat: 56.415, lon: -5.472, radius: 1000 }, ["wasteSites"]);
        return {
          planning: checkPlanning(edi), nature: checkNature(edi), air: checkAir(edi), noise: checkNoise(edi), crime: checkCrime(edi),
          waste: checkLanduse(edi), coast: checkCoastal(por), park: checkPlanning(insh), sssi: checkNature(insh),
          country: edi.place.value.country, obanLand: checkLanduse(oban).status,
          // Missing hotspot data must never read as "not in a hotspot".
          airNoHotspotData: checkAir({ ...edi, scotlandSites: { ok: false, error: "test" }, air: { ok: true, value: { no2: 10, pm25: 5 } } }).status
        };
      });
      if (r.country !== "Scotland") throw new Error(`postcodes.io says Edinburgh is in ${r.country}`);
      // The Open-Meteo estimate is the main source (owner, 7 November 2026): without hotspot data it is "For information", never "No issue found".
      if (r.airNoHotspotData !== "info") throw new Error(`with no hotspot data, air quality was rated "${r.airNoHotspotData}", not For information`);
      if (r.obanLand !== "manual") throw new Error(`Oban (no waste sites; old landfill not published) rated "${r.obanLand}", expected Check yourself`);
      const bad = Object.entries(r).filter(([k, c]) => !["country", "airNoHotspotData", "obanLand"].includes(k) && ["manual", "error"].includes(c.status));
      if (bad.length) throw new Error(bad.map(([k, c]) => `${k}: ${c.found}`).join(" | "));
      if (!/Conservation area/.test(r.planning.found) || !/World Heritage Site/.test(r.planning.found)) throw new Error(`Edinburgh Old Town planning: ${r.planning.found}`);
      if (!/National Park/.test(r.park.found)) throw new Error(`no National Park at Insh Marshes: ${r.park.found}`);
      if (!/Site of Special Scientific Interest/.test(r.sssi.found)) throw new Error(`no SSSI at Insh Marshes: ${r.sssi.found}`);
      if (!/Inside an air pollution hotspot/.test(r.air.found)) throw new Error(`Edinburgh centre not in its air pollution hotspot: ${r.air.found}`);
      if (!/Road: (moderate|loud)/.test(r.noise.found)) throw new Error(`no road noise in central Edinburgh: ${r.noise.found}`);
      if (!/ranked [\d,]+ of 6,976/.test(r.crime.found)) throw new Error(`no crime rank: ${r.crime.found}`);
      if (!/licensed/.test(r.waste.found)) throw new Error(`no licensed waste site near central Edinburgh: ${r.waste.found}`);
      if (!/expected to be lost by 2100/.test(r.coast.found)) throw new Error(`Portobello coast: ${r.coast.found}`);
      return `Edinburgh: ${r.planning.found.slice(0, 60)}…; Portobello ${r.coast.status}; crime ${r.crime.found.match(/ranked [\d,]+/)[0]}`;
    });

    await step("Northern Ireland: heritage, nature, noise and coast from NI data; Check yourself where nothing is published", async () => {
      // Belfast City Hall: listed buildings nearby and road noise; planning must say "Check yourself" because
      // conservation areas are not published, and air because hotspots are not mapped. Westlink: loud road noise.
      // Newcastle (Co Down): the Mourne AONB. Strangford Lough: protected nature sites. Belfast Lough shore: High erosion risk.
      const r = await page.evaluate(async () => {
        const fns = { coastal: getCoastalErosion, noise: getRoadNoise, railNoise: getRailNoise, niSites: getNISites };
        const R = async (loc, keys) => {
          const out = { loc, place: { ok: true, value: await getPlace(loc) } };
          await Promise.all(keys.map(async k => { out[k] = { ok: true, value: await fns[k](loc) }; }));
          out.air = { ok: true, value: { no2: 15, pm25: 6 } };
          return out;
        };
        const bel = await R({ lat: 54.5964, lon: -5.9301, radius: 1000 }, ["noise", "railNoise", "niSites"]);
        const west = await R({ lat: 54.592, lon: -5.946, radius: 1000 }, ["noise", "railNoise"]);
        const newc = await R({ lat: 54.212, lon: -5.893, radius: 1000 }, ["niSites"]);
        const str = await R({ lat: 54.47, lon: -5.63, radius: 1000 }, ["niSites"]);
        const shore = await R({ lat: 54.66, lon: -5.90, radius: 1000 }, ["coastal"]);
        return { country: bel.place.value.country, listed: bel.niSites.value.listedNear,
          planning: checkPlanning(bel), air: checkAir(bel), noise: checkNoise(west), park: checkPlanning(newc),
          nature: checkNature(str), coast: checkCoastal(shore) };
      });
      if (r.country !== "Northern Ireland") throw new Error(`postcodes.io says Belfast is in ${r.country}`);
      if (r.planning.status !== "manual") throw new Error(`Belfast planning with no conservation area data rated "${r.planning.status}", expected Check yourself`);
      if (!(r.listed > 0)) throw new Error("no listed buildings near Belfast City Hall");
      if (r.air.status !== "info") throw new Error(`NI air quality (estimate only, no hotspot map) rated "${r.air.status}", expected For information`);
      if (!/Road: loud/.test(r.noise.found)) throw new Error(`Westlink road noise: ${r.noise.found}`);
      if (!/Area of Outstanding Natural Beauty/.test(r.park.found)) throw new Error(`no Mourne AONB at Newcastle: ${r.park.found}`);
      if (r.nature.status !== "info") throw new Error(`no protected sites at Strangford Lough: ${r.nature.found}`);
      if (!/erosion risk/.test(r.coast.found) || r.coast.status === "low") throw new Error(`Belfast Lough shore: ${r.coast.found}`);
      return `${r.listed} listed buildings near City Hall; Westlink loud; coast ${r.coast.status}`;
    });

    await step("Nearby places: each register only where it covers; Check yourself in Northern Ireland", async () => {
      // GP surgeries come from an England and Wales register, schools and stops from England only, stations from
      // Great Britain. Where a register does not reach, the row must say "Not covered", never "None found nearby".
      const r = await page.evaluate(async () => {
        const rate = async (lat, lon) => {
          const loc = { lat, lon, radius: 1000 };
          const c = checkAmenities({ loc, place: { ok: true, value: await getPlace(loc) }, amenities: { ok: true, value: await getAmenities(loc) } });
          return { status: c.status, found: c.found, details: c.details || "" };
        };
        return { bel: await rate(54.5964, -5.9301), edi: await rate(55.9497, -3.1907), cdf: await rate(51.4816, -3.1791) };
      });
      if (r.bel.status !== "manual") throw new Error(`Belfast (no register covers it) rated "${r.bel.status}": ${r.bel.found}`);
      if (!/GP surgery<\/td><td colspan="3">Not covered in Scotland/.test(r.edi.details)) throw new Error("Edinburgh GP row does not say Not covered");
      if (!/station/.test(r.edi.found)) throw new Error(`no station near Edinburgh Waverley: ${r.edi.found}`);
      if (!/GP|pharmacy/.test(r.cdf.found)) throw new Error(`no GP or pharmacy in central Cardiff: ${r.cdf.found}`);
      return `Belfast ${r.bel.status}; Edinburgh: ${r.edi.found.slice(0, 40)}…; Cardiff: ${r.cdf.found.slice(0, 40)}…`;
    });

    await step("Sold prices: sales in a town, Check yourself where there are none", async () => {
      // Barnsley town centre has home sales every year. Open moorland on Dartmoor has no postcodes within
      // 500 m, so no sales: that must say "Check yourself", never "No issue found".
      const r = await page.evaluate(async () => {
        const rate = async loc => checkSoldPrices({ loc, soldPrices: { ok: true, value: await getSoldPrices(loc) } });
        const town = await rate({ name: "Barnsley test", lat: 53.5526, lon: -1.4797, radius: 1000 });
        const moor = await rate({ name: "Dartmoor test", lat: 50.6, lon: -3.96, radius: 1000 });
        return { town: town.status, townFound: town.found, moor: moor.status };
      });
      if (r.town !== "info") throw new Error(`Barnsley rated "${r.town}": ${r.townFound}`);
      if (r.moor !== "manual") throw new Error(`Dartmoor (no sales) rated "${r.moor}", expected Check yourself`);
      return r.townFound.replace(/<[^>]+>/g, "").slice(0, 90) + "…";
    });

    record(group, "No requests to the Environment Agency map server", eaRequests === 0,
      eaRequests ? `${eaRequests} request(s): a Wales, Scotland or NI address was treated as England` : "none");
  } finally {
    await context.close();
  }
}
