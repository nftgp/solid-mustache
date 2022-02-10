import { AST, parse } from "@handlebars/parser"
import { format } from "prettier"
import prettierPluginSolidity from "prettier-plugin-solidity"

type UnknownInput = { type: undefined }
type StringInput = { type: "string" }
type UintInput = { type: "uint" }
type BoolInput = { type: "bool" }
type ArrayInput = {
  type: "array"
  elementType:
    | StringInput
    | BoolInput
    | UintInput
    | StructInput
    | ArrayInput
    | UnknownInput
}
type StructInput = {
  type: "struct"
  members: {
    [field: string]:
      | StringInput
      | BoolInput
      | UintInput
      | ArrayInput
      | StructInput
      | UnknownInput
  }
}
type InputType =
  | UnknownInput
  | StringInput
  | BoolInput
  | UintInput
  | ArrayInput
  | StructInput

interface Partial {
  name: string
  lines: CodeLine[]
  inputType: InputType
}

interface CodeLine {
  line: string
}
interface AppendStrings {
  append: string[]
}
type Output = CodeLine | AppendStrings

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
  /** Allows providing additional templates that can be used via partial expressions */
  partials?: Record<string, string>
  /** Set to true to condense sequences of whitespace into single space, saving some contract size */
  condenseWhitespace?: boolean
  /** Formatting options for prettier */
  format?: FormatOptions
}

export const compile = (template: string, options: Options = {}): string => {
  const preprocessedTemplate = options.condenseWhitespace
    ? condenseWhitespace(template)
    : template
  const ast = parse(preprocessedTemplate)

  const inputsType: StructInput = { type: "struct", members: {} }
  const usedPartials: Partial[] = []

  const lines = processProgram(ast, new Scope())

  if (Object.keys(inputsType.members).length === 0) {
    throw new Error(
      "The template file does not contain any template expressions."
    )
  }

  const typeNames = generateTypeNames(inputsType)
  const structDefs = solDefineStructs(typeNames)

  const partialDefs = usedPartials
    .map((partial) => solDefinePartial(partial, typeNames))
    .join("\n\n")

  const solidityCode = `
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

${options.contract ? "contract" : "library"} ${options.name || "Template"} {

  ${structDefs}

  function render(${INPUT_STRUCT_NAME} memory ${INPUT_VAR_NAME})
    public
    pure
    returns (string memory ${RESULT_VAR_NAME})
  {
    ${lines.map((l) => l.line).join("\n")}
  }

  ${partialDefs}

  ${SOL_UINT2STR}
}
`
  return format(solidityCode, {
    plugins: [prettierPluginSolidity],
    parser: "solidity-parse",
    ...options.format,
  })

  /** AST processing function sharing access to inputsType and partialScopes variables via JS function scope */

  function processProgram(program: AST.Program, scope: Scope): CodeLine[] {
    // generate complete output
    const output = program.body.map((s) => process(s, scope)).flat()

    // merge appends into single statement until we hit the EVM's stack size limit
    const LIMIT = 16
    const merged: Output[] = []

    output.forEach((out) => {
      if ("line" in out) {
        merged.push(out)
      } else {
        const last = merged[merged.length - 1]
        if (
          last &&
          "append" in last &&
          last.append.length + out.append.length <= LIMIT
        ) {
          last.append = last.append.concat(out.append)
        } else {
          merged.push(out)
        }
      }
    }, [] as Output[])

    // convert appends to code lines
    return merged.map((out) => {
      if ("append" in out) {
        return { line: solStrAppend(out.append) }
      } else {
        return out
      }
    })
  }

  function process(statement: AST.Statement, scope: Scope): Output[] {
    switch (statement.type) {
      case "ContentStatement":
        return processContentStatement(statement as AST.ContentStatement)

      case "MustacheStatement":
        return processMustacheStatement(
          statement as AST.MustacheStatement,
          scope
        )

      case "BlockStatement":
        return processBlockStatement(statement as AST.BlockStatement, scope)
    }

    throw new Error(`Unexpected statement type: ${statement.type}`)
  }

  function processContentStatement(statement: AST.ContentStatement): Output[] {
    return [{ append: [`"${solEscape(statement.value)}"`] }]
  }

  function processMustacheStatement(
    statement: AST.MustacheStatement,
    scope: Scope
  ): Output[] {
    if (statement.path.type !== "PathExpression") {
      throw new Error(`Unsupported path type: ${statement.path.type}`)
    }

    const path = statement.path as AST.PathExpression
    if (path.original === "uint2str") {
      const fullPath = scope.resolve(statement.params[0] as AST.PathExpression)
      narrowInput(inputsType, fullPath, "uint")
      return [{ append: [`uint2str(${fullPath})`] }]
    } else {
      const fullPath = scope.resolve(path)
      narrowInput(inputsType, fullPath, "string")
      return [{ append: [fullPath] }]
    }
  }

  function processBlockStatement(
    statement: AST.BlockStatement,
    scope: Scope
  ): Output[] {
    const { head } = statement.path

    if (head === "each") {
      return processEachBlock(statement, scope)
    }

    if (head === "if") {
      return processConditionalBlock(statement, scope)
    }
    if (head === "unless") {
      return processConditionalBlock(statement, scope, true)
    }

    if (statement.params.length > 0) {
      throw new Error(
        `Unsupported block statement with params: ${statement.path.original}`
      )
    }

    return processConditionalBlock(statement, scope)
  }

  function processConditionalBlock(
    statement: AST.BlockStatement,
    scope: Scope,
    negate?: boolean
  ): Output[] {
    const path = (
      statement.params.length === 0 ? statement.path : statement.params[0]
    ) as AST.PathExpression

    const conditionResolvedPath = scope.resolve(path)
    narrowInput(inputsType, conditionResolvedPath, "bool")

    return [
      {
        line: `if(${negate ? "!" : ""}${conditionResolvedPath}) {`,
      },
      ...processProgram(statement.program, scope),
      {
        line: `}`,
      },
    ]
  }

  function processEachBlock(
    statement: AST.BlockStatement,
    scope: Scope
  ): Output[] {
    const path = statement.params[0]
    if (path.type !== "PathExpression") throw new Error("Unsupported")
    const pathExpr = path as AST.PathExpression

    const iterateeResolvedPath = scope.resolve(pathExpr)
    narrowInput(inputsType, iterateeResolvedPath, "array")

    // find a unique index var name
    let indexVarName = "__i"
    while (scope.varNames.includes(indexVarName))
      indexVarName = incrementName(indexVarName)
    scope.addVar(indexVarName)

    const [itemVarAlias = "this", indexVarAlias = "@index"] =
      statement.program.blockParams || []

    const newScope = scope.dive(`${iterateeResolvedPath}[${indexVarName}]`, {
      [indexVarAlias]: indexVarName,
      [itemVarAlias]: `${iterateeResolvedPath}[${indexVarName}]`,
    })

    return [
      {
        line: `for(uint256 ${indexVarName}; ${indexVarName} < ${iterateeResolvedPath}.length; ${indexVarName}++) {`,
      },
      ...processProgram(statement.program, newScope),
      {
        line: `}`,
      },
    ]
  }
}

