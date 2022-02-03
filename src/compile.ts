import { AST, parse } from "@handlebars/parser"
import { format } from "prettier"
import prettierPluginSolidity from "prettier-plugin-solidity"

type UnknownInput = { type: undefined }
type StringInput = { type: "string" }
type ArrayInput = {
  type: "array"
  elementType: StringInput | StructInput | ArrayInput | UnknownInput
}
type StructInput = {
  type: "struct"
  members: {
    [field: string]: StringInput | ArrayInput | StructInput | UnknownInput
  }
}
type InputType = UnknownInput | StringInput | ArrayInput | StructInput

const INPUT_STRUCT_NAME = "__Input"
const INPUT_VAR_NAME = "__input"
const RESULT_VAR_NAME = "__result"

interface FormatOptions {
  printWidth?: number
  tabWidth?: number
  useTabs?: boolean
  singleQuote?: boolean
  bracketSpacing?: boolean
  explicitTypes?: "always" | "never" | "preserve"
}
interface Options {
  /** Assign a custom name to the library/contract (default: "Template") */
  name?: string
  /** Set to true to compile into a contract rather than a library */
  contract?: boolean
  /** Formatting options fpr prettier */
  format?: FormatOptions
}

export const compile = (template: string, options: Options = {}): string => {
  const ast = parse(template)
  const inputsType: StructInput = { type: "struct", members: {} }

  const lines = processProgram(ast, {})
  if (Object.keys(inputsType.members).length === 0) {
    throw new Error("The template does not use any interpolation.")
  }
  const structDefs = solDefineStruct(inputsType, INPUT_STRUCT_NAME)

  return format(
    `
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

${options.contract ? "contract" : "library"} ${options.name || "Template"} {

  ${structDefs}

  function render(${INPUT_STRUCT_NAME} memory ${INPUT_VAR_NAME})
    public
    pure
    returns (string memory ${RESULT_VAR_NAME})
  {
    ${lines.join("\n")}
  }
}
`,
    {
      plugins: [prettierPluginSolidity],
      parser: "solidity-parse",
      ...options.format,
    }
  )

  /** AST processing function sharing access to inputsType variable via function scope */

  function processProgram(
    program: AST.Program,
    pathAliases: Record<string, string>
  ) {
    const lines = program.body.map((s) => process(s, pathAliases)).flat()
    return lines
  }

  function process(
    statement: AST.Statement,
    pathAliases: Record<string, string>
  ): string[] {
    switch (statement.type) {
      case "ContentStatement":
        return processContentStatement(statement as AST.ContentStatement)

      case "MustacheStatement":
        return processMustacheStatement(
          statement as AST.MustacheStatement,
          pathAliases
        )

      case "BlockStatement":
        return processBlockStatement(
          statement as AST.BlockStatement,
          pathAliases
        )
    }

    throw new Error(`Unexpected statement type: ${statement.type}`)
  }

  function processContentStatement(statement: AST.ContentStatement) {
    return [solStrAppend(`"${solEscape(statement.value)}"`)]
  }

  function processMustacheStatement(
    statement: AST.MustacheStatement,
    pathAliases: Record<string, string>
  ) {
    const path = statement.path
    if (path.type === "PathExpression") {
      const pathExpr = path as AST.PathExpression
      const fullPath = resolvePath(pathExpr, pathAliases)
      narrowInput(inputsType, fullPath, "string")
      return [solStrAppend(fullPath)]
    }

    throw new Error(`Unsupported path type: ${statement.path.type}`)
  }

  function processBlockStatement(
    statement: AST.BlockStatement,
    pathAliases: Record<string, string>
  ) {
    const { head } = statement.path

    if (head === "each") {
      return processEachBlock(statement, pathAliases)
    }

    throw new Error(`Unsupported block statement head: ${head}`)
  }

  function processEachBlock(
    statement: AST.BlockStatement,
    pathAliases: Record<string, string>
  ) {
    const path = statement.params[0]
    if (path.type !== "PathExpression") throw new Error("Unsupported")
    const pathExpr = path as AST.PathExpression

    const iterateeResolvedPath = resolvePath(pathExpr, pathAliases)
    narrowInput(inputsType, iterateeResolvedPath, "array")

    // find a unique index var name
    let i = 0
    while (pathAliases[`__index_${i}`]) i++
    const indexVarName = `__index_${i}`

    const [itemVarName, indexVarAlias = indexVarName] = statement.program
      .blockParams || ["this", "@index"]

    return [
      `for(uint256 ${indexVarName}; ${indexVarName} < ${iterateeResolvedPath}.length; ${indexVarName}++) {`,
      ...processProgram(statement.program, {
        ...pathAliases,
        [indexVarAlias]: indexVarName,
        [itemVarName]: `${iterateeResolvedPath}[${indexVarName}]`,
      }),
      `}`,
    ]
  }
}

