"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _1 = require(".");
test('visit()', function () {
    var tree = {
        type: 'binary',
        operator: '-',
        left: {
            type: 'binary',
            operator: '+',
            left: {
                type: 'identifier',
                identifier: 'foo',
            },
            right: {
                type: 'identifier',
                identifier: 'bar',
            },
        },
        right: {
            type: 'group',
            expression: {
                type: 'identifier',
                identifier: 'baz',
            },
        },
    };
    var grandparent;
    var parent;
    var unfound;
    (0, _1.visit)(tree, {
        identifier: {
            enter: function (path) {
                var _a, _b, _c;
                var node = path.node;
                if (node.identifier === 'foo') {
                    grandparent = (_a = path.findParent(function (_a) {
                        var node = _a.node;
                        return node.operator === '-';
                    })) === null || _a === void 0 ? void 0 : _a.node;
                    parent = (_b = path.findParent(function (_a) {
                        var node = _a.node;
                        return node.operator === '+';
                    })) === null || _b === void 0 ? void 0 : _b.node;
                    unfound = (_c = path.findParent(function (_a) {
                        var node = _a.node;
                        return node.operator === '*';
                    })) === null || _c === void 0 ? void 0 : _c.node;
                }
            },
        },
    });
    expect(grandparent).not.toBeNull();
    expect(grandparent === null || grandparent === void 0 ? void 0 : grandparent.type).toBe('binary');
    expect(parent).not.toBeNull();
    expect(parent === null || parent === void 0 ? void 0 : parent.type).toBe('binary');
    expect(unfound).not.toBeDefined();
});
