import { parse, AST } from "@handlebars/parser"

type Inputs = { [key: string]: unknown }

interface Result {
  contractSource: string
  chunks: string
}

export const compile = (template: string): Result => {
  const ast = parse(template)

  const lines = processProgram(ast, {})

  return {
    contractSource: `${header}${lines.join("\n")}${footer}`,
    chunks: "0123456789abcdefghijklmnopqrstuvwxzy",
  }
}

const processProgram = (
  program: AST.Program,
  pathAliases: Record<string, string>
) => {
  console.log({ pathAliases })
  const lines = program.body.map((s) => process(s, pathAliases)).flat()
  return lines
}

const process = (
  statement: AST.Statement,
  pathAliases: Record<string, string>
): string[] => {
  switch (statement.type) {
    case "ContentStatement":
      return processContentStatement(statement as AST.ContentStatement)

    case "MustacheStatement":
      return processMustacheStatement(
        statement as AST.MustacheStatement,
        pathAliases
      )

    case "BlockStatement":
      return processBlockStatement(statement as AST.BlockStatement, pathAliases)
  }

  throw new Error(`Unexpected statement type: ${statement.type}`)
}

const processContentStatement = (statement: AST.ContentStatement) => {
  return [solStrAppend(`"${solEscape(statement.value)}"`)]
}

const processMustacheStatement = (
  statement: AST.MustacheStatement,
  pathAliases: Record<string, string>
) => {
  const path = statement.path
  if (path.type === "PathExpression") {
    const fullPath = resolvePath(path as AST.PathExpression, pathAliases)
    return [solStrAppend(fullPath)]
  }

  throw new Error(`Unsupported path type: ${statement.path.type}`)
}

const processBlockStatement = (
  statement: AST.BlockStatement,
  pathAliases: Record<string, string>
) => {
  console.log("BLOCK", statement)
  const { head } = statement.path

  if (head === "each") {
    const path = statement.params[0]
    if (path.type !== "PathExpression") throw new Error("Unsupported")
    const fullPath = resolvePath(path as AST.PathExpression, pathAliases)

    // find a unique index var name
    let i = 0
    while (pathAliases[`__index_${i}`]) i++
    const indexVarName = `__index_${i}`

    const [itemVarName, indexVarAlias = indexVarName] = statement.program
      .blockParams || ["this", "@index"]

    return [
      `for(uint256 ${indexVarName}; ${indexVarName} < ${fullPath}.length; ${indexVarName}++) {`,
      ...processProgram(statement.program, {
        ...pathAliases,
        [indexVarAlias]: indexVarName,
        [itemVarName]: `${fullPath}[${indexVarName}]`,
      }),
      `}`,
    ]
  }

  throw new Error(`Unsupported block statement head: ${head}`)
}

const INPUT_VAR_NAME = "__input"
const RESULT_VAR_NAME = "__result"

const resolvePath = (
  path: AST.PathExpression,
  pathAliases: Record<string, string>
) => {
  const { parts, original } = path

  if (original === "this") {
    return pathAliases.this
  }

  if (typeof parts[0] !== "string")
    throw new Error("Sub expressions are not supported")

  if (pathAliases[parts[0]]) {
    return [pathAliases[parts[0]], ...parts.slice(1)].join(".")
  }

  // everything we don't know about must come from the input parameter
  return `${INPUT_VAR_NAME}.${original}`
}

const solStrAppend = (str: string) =>
  `${RESULT_VAR_NAME} = string(abi.encodePacked(${RESULT_VAR_NAME}, ${str}));`

const solEscape = (str: string) =>
  str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\f/g, "\\f")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\v/g, "\\v")

const header = `
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract Template {
  struct Input {
    string color;
    string[] words;
  }

  function render(Input memory ${INPUT_VAR_NAME})
    public
    pure
    returns (string memory ${RESULT_VAR_NAME})
  {
`.trim()

const footer = `
  }
}
`.trim()
