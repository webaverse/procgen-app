import { PreprocessorAstNode, PreprocessorSegmentNode } from './preprocessor-node';
export type PreprocessorProgram = {
    type: string;
    program: PreprocessorSegmentNode[];
    wsEnd?: string;
};
declare const preprocessComments: (src: string) => string;
type NodeEvaluator<NodeType> = (node: NodeType, visit: (node: PreprocessorAstNode) => any) => any;
export type NodeEvaluators = {
    [NodeType in PreprocessorAstNode['type']]: NodeEvaluator<Extract<PreprocessorAstNode, {
        type: NodeType;
    }>>;
};
export type Macro = {
    args?: PreprocessorAstNode[];
    body: string;
};
export type Macros = {
    [name: string]: Macro;
};
/**
 * Perform the preprocessing logic, aka the "preprocessing" phase of the compiler.
 * Expand macros, evaluate conditionals, etc
 * TODO: Define the strategy for conditionally removing certain macro types
 * and conditionally expanding certain expressions. And take in optiona list
 * of pre defined thigns?
 * TODO: Handle __LINE__ and other constants.
 */
export type NodePreservers = {
    [nodeType: string]: (path: any) => boolean;
};
export type PreprocessorOptions = {
    defines?: {
        [definitionName: string]: object;
    };
    preserve?: NodePreservers;
    preserveComments?: boolean;
    stopOnError?: boolean;
};
declare const preprocessAst: (program: PreprocessorProgram, options?: PreprocessorOptions) => PreprocessorProgram;
export { preprocessAst, preprocessComments };
