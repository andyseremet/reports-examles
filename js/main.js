// Property Location Check – the start file: index.html loads only this. It loads every part of the main app, in this
// order (each part's own imports load first). The topics load through their list (js/topics/index.js), so a new topic
// needs no line here. js/page-names.js comes last: it lets the daily check read app names from the page.
// A module (no build step): it imports what it uses from other files and exports what they use (docs/CODE.md).

import "./core.js";
import "./api.js";
import "./store.js";
import "./data.js";
import "./backups.js";
import "./data-wales.js";
import "./data-scotland.js";
import "./data-ni.js";
import "./national.js";
import "./sources.js";
import "./topics/helpers.js";
import "./topics/index.js";
import "./tasks.js";
import "./coverage.js";
import "./runner.js";
import "./map.js";
import "./search.js";
import "./saved.js";
import "./run.js";
import "./summary.js";
import "./report.js";
import "./next-steps.js";
import "./navigation.js";
import "./print.js";
import "./app.js";
import "./page-names.js";
