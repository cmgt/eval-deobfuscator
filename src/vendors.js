const vm = require("vm");
const util = require("./util");
const commonobfuscations = require("./commonobfuscations");
const Shift = require("shift-ast");

function Datadome(script) {
    commonobfuscations.undoObfuscatorIoBase64(script, util.createEmptyVmContext());
    util.convertComputedToStatic(script);
}

function Distil(script) {
    commonobfuscations.substituteArrayLiterals(script);
    util.convertComputedToStatic(script);
}

function Akami(script) {
    commonobfuscations.substituteArrayLiterals(script);
    util.convertComputedToStatic(script);
}

function ArkoseLabs(script) {
    util.normalizeIdentifiers(script);
    commonobfuscations.undoJscramblerString(script, util.createEmptyVmContext());
    util.convertComputedToStatic(script);
}

function Geocomply(script) {
    util.normalizeIdentifiers(script);
    // this takes a while because they pass the numbers into the string deobfuscator as variable references so we have to go query for the variable
    commonobfuscations.undoJscramblerString(script, util.createEmptyVmContext());
    // these two functions also involve a bunch of querying and take a while too
    util.combinePlusEqualStrings(script);
    util.replaceStaticStrings(script);
    util.convertComputedToStatic(script);
}

function ShapeSecurityBasic(script) {
    /*
    Running the deobfuscated form of the script causes console.log outputs saying that "securemsg.js" tests are failing.
    /*
    while this makes the script actually intelligible, it fails their "securemsg.js" tests.  I think it has to do with how I handle unprintable/unicode characters.
    */
    util.normalizeIdentifiers(script);

    var scriptContext = util.createEmptyVmContext();

    /* the deobfuscator functions are called like:
    a = 3
    s(a, 199, 21, 30, 3, 88, 31)
    this gets all the variable assignments of the form (var a = xxx;) and puts them in the context.  this is ok because everything is normalized and these variables aren't modified by any functions
    */
    var deobfuscatorInts = script.query(
        `VariableDeclarationStatement[declaration.type="VariableDeclaration"][declaration.kind="var"][declaration.declarators.length=1][declaration.declarators.0.init.type="LiteralNumericExpression"]`
    );
    deobfuscatorInts.forEach((node) => {
        // assign the variables
        vm.runInContext(util.getNodeCode(node), scriptContext);
    });

    // find all functions that begin with "var xxx = arguments.length".  these are one kind of string deobfuscator functions
    var basicDeobfuscaterFunctions = script.query(
        `FunctionDeclaration[isAsync=false][isGenerator=false][params.type="FormalParameters"][params.items.length=1][body.statements.0.type="VariableDeclarationStatement"][body.statements.0.declaration.declarators.0.type="VariableDeclarator"][body.statements.0.declaration.declarators.0.init.object.name="arguments"][body.statements.0.declaration.declarators.0.init.property="length"]`
    );

    basicDeobfuscaterFunctions.forEach((node) => {
        vm.runInContext(util.getNodeCode(node), scriptContext);
        var functionName = node.name.name;
        var calls = script.query(`CallExpression[callee.name=${JSON.stringify(functionName)}]`);
        calls.replace((callNode) => {
            return util.appropriateLiteral(
                callNode,
                scriptContext[functionName](
                    ...util.transformNodesIntoValues(callNode.arguments, scriptContext)
                )
            );
        });
    });

    /*
    This function replaces calls to the toString radix based deobfuscation function with the real value of the string.
 
    The function looks something like this:
    function deobfuscate(a, b) {
          a += b;
          return a.toString(36);
    }
    */
    const toStringRadixDeobfuscator = script
        .query(
            `FunctionDeclaration[isAsync=false][isGenerator=false][params.type="FormalParameters"][params.items.length=2][body.statements.0.type="ExpressionStatement"][body.statements.0.expression.type="CompoundAssignmentExpression"][body.statements.0.expression.operator="+="]`
        )
        .first();
    if (toStringRadixDeobfuscator.length) {
        const toStringRadixDeobfuscatorNode = toStringRadixDeobfuscator.nodes[0];
        const toStringRadixDeobfuscatorName = toStringRadixDeobfuscatorNode.name.name;
        vm.runInContext(util.getNodeCode(toStringRadixDeobfuscatorNode), scriptContext);

        const toStringRadixDeobfuscatorCalls = script.query(
            `CallExpression[callee.name=${JSON.stringify(toStringRadixDeobfuscatorName)}]`
        );
        toStringRadixDeobfuscatorCalls.replace((node) => {
            return util.appropriateLiteral(
                node,
                scriptContext[toStringRadixDeobfuscatorName](
                    ...util.transformNodesIntoValues(node.arguments, scriptContext)
                )
            );
        });
    }

    /*
    there is a function that is essentially:
    function x(y) {
        return y > 637
    }
    this replaces all calls of it with the actual true/false value
    */
    const trueFalseFunction = script
        .query(
            `FunctionDeclaration[isAsync=false][isGenerator=false][params.type="FormalParameters"][params.items.length=1][body.statements.length=1][body.statements.0.type="ReturnStatement"][body.statements.0.expression.type="BinaryExpression"][body.statements.0.expression.operator=">"]`
        )
        .first();
    if (trueFalseFunction.length) {
        const trueFalseFunctionNode = trueFalseFunction.nodes[0];
        const trueFalseFunctionName = trueFalseFunctionNode.name.name;
        vm.runInContext(util.getNodeCode(trueFalseFunctionNode), scriptContext);

        const trueFalseFunctionCalls = script.query(
            `CallExpression[callee.name=${JSON.stringify(trueFalseFunctionName)}]`
        );
        trueFalseFunctionCalls.replace((node) => {
            return new Shift.LiteralBooleanExpression({
                value: scriptContext[trueFalseFunctionName](
                    ...util.transformNodesIntoValues(node.arguments, scriptContext)
                )
            });
        });
    }

    util.simplifyLiteralConditions(script);
}