interface Scope {
  /** Keeps track of all Solidity variable names */
  varNames: string[]
  aliases: Record<string, string>
  parent?: Scope
}

class Scope {
  path: string
  /** Keeps track of all Solidity variable names */
  varNames: string[]
  aliases: Record<string, string>
  parent?: Scope

  constructor(
    path = `${INPUT_VAR_NAME}`,
    varNames = [INPUT_VAR_NAME],
    aliases = {},
    parent?: Scope
  ) {
    this.path = path
    this.varNames = varNames
    this.aliases = aliases
    this.parent = parent
  }

  addVar(name: string) {
    this.varNames.push(name)
  }

  resolve(path: AST.PathExpression): string {
    const { parts, original, depth } = path

    if (depth > 0) {
      let upperScope: Scope
      try {
        upperScope = this.climb(depth)
      } catch (e) {
        throw new Error(`Path expression ${original} has excessive depth`)
      }
      return upperScope.resolve({
        ...path,
        depth: 0,
        original: path.original.slice(3),
      })
    }

    if (original === "." || original === "this") {
      return this.path
    }

    const BUILT_IN_ALIASES = ["@index"]
    if (BUILT_IN_ALIASES.includes(original)) {
      return this.aliases[original]
    }

    if (typeof parts[0] !== "string")
      throw new Error(`Unsupported path expression: ${original}`)

    // everything we haven't aliased must come from the current scope, so we prefix with path
    const origin = this.aliases[parts[0]] || `${this.path}.${parts[0]}`

    const joined = parts
      .slice(1)
      .map((part) => (isNaN(Number(part)) ? `.${part}` : `[${part}]`))
      .join("")

    return `${origin}${joined}`
  }

  dive(path: string, newAliases = {}) {
    return new Scope(
      path,
      this.varNames,
      { ...this.aliases, ...newAliases },
      this
    )
  }

  climb(depth: number) {
    let result: Scope = this
    for (let i = 0; i < depth; i++) {
      if (!result.parent) {
        throw new Error("excessive path expression depth")
      }
      result = result.parent
    }
    return result
  }
}

