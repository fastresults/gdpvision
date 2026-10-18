import { fixGaps } from "./lib/narrative-retag.server";
const r = await fixGaps(["ATG","GLP","MTQ","MAF","PRI","SXM"]);
console.log(JSON.stringify({ still_gap: r.still_gap, retag: r.retag, outlets: r.outlets_added, g: r.guarantee }));
