import { AstNode } from './node';
export type ScopeIndex = {
    [name: string]: {
        references: AstNode[];
    };
};
export type Scope = {
    name: string;
    parent?: Scope;
    bindings: ScopeIndex;
    types: ScopeIndex;
    functions: ScopeIndex;
};
/**
 * Converts an AST to a singe value, visiting nodes and using visitor callbacks
 * to generate the node's value. TODO: Could this be done with a reducetree
 * function? Also this is different than the enter/exit visitors in the ast
 * visitor function. Can these be merged into the same strategy?
 */
export interface Program {
    type: 'program';
    program: AstNode[];
    scopes: Scope[];
    wsStart?: string;
    wsEnd?: string;
}
export type Path<NodeType> = {
    node: NodeType;
    parent: Program | AstNode | undefined;
    parentPath: Path<any> | undefined;
    key: string | undefined;
    index: number | undefined;
    skip: () => void;
    remove: () => void;
    replaceWith: (replacer: AstNode) => void;
    findParent: (test: (p: Path<any>) => boolean) => Path<any> | undefined;
    skipped?: boolean;
    removed?: boolean;
    replaced?: any;
};
export type NodeVisitor<NodeType> = {
    enter?: (p: Path<NodeType>) => void;
    exit?: (p: Path<NodeType>) => void;
};
export type NodeVisitors = {
    [NodeType in AstNode['type']]?: NodeVisitor<Extract<AstNode, {
        type: NodeType;
    }>>;
} & {
    program?: NodeVisitor<Program>;
};
/**
 * Apply the visitor pattern to an AST that conforms to this compiler's spec
 */
declare const visit: (ast: Program | AstNode, visitors: NodeVisitors) => void;
type NodeGenerator<NodeType> = (node: NodeType) => string;
export type NodeGenerators = {
    [NodeType in AstNode['type']]: NodeGenerator<Extract<AstNode, {
        type: NodeType;
    }>>;
} & {
    program?: NodeGenerator<Program>;
};
export type Generator = (ast: Program | AstNode | AstNode[] | string | string[] | undefined | null) => string;
/**
 * Stringify an AST
 */
declare const makeGenerator: (generators: NodeGenerators) => Generator;
export type EveryOtherGenerator = (nodes: AstNode[], eo: AstNode[]) => string;
declare const makeEveryOtherGenerator: (generate: Generator) => EveryOtherGenerator;
export { visit, makeGenerator, makeEveryOtherGenerator };
