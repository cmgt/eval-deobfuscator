const vm = require("vm");
const Shift = require("shift-ast");
const shiftValidator = require("shift-validator");
const shiftCodegen = require("@jsoverson/shift-codegen");
const {IdGenerator} = require("./id-generator");

/**
 * @description determine if an array contains one or more items from another array.
 * @param {array} haystack the array to search.
 * @param {array} arr the array providing items to check for in the haystack.
 * @return {boolean} true|false if haystack contains at least one item from arr.
 */
function findOne(haystack, arr) {
    return arr.some(function (v) {
        return haystack.indexOf(v) >= 0;
    });
}

function normalizeIdentifiers(script) {
    const lookupTable = script.session.globalSession.getLookupTable();
    const idGenerator = new IdGenerator();
    renameScope(lookupTable.scope, idGenerator);
}

function renameScope(scope, idGenerator) {
    scope.variableList.forEach((variable) => {
        if (variable.declarations.length === 0) return;
        const nextId = idGenerator.next();
        variable.declarations.forEach((_) => (_.node.name = nextId));
        variable.references.forEach((_) => (_.node.name = nextId));
    });
    scope.children.forEach((_) => renameScope(_, idGenerator));
}

function getNodeCode(node) {
    const generator = new shiftCodegen.MinimalCodeGen();
    return shiftCodegen.default(node, generator) + "\n";
}

// Replaces array literal references with their real values.  Stolen from mass-beautifier.
function substituteArrayLiterals(script) {
    const allNamedArrays = script.query(`VariableDeclarator[init.type="ArrayExpression"]`);

    const allNamedLiteralArrays = allNamedArrays.filter(
        ({init}) => init.elements.findIndex((element) => !element.type.startsWith("Literal")) === -1
    );

    allNamedLiteralArrays.forEach((array) => {
        const query = `ComputedMemberExpression[object.type=IdentifierExpression][object.name=${JSON.stringify(
            array.binding.name
        )}][expression.type="LiteralNumericExpression"]`;
        script.query(query).replace((node) => array.init.elements[node.expression.value]);
    });
}

// Stolen from mass-beautifier
function convertComputedToStatic(script) {
    script
        .query(`ComputedMemberExpression[expression.type="LiteralStringExpression"]`)
        .replace((node) => {
            const replacement = new Shift.StaticMemberExpression({
                object: node.object,
                property: node.expression.value
            });
            return shiftValidator.default(replacement) ? replacement : node;
        });

    script
        .query(`ComputedMemberAssignmentTarget[expression.type="LiteralStringExpression"]`)
        .replace((node) => {
            const replacement = new Shift.StaticMemberAssignmentTarget({
                object: node.object,
                property: node.expression.value
            });
            return shiftValidator.default(replacement) ? replacement : node;
        });

    script
        .query(`ComputedPropertyName[expression.type="LiteralStringExpression"]`)
        .replace((node) => {
            const replacement = new Shift.StaticPropertyName({
                value: node.expression.value
            });
            return shiftValidator.default(replacement) ? replacement : node;
        });
}

/*
This function combines string literals that are added together.
For instance:
"a" + "b" + "c" -> "abc"
"a" + "b" + variable + "c" -> "ab" + variable + "c"
*/
function mergeAddedStrings(script) {
    const binaryAddStringsQueryText = `BinaryExpression[left.type="LiteralStringExpression"][right.type="LiteralStringExpression"]`;
    replaceRecursive(script, binaryAddStringsQueryText, (node) => {
        return new Shift.LiteralStringExpression({
            value: node.left.value + node.right.value
        });
    });
}

/*
This function calls repeatedly calls replace until there is no results remaining.
*/
function replaceRecursive(script, query, replaceFunction) {
    var result = script.query(query);
    var resultsCount = result.nodes.length;
    while (resultsCount > 0) {
        // keep replacing till we run out of nodes
        result.replace(replaceFunction);

        result = script.query(query);
        resultsCount = result.nodes.length;
    }
}