function narrowInput(
  inputsType: InputType,
  path: string, // example: __inputs.member[0].submember
  narrowed: "string" | "array"
) {
  let type = inputsType

  const parts = path
    .split(/\.|(?=\[)/g) // split at . and before [
    .slice(1)

  parts.forEach((part, i) => {
    if (typeof part !== "string")
      throw new Error("Sub expressions are not supported")

    const isArrayRef = !!part.match(/\[\w+\]/)
    if (isArrayRef) {
      // mark the dereferenced field as an array
      if (!type.type) {
        Object.assign(type, {
          type: "array",
          elementType: { type: undefined },
        })
      } else if (type.type !== "array") {
        throw new Error(
          `${path} accesses ${
            parts[i - 1]
          } field as array, but the field has been identified as ${type.type}`
        )
      }
      type = (type as ArrayInput).elementType
    } else {
      // mark the dereferenced field as a struct
      if (!type.type) {
        Object.assign(type, {
          type: "struct",
          members: {},
        })
      } else if (type.type !== "struct") {
        throw new Error(
          `${path} accesses ${
            parts[i - 1]
          } field as struct, but the field has been identified as ${type.type}`
        )
      }
      ;(type as StructInput).members[part] = { type: undefined }
      type = (type as StructInput).members[part]
    }
  })

  // We've reached the type of the referenced field, appropriately narrowing every field on the path.
  // Now we can narrow also this type according to the provided type info.

  if (type.type && type.type !== narrowed) {
    throw new Error(
      `Type narrowing conflict: Trying to identify ${path} as ${narrowed}, but it was previously identified as ${type.type}`
    )
  }

  if (
    narrowed === "array" &&
    (type.type !== "array" || type.elementType.type === undefined)
  ) {
    Object.assign(type, {
      type: "array",
      elementType: { type: undefined },
    })
  }

  if (narrowed === "string") {
    Object.assign(type, {
      type: "string",
    })
  }
}

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

  // everything we haven't aliased must come directly from the input variable
  const origin = pathAliases[parts[0]] || INPUT_VAR_NAME

  const joined = parts
    .map((part) => (isNaN(Number(part)) ? `.${part}` : `[${part}]`))
    .join("")

  return `${origin}${joined}`
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

const solDefineStruct = (
  type: StructInput,
  name: string,
  definedStructs: { [name: string]: StructInput } = {}
): string => {
  const newStructDefs: { [name: string]: StructInput } = {}

  const useExistingOrAdd = (fieldName: string, fieldType: StructInput) => {
    const existingStruct = Object.entries(definedStructs).find(([, t]) =>
      compatible(t, fieldType)
    )

    let structName = existingStruct
      ? existingStruct[0]
      : fieldName[0].toUpperCase() + fieldName.substring(1)

    if (!existingStruct) {
      while (definedStructs[structName]) structName = incrementName(structName)
      newStructDefs[structName] = fieldType
      definedStructs[structName] = fieldType
    }

    return structName
  }

  const fieldDefs = Object.entries(type.members).map(([name, type]) => {
    if (!type.type || type.type === "string") {
      return `string ${name};`
    }

    if (type.type === "array") {
      if (type.elementType.type === "array") {
        throw new Error("Multi-dimensional arrays are not supported in ABI")
      }

      if (!type.elementType.type || type.elementType.type === "string") {
        return `string[] ${name};`
      }

      if (type.elementType.type === "struct") {
        const structName = useExistingOrAdd(singularize(name), type.elementType)
        return `${structName}[] ${name};`
      }
    }

    if (type.type === "struct") {
      const structName = useExistingOrAdd(name, type)
      return `${structName} ${name};`
    }
  })

  const structDefs = Object.entries(newStructDefs).map(([name, type]) =>
    solDefineStruct(type, name, definedStructs)
  )

  return `
  ${structDefs.join("\n\n")}

  struct ${name} {
    ${fieldDefs.join("\n")}
  }`.trim()
}

const compatible = (a: InputType, b: InputType): boolean => {
  if (!a.type || !b.type) return true

  if (a.type !== b.type) return false

  if (a.type === "array" && b.type === "array")
    return compatible(a.elementType, b.elementType)

  if (a.type === "struct" && b.type === "struct") return membersMatch(a, b)

  return false
}

const membersMatch = (a: StructInput, b: StructInput): boolean =>
  a.members.length === b.members.length &&
  Object.entries(a.members).every(([name, type]) =>
    compatible(type, b.members[name])
  )

const singularize = (str: string) =>
  str.endsWith("s") ? str.substring(0, str.length - 1) : str

const incrementName = (str: string) => {
  const i = str.lastIndexOf("_")
  const counter = Number(str.substring(i + 1))
  if (isNaN(counter)) {
    return `${str}_2`
  } else {
    return `${str.substring(0, i)}${counter + 1}`
  }
}
