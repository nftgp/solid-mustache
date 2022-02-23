import { AST, parse } from "@handlebars/parser"
import { format } from "prettier"
import prettierPluginSolidity from "prettier-plugin-solidity"

type UnknownInput = { type: undefined }
type StringInput = { type: "string"; length?: number }
type UintInput = { type: "uint"; length?: number }
type IntInput = { type: "int"; length?: number }
type BoolInput = { type: "bool" }

type ArrayInput = {
  type: "array"
  length?: number
  elementType: InputType
}
type StructInput = {
  type: "struct"
  members: {
    [field: string]: InputType
  }
}

type InputType =
  | UnknownInput
  | StringInput
  | BoolInput
  | UintInput
  | IntInput
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
  explicitTypes?: boolean
}

interface Options {
  /** Assign a custom name to the library/contract (default: "Template") */
  name?: string
  /** Define the solidity pragma (default: "^0.8.6") */
  solidityPragma?: string
  /** Define the custom header for the .sol file (default: "// SPDX-License-Identifier: UNLICENSED") */
  header?: string
  /** Set to true to compile into a contract rather than a library */
  contract?: boolean
  /** Allows providing additional templates that can be used via partial call expressions */
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

  const scope = new Scope()
  const usedPartials: Partial[] = []

  const lines = processProgram(ast, scope)

  if (scope.inputType.type !== "struct") {
    throw new Error("Unexpected input type")
  }
  if (Object.keys(scope.inputType.members).length === 0) {
    throw new Error(
      "The template file does not contain any template expressions."
    )
  }

  const typeNames = generateTypeNames(scope.inputType)
  const structDefs = solDefineStructs(typeNames)
  const partialDefs = usedPartials
    .reverse()
    .map((partial) => solDefinePartial(partial, typeNames))
    .join("\n\n")

  const {
    header = "// SPDX-License-Identifier: UNLICENSED",
    solidityPragma = "^0.8.6",
  } = options

  const solidityCode = `${header}
pragma solidity ${solidityPragma};

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

  ${SOL_INT_TO_STRING}
}
`
  return format(solidityCode, {
    plugins: [prettierPluginSolidity],
    parser: "solidity-parse",
    ...options.format,
    explicitTypes: options.format?.explicitTypes === false ? "never" : "always",
  } as Parameters<typeof format>[1])

  /** AST processing function sharing access to options and usedPartials variables via JS function scope */

  function processProgram(program: AST.Program, scope: Scope): CodeLine[] {
    // generate complete output
    const output = program.body.map((s) => processStatement(s, scope)).flat()

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

  function processStatement(statement: AST.Statement, scope: Scope): Output[] {
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

      case "PartialStatement":
        return processPartialStatement(statement as AST.PartialStatement, scope)

      case "CommentStatement":
        return []
    }

    throw new Error(`Unexpected statement type: ${statement.type}`)
  }

  function processContentStatement(statement: AST.ContentStatement): Output[] {
    return statement.value.length > 0
      ? [{ append: [`"${solEscape(statement.value)}"`] }]
      : []
  }

