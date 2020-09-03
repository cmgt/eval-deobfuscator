const vm = require("vm");
const commonobfuscations = require("../commonobfuscations");
const util = require("../util");

module.exports = function Imperva(script) {
    var scriptContext = util.createEmptyVmContext();

    // find first function that begins with a string assignment 
    var bigStringAssignerFunction = script.query(`FunctionBody[statements.0.declaration.declarators.0.init.type="LiteralStringExpression"]`).first()
    bigStringAssignerFunction.forEach(node => {
        vm.runInContext(util.getNodeCode(node), scriptContext)
    })

    var subStrings = script.query(`CallExpression[callee.type="StaticMemberExpression"][callee.object.type="IdentifierExpression"][callee.property="substr"][arguments.length=2][arguments.0.type="LiteralNumericExpression"][arguments.1.type="LiteralNumericExpression"]`)
    subStrings.replace(node => {
        return util.appropriateLiteral(node, vm.runInContext(util.getNodeCode(node), scriptContext));
    })


    commonobfuscations.undoObfuscatorIoLiteralSubsitution(script, scriptContext);

    util.convertComputedToStatic(script);
    util.normalizeIdentifiers(script);
    return script;
}