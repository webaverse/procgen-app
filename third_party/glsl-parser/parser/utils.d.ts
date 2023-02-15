import { AstNode, Scope } from '../ast';
export declare const renameBindings: (scope: Scope, mangle: (name: string, node: AstNode) => string) => void;
export declare const renameTypes: (scope: Scope, mangle: (name: string, node: AstNode) => string) => void;
export declare const renameFunctions: (scope: Scope, mangle: (name: string, node: AstNode) => string) => void;