  function processMustacheStatement(
    statement: AST.MustacheStatement,
    scope: Scope
  ): Output[] {
    if (statement.path.type !== "PathExpression") {
      throw new Error(`Unsupported path type: ${statement.path.type}`)
    }

    const path = statement.path as AST.PathExpression
    const intMatch = path.original.match(/^(uint|int)(\d*)$/)
    const bytesMatch = path.original.match(/^bytes(\d*)$/)
    if (intMatch) {
      const type = intMatch[1] as "uint" | "int"
      const length = parseInt(intMatch[2])
      const fullPath = scope.resolve(statement.params[0] as AST.PathExpression)
      narrowInput(scope.inputType, fullPath, type, length)
      return [{ append: [`${type}ToString(${fullPath})`] }]
    } else if (bytesMatch) {
      const length = parseInt(bytesMatch[1])
      const fullPath = scope.resolve(statement.params[0] as AST.PathExpression)
      narrowInput(scope.inputType, fullPath, "string", length)
      return [{ append: [fullPath] }]
    } else {
      const fullPath = scope.resolve(path)
      narrowInput(scope.inputType, fullPath, "string")
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

    if (head === "if" || head === "unless") {
      return processConditionalBlock(statement, scope)
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
    scope: Scope
  ): Output[] {
    const path = (
      statement.params.length === 0 ? statement.path : statement.params[0]
    ) as AST.PathExpression
    const conditionResolvedPath = scope.resolve(path)
    narrowInput(scope.inputType, conditionResolvedPath, "bool")

    const negate = statement.path.head === "unless"
    const condition = `${negate ? "!" : ""}${conditionResolvedPath}`

    const containsSingleAppend =
      statement.program.body.length === 1 &&
      statement.program.body[0].type !== "BlockStatement"

    // Optimization: use ternary if possible
    if (containsSingleAppend) {
      const [singleAppend] = processStatement(statement.program.body[0], scope)
      if (
        singleAppend &&
        "append" in singleAppend &&
        singleAppend.append.length === 1
      ) {
        const [appendStr] = singleAppend.append
        return [{ append: [`${condition} ? ${appendStr} : ""`] }]
      }
    }

    return [
      {
        line: `if(${condition}) {`,
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
    const { params, program, hash } = statement
    const path = params[0]
    if (path.type !== "PathExpression") throw new Error("Unsupported")
    const pathExpr = path as AST.PathExpression

    const lengthHashValue = hash?.pairs?.find((p) => p.key === "length")?.value
    const length =
      lengthHashValue?.type === "NumberLiteral"
        ? (lengthHashValue as AST.NumberLiteral).value
        : undefined

    const iterateeResolvedPath = scope.resolve(pathExpr)
    narrowInput(scope.inputType, iterateeResolvedPath, "array", length)

    // find a unique index var name
    let indexVarName = "__i"
    while (scope.varNames.includes(indexVarName))
      indexVarName = incrementName(indexVarName)
    scope.addVar(indexVarName)

    const [itemVarAlias = "this", indexVarAlias = "@index"] =
      program.blockParams || []

    const newScope = scope.dive(`${iterateeResolvedPath}[${indexVarName}]`, {
      [indexVarAlias]: indexVarName,
      [itemVarAlias]: `${iterateeResolvedPath}[${indexVarName}]`,
    })

    return [
      {
        line: `for(uint256 ${indexVarName}; ${indexVarName} < ${iterateeResolvedPath}.length; ${indexVarName}++) {`,
      },
      ...processProgram(program, newScope),
      {
        line: `}`,
      },
    ]
  }

  function processPartialStatement(
    statement: AST.PartialStatement,
    scope: Scope
  ): Output[] {
    if (statement.name.type !== "PathExpression") throw new Error("Unsupported")
    const partialName = statement.name.original
    const partialTemplate = options.partials && options.partials[partialName]
    if (!partialTemplate) {
      throw new Error(`Trying to use an unknown partial: ${partialName}`)
    }

    const contextPath = statement.params[0]
      ? scope.resolve(statement.params[0] as AST.PathExpression)
      : scope.path

    let partial = usedPartials.find((p) => p.name === partialName)
    if (!partial) {
      const preprocessedPartialTemplate = options.condenseWhitespace
        ? condenseWhitespace(partialTemplate)
        : partialTemplate
      const ast = parse(preprocessedPartialTemplate)
      const inputType = resolveType(scope.inputType, contextPath)

      partial = {
        name: partialName,
        lines: processProgram(ast, new Scope(inputType)),
        inputType,
      }
      usedPartials.push(partial)
    }

    return [{ append: [`${partial.name}(${contextPath})`] }]
  }
}

interface Scope {
  /** Keeps track of all Solidity variable names */
  varNames: string[]
  aliases: Record<string, string>
  parent?: Scope
}

class Scope {
  inputType: InputType
  path: string
  /** Keeps track of all Solidity variable names */
  varNames: string[]
  aliases: Record<string, string>
  parent?: Scope

  constructor(
    inputType: InputType = { type: "struct", members: {} },
    path = `${INPUT_VAR_NAME}`,
    varNames = [INPUT_VAR_NAME],
    aliases = {},
    parent?: Scope
  ) {
    this.inputType = inputType
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
      this.inputType,
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
  inputType: InputType,
  path: string, // example: __inputs.member[0].submember
  narrowed: "string" | "array" | "bool" | "uint" | "int",
  length?: number
) {
  let type = inputType
  const [prefix, ...parts] = path.split(/\.|(?=\[)/g) // split at . and before [

  // local vars can't be narrowed
  if (prefix !== INPUT_VAR_NAME) return

  parts.forEach((part, i) => {
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

  if (length) {
    if (!["string", "uint", "int", "array"].includes(narrowed)) {
      throw new Error(`${narrowed} type does not have length`)
    }
    Object.assign(type, {
      type: narrowed,
      length: Math.max(("length" in type && type.length) || 0, length),
    })
  }
}

const resolveType = (inputType: InputType, path: string): InputType => {
  const [prefix, ...parts] = path.split(/\.|(?=\[)/g) // split at . and before [

  let result = inputType
  parts.forEach((part, i) => {
    const prevName = parts[i - 1] || prefix

    const isArrayRef = !!part.match(/\[\w+\]/)
    if (isArrayRef) {
      if (result.type !== "array") {
        throw new Error(
          `Trying to access ${prevName} as an array, but it is a ${inputType.type}`
        )
      }

      result = result.elementType
    } else {
      if (result.type !== "struct") {
        throw new Error(
          `Trying to access ${prevName} as a struct, but it is a ${inputType.type}`
        )
      }

      if (!result.members[part]) {
        result.members[part] = { type: undefined }
      }
      result = result.members[part]
    }
  })

  return result
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
      const length = memberType.length || ""

      if (memberType.elementType.type === "struct") {
        const structName = useExistingOrAddStruct(
          singularize(name),
          memberType.elementType
        )
        result.push({
          name: `${structName}[${length}]`,
          inputType: memberType,
        })
        generateTypeNames(memberType.elementType, result)
      } else {
        const elementTypeName = memberType.elementType.type || "string"
        result.push({
          name: `${elementTypeName}[${length}]`,
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
    } else if ("length" in memberType && memberType.length) {
      const typeName = memberType.type === "string" ? "bytes" : memberType.type
      result.push({
        name: `${typeName}${memberType.length}`,
        inputType: memberType,
      })
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
  typeNames.find((typeName) => compatible(typeName.inputType, type))?.name

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

  const dataLocation =
    inputType.type === "bool" || inputType.type === "uint" ? "" : " memory"

  return `
  function ${name}(${typeName}${dataLocation} ${INPUT_VAR_NAME}) internal pure returns (string memory ${RESULT_VAR_NAME}) {
    ${lines.map((l) => l.line).join("\n")}
  }
  `
}

const SOL_INT_TO_STRING = `function intToString(int256 i) internal pure returns (string memory) {
  if (i >= 0) {
    return uintToString(uint256(i));
  }
  return string(abi.encodePacked("-", uintToString(uint256(-i))));
}

function uintToString(uint256 i) internal pure returns (string memory) {
  if (i == 0) {
    return "0";
  }
  uint256 j = i;
  uint256 len;
  while (j != 0) {
    len++;
    j /= 10;
  }
  bytes memory bstr = new bytes(len);
  uint256 k = len;
  while (i != 0) {
    k -= 1;
    uint8 temp = (48 + uint8(i - (i / 10) * 10));
    bstr[k] = bytes1(temp);
    i /= 10;
  }
  return string(bstr);
}`

const compatible = (a: InputType, b: InputType): boolean => {
  if (a === b) return true

  if (!a.type || !b.type) return true

  if (a.type === "array" && b.type === "array")
    return compatible(a.elementType, b.elementType)

  if (a.type === "struct" && b.type === "struct") return membersMatch(a, b)

  return a.type === b.type
}

const membersMatch = (a: StructInput, b: StructInput): boolean =>
  a.members.length === b.members.length &&
  Object.entries(a.members).every(
    ([name, type]) => b.members[name] && compatible(type, b.members[name])
  )

const singularize = (str: string) =>
  str.endsWith("s") ? str.substring(0, str.length - 1) : str

const incrementName = (str: string) => {
  const match = str.match(/^(\w+?)(\d*)$/)
  if (!match) {
    throw new Error(`Unexpected var name: ${str}`)
  }
  const [, base, counter] = match
  let i = counter ? Number(counter) : 1
  if (isNaN(i)) i = 1
  return `${base}${i + 1}`
}

const condenseWhitespace = (str: string) => str.replace(/\s+/g, " ")