/*
This function returns the appropriately typed Shift AST literal given a value.
Only undefined/null/string literals/number literals are supported.  Strings containing null characters are encoded.
TODO: Encode strings containing non printable and unicode characters.
*/
function appropriateLiteral(currentNode, value) {
    var type = typeof value;

    if (value === undefined) {
        return new Shift.IdentifierExpression({
            name: "undefined"
        });
    } else if (value === null) {
        return new Shift.LiteralNullExpression({});
    } else if (type === "number") {
        return new Shift.LiteralNumericExpression({
            value: value
        });
    } else if (type === "string") {
        if (value.includes(String.fromCharCode(0))) {
            if (value.length === 1) {
                // if the string is just a null character, just make it ""
                return new Shift.LiteralStringExpression({
                    value: ""
                });
            } else {
                // if the string contains a null character, escape it
                return new Shift.CallExpression({
                    callee: new Shift.IdentifierExpression({
                        name: "unescape"
                    }),
                    arguments: [
                        new Shift.LiteralStringExpression({
                            value: escape(value)
                        })
                    ]
                });
            }
        }
        return new Shift.LiteralStringExpression({
            value: value
        });
    } else if (type === "boolean") {
        return new Shift.LiteralStringExpression({
            value: value
        });
        return currentNode;
    }
}

/*
Make sure to use normalizeIdentifiers before running this.
NOTE: This function makes a lot of assumptions about the program.  
For instance:
var a = "a";
a += "b";
a += variable;
a += "d";

Will become (incorrectly):
var a = "abd";
a += variable;

Make sure the script you are running this on does not look like that.

Programs that this code is run on should look like:
var a = "a";
a += "b";
a += "c";

And will become
var a = "abc";
*/
function combinePlusEqualStrings(script) {
    script
        .query(
            `VariableDeclarator[binding.type="BindingIdentifier"][binding.name][init.type="LiteralStringExpression"]`
        )
        .replace((node) => {
            var variableName = node.binding.name;

            var plusEqualsNodes = script.query(
                `ExpressionStatement[expression.type="CompoundAssignmentExpression"][expression.binding.type="AssignmentTargetIdentifier"][expression.operator="+="][expression.expression.type="LiteralStringExpression"][expression.binding.name=${JSON.stringify(
                    variableName
                )}]`
            );

            var newValue = node.init.value;
            plusEqualsNodes.forEach((node) => {
                newValue += node.expression.expression.value;
            });
            plusEqualsNodes.delete();

            return new Shift.VariableDeclarator({
                binding: new Shift.BindingIdentifier({
                    name: variableName
                }),
                init: new Shift.LiteralStringExpression({
                    value: newValue
                })
            });
        });
}

/* NOTE: This function makes a lot of assumptions about the program.  Make sure to normalizeIdentifiers before running this.
It replaces all references to a variable with its initially assigned value, regardless of it is modified in the program.  This will probably break a LOT of scripts.
*/
function replaceStaticStrings(script) {
    staticStringVariables = script.query(
        `VariableDeclarator[binding.type="BindingIdentifier"][init.type="LiteralStringExpression"]`
    );
    staticStringVariables.forEach((node) => {
        var refs = script.query(`IdentifierExpression[name=${JSON.stringify(node.binding.name)}]`);
        refs.replace((refNode) => {
            return new Shift.LiteralStringExpression({
                value: node.init.value
            });
        });
    });
}

/*
This function transforms (example):
[
  IdentifierExpression {
    type: 'IdentifierExpression',
    name: 'variable'
  },
  LiteralNumericExpression {
    type: 'LiteralNumericExpression',
    value: 181
  },
  LiteralNumericExpression {
    type: 'LiteralNumericExpression',
    value: 174
  },
  LiteralNumericExpression {
    type: 'LiteralNumericExpression',
    value: 183
  },
]

Into:
[context["variable"], 181, 174, 183]
This is useful for passing callexpression arguments into a real function.
NOTE: This function only supports identifiers, numbers/strings, nulls, and booleans.
TODO: add support for arrays/objects -> ie, node for "a[1]" becomes context["a"][1]
*/
function transformNodesIntoValues(nodes, context) {
    var resultArray = [];
    nodes.forEach((node) => {
        var type = node.type;
        if (type === "IdentifierExpression") {
            resultArray.push(context[node.name]);
        } else if (
            type === "LiteralNumericExpression" ||
            type === "LiteralStringExpression" ||
            type === "LiteralBooleanExpression"
        ) {
            resultArray.push(node.value);
        } else if (type === "LiteralNullExpression") {
            resultArray.push(null);
        }
    });
    return resultArray;
}

module.exports = {
    mergeAddedStrings: mergeAddedStrings,
    replaceRecursive: replaceRecursive,
    convertComputedToStatic: convertComputedToStatic,
    getNodeCode: getNodeCode,
    appropriateLiteral: appropriateLiteral,
    combinePlusEqualStrings: combinePlusEqualStrings,
    replaceStaticStrings: replaceStaticStrings,
    normalizeIdentifiers: normalizeIdentifiers,
    transformNodesIntoValues: transformNodesIntoValues,
    findOne: findOne
};