function ShapeSecurityVM(script) {
    // TODO: FINISH
    util.normalizeIdentifiers(script);
}

function PerimeterX(script) {
    util.normalizeIdentifiers(script);

    var scriptContext = util.createEmptyVmContext();
    var base64XorDeobfuscators = script.query(
        `FunctionDeclaration[isAsync=false][isGenerator=false][name.type="BindingIdentifier"][params.type="FormalParameters"][params.items.length=1][body.statements.0.type="ForStatement"][body.statements.0.init.type="VariableDeclaration"][body.statements.0.init.declarators.0.type="VariableDeclarator"][body.statements.0.init.declarators.0.init.type="CallExpression"][body.statements.0.init.declarators.0.init.callee.name="atob"]`
    );
    base64XorDeobfuscators.forEach((node) => {
        var functionName = node.name.name;
        // declare the function
        vm.runInContext(util.getNodeCode(node), scriptContext);
        // replace direct calls of them with actual values
        script
            .query(
                `CallExpression[arguments.length=1][arguments.0.type="LiteralStringExpression"][callee.type="IdentifierExpression"][callee.name=${JSON.stringify(
                    functionName
                )}]`
            )
            .replace((callNode) => {
                return util.appropriateLiteral(
                    callNode,
                    scriptContext[functionName](
                        ...util.transformNodesIntoValues(callNode.arguments, scriptContext)
                    )
                );
            });
        // replace referenced calls of them with actual values
        script
            .query(
                `VariableDeclarator[init.type="IdentifierExpression"][init.name=${JSON.stringify(
                    functionName
                )}]`
            )
            .forEach((referenceNode) => {
                script
                    .query(
                        `CallExpression[arguments.length=1][arguments.0.type="LiteralStringExpression"][callee.type="IdentifierExpression"][callee.name=${JSON.stringify(
                            referenceNode.binding.name
                        )}]`
                    )
                    .replace((callNode) => {
                        return util.appropriateLiteral(
                            callNode,
                            scriptContext[functionName](
                                ...util.transformNodesIntoValues(callNode.arguments, scriptContext)
                            )
                        );
                    });
            });
    });

    const otherBase64ObfuscatorQuery = script
        .query(
            `FunctionDeclaration[isAsync=false][isGenerator=false][name.type="BindingIdentifier"][params.type="FormalParameters"][params.items.length=1][body.statements.length=1][body.statements.0.type="ReturnStatement"][body.statements.0.expression.type="ConditionalExpression"][body.statements.0.expression.test.left.value="function"][body.statements.0.expression.test.right.type="UnaryExpression"][body.statements.0.expression.test.right.operand.type="IdentifierExpression"][body.statements.0.expression.alternate.type="CallExpression"][body.statements.0.expression.alternate.callee.type="IdentifierExpression"]`
        )
        .first();
    console.log(otherBase64ObfuscatorQuery);
    if (!!otherBase64ObfuscatorQuery.nodes.length) {
        var firstResult = otherBase64ObfuscatorQuery.nodes[0];
        var returnStatement = firstResult.body.statements[0];
        var referencedFunctionName = returnStatement.expression.test.right.operand.name;
        var referencedFunctionQuery = script.query(
            `VariableDeclarator[binding.name=${JSON.stringify(
                referencedFunctionName
            )}][init.type="CallExpression"][init.callee.type="FunctionExpression"]`
        );

        vm.runInContext(util.getFirstCode(referencedFunctionQuery), scriptContext);
        vm.runInContext(util.getFirstCode(otherBase64ObfuscatorQuery), scriptContext);

        script
            .query(
                `CallExpression[arguments.length=1][arguments.0.type="LiteralStringExpression"][callee.type="IdentifierExpression"][callee.name=${JSON.stringify(
                    firstResult.name.name
                )}]`
            )
            .replace((node) => {
                return util.appropriateLiteral(
                    node,
                    scriptContext[firstResult.name.name](
                        ...util.transformNodesIntoValues(node.arguments, scriptContext)
                    )
                );
            });
    }
}

module.exports = {
    Datadome: Datadome,
    Distil: Distil,
    Akami: Akami,
    ArkoseLabs: ArkoseLabs,
    Geocomply: Geocomply,
    ShapeSecurityBasic: ShapeSecurityBasic,
    ShapeSecurityVM: ShapeSecurityVM,
    PerimeterX: PerimeterX
};
