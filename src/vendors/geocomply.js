const util = require("../util");
const commonobfuscations = require("../commonobfuscations");

module.exports = function Geocomply(script) {
    // this string deobfuscation makes the script understandble but for some reason running the resulting script results in an infinite loop.  TODO: figure this out.

    util.normalizeIdentifiers(script);
    // this takes a while because they pass the numbers into the string deobfuscator as variable references so we have to go query for the variable
    commonobfuscations.undoJscramblerString(script, util.createEmptyVmContext());
    // these two functions also involve a bunch of querying and take a while too
    util.combinePlusEqualStrings(script);
    util.replaceStaticValues(script);
    util.convertComputedToStatic(script);

    return script;
};
