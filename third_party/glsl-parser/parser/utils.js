"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameFunctions = exports.renameTypes = exports.renameBindings = void 0;
var renameBindings = function (scope, mangle) {
    Object.entries(scope.bindings).forEach(function (_a) {
        var name = _a[0], binding = _a[1];
        binding.references.forEach(function (node) {
            if (node.type === 'declaration') {
                node.identifier.identifier = mangle(node.identifier.identifier, node);
            }
            else if (node.type === 'identifier') {
                node.identifier = mangle(node.identifier, node);
            }
            else if (node.type === 'parameter_declaration' &&
                'identifier' in node.declaration) {
                node.declaration.identifier.identifier = mangle(node.declaration.identifier.identifier, node);
            }
            else if (node.type === 'interface_declarator') {
                /* intentionally empty, for
                layout(std140,column_major) uniform;
                uniform Material
                {
                uniform vec2 prop;
                }
                 */
            }
            else {
                console.log(node);
                throw new Error("Binding for type ".concat(node.type, " not recognized"));
            }
        });
    });
};
exports.renameBindings = renameBindings;
var renameTypes = function (scope, mangle) {
    Object.entries(scope.types).forEach(function (_a) {
        var name = _a[0], type = _a[1];
        type.references.forEach(function (node) {
            if (node.type === 'struct') {
                node.typeName.identifier = mangle(node.typeName.identifier, node);
            }
            else if (node.type === 'identifier') {
                node.identifier = mangle(node.identifier, node);
            }
            else if (node.type === 'function_call' &&
                'specifier' in node.identifier) {
                node.identifier.specifier.identifier = mangle(node.identifier.specifier.identifier, node);
            }
            else {
                console.log(node);
                throw new Error("Binding for type ".concat(node.type, " not recognized"));
            }
        });
    });
};
exports.renameTypes = renameTypes;
var renameFunctions = function (scope, mangle) {
    Object.entries(scope.functions).forEach(function (_a) {
        var name = _a[0], binding = _a[1];
        binding.references.forEach(function (node) {
            if (node.type === 'function') {
                node['prototype'].header.name.identifier = mangle(node['prototype'].header.name.identifier, node);
            }
            else if (node.type === 'function_call' &&
                node.identifier.type === 'postfix') {
                node.identifier.expression.identifier.specifier.identifier = mangle(node.identifier.expression.identifier.specifier.identifier, node);
            }
            else if (node.type === 'function_call' &&
                'specifier' in node.identifier) {
                node.identifier.specifier.identifier = mangle(node.identifier.specifier.identifier, node);
                // Structs type names also become constructors. However, their renaming is
                // handled by bindings
            }
            else if (node.type !== 'struct') {
                console.log(node);
                throw new Error("Function for type ".concat(node.type, " not recognized"));
            }
        });
    });
};
exports.renameFunctions = renameFunctions;