function narrowInput(
  inputsType: InputType,
  path: string, // example: __inputs.member[0].submember
  narrowed: "string" | "array" | "bool" | "uint"
) {
  let type = inputsType

  const [prefix, ...parts] = path.split(/\.|(?=\[)/g) // split at . and before [

  // local vars can't be narrowed
  if (prefix !== INPUT_VAR_NAME) return

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

      const structType = type as StructInput
      if (!structType.members[part]) {
        structType.members[part] = { type: undefined }
      }
      type = structType.members[part]
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

  if (narrowed === "string" || narrowed === "bool" || narrowed === "uint") {
    Object.assign(type, {
      type: narrowed,
    })
  }
}

const solStrAppend = (strings: string[]) => {
  const args = [RESULT_VAR_NAME, ...strings].join(", ")
  return `${RESULT_VAR_NAME} = string(abi.encodePacked(${args}));`
}

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

type TypeName = { name: string; inputType: InputType }
const generateTypeNames = (
  structInput: StructInput,
  result: TypeName[] = [{ name: INPUT_STRUCT_NAME, inputType: structInput }]
): TypeName[] => {
  const useExistingOrAddStruct = (
    fieldName: string,
    fieldType: StructInput
  ) => {
    const existingStruct = result.find((existing) =>
      compatible(existing.inputType, fieldType)
    )

    let structName = existingStruct
      ? existingStruct.name
      : fieldName[0].toUpperCase() + fieldName.substring(1)

    if (!existingStruct) {
      while (result.some(({ name }) => name === structName))
        structName = incrementName(structName)
    }

    result.push({ name: structName, inputType: fieldType })
    return structName
  }

  Object.entries(structInput.members).forEach(([name, memberType]) => {
    if (memberType.type === "array") {
      if (memberType.elementType.type === "array") {
        throw new Error("Multi-dimensional arrays are not supported in ABI")
      }

      if (memberType.elementType.type === "struct") {
        const structName = useExistingOrAddStruct(
          singularize(name),
          memberType.elementType
        )
        result.push({
          name: `${structName}[]`,
          inputType: memberType,
        })
        generateTypeNames(memberType.elementType, result)
      } else {
        const elementTypeName = memberType.elementType.type || "string"
        result.push({
          name: `${elementTypeName}[]`,
          inputType: memberType,
        })
      }
    } else if (memberType.type === "struct") {
      const structName = useExistingOrAddStruct(name, memberType)
      result.push({
        name: structName,
        inputType: memberType,
      })
      generateTypeNames(memberType, result)
    } else {
      result.push({
        name: memberType.type || "string",
        inputType: memberType,
      })
    }
  })

  return result
}

const findTypeName = (typeNames: TypeName[], type: InputType) =>
  typeNames.find((typeName) => typeName.inputType === type)?.name

const solDefineStructs = (typeNames: TypeName[]): string => {
  const uniqueStructs = typeNames.filter(
    ({ name, inputType }, index) =>
      inputType.type === "struct" &&
      typeNames.findIndex((tn) => tn.name === name) === index
  )

  const structDefs = uniqueStructs.map(({ name, inputType }) => {
    const struct = inputType as StructInput
    const fieldDefs = Object.entries(struct.members).map(
      ([name, type]) => `${findTypeName(typeNames, type)} ${name};`
    )
    return `
    struct ${name} {
      ${fieldDefs.join("\n")}
    }
    `
  })

  return structDefs.join("\n\n")
}

const solDefinePartial = (partial: Partial, typeNames: TypeName[]) => {
  const { name, lines, inputType } = partial
  const typeName = findTypeName(typeNames, inputType)
  return `
  function ${name}(${typeName} ${INPUT_VAR_NAME}) internal pure returns (string memory ${RESULT_VAR_NAME}) {
    ${lines.map((l) => l.line).join("\n")}
  }
  `
}

const SOL_UINT2STR = `function uint2str(uint _i) internal pure returns (string memory) {
  if (_i == 0) {
      return "0";
  }
  uint j = _i;
  uint len;
  while (j != 0) {
      len++;
      j /= 10;
  }
  bytes memory bstr = new bytes(len);
  uint k = len;
  while (_i != 0) {
      k = k-1;
      uint8 temp = (48 + uint8(_i - _i / 10 * 10));
      bytes1 b1 = bytes1(temp);
      bstr[k] = b1;
      _i /= 10;
  }
  return string(bstr);
}`

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
  Object.entries(a.members).every(
    ([name, type]) => b.members[name] && compatible(type, b.members[name])
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

const condenseWhitespace = (str: string) => str.replace(/\s+/g, " ")
