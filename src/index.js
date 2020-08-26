const {refactor} = require("shift-refactor");
const Shift = require("shift-ast");
const vendors = require("./vendors");
const fs = require("fs");

const filesDirectory = "files/";
const outputDirectory = "output/";
const scriptInfo = [
    {
        name: "datadome.js",
        func: vendors.Datadome
    },
    {
        name: "distil.js",
        func: vendors.Distil
    },
    {
        name: "akami.js",
        func: vendors.Akami
    },
    {
        name: "arkoselabs.js",
        func: vendors.ArkoseLabs
    },
    // geocomply takes a while because we have to query for a bunch of variables
    {
        name: "geocomply.js",
        func: vendors.Geocomply
    },
    {
        name: "shapesecurity.js",
        func: vendors.ShapeSecurity
    }
];

scriptInfo.forEach((currentScriptInfo) => {
    var fileContents = fs.readFileSync(filesDirectory + currentScriptInfo.name, "utf8");
    var script = refactor(fileContents);
    currentScriptInfo.func(script);
    fs.writeFileSync(outputDirectory + currentScriptInfo.name, script.print());
    console.log(
        "Deobfuscated " +
            filesDirectory +
            currentScriptInfo.name +
            " and saved the output to " +
            outputDirectory +
            currentScriptInfo.name
    );
});
