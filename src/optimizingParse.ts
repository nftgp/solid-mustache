import { AST, parse as baseParse } from "@handlebars/parser"

interface Options {
  condenseWhitespace?: boolean
  minRepeatingSubstringLength?: number
}

export const createOptimizingParse = ({
  condenseWhitespace: shallCondenseWhitespace,
  minRepeatingSubstringLength = 16,
}: Options = {}) => {
  const parse = shallCondenseWhitespace ? condenseAndParse : baseParse

  const optimizingParse = (input: string, partials: Record<string, string>) => {
    const program = parse(input)

    // 1) collect all content strings & filter out empty content statements
    const contentStrings: string[] = []
    const cleaned = flatMapContentStatements(
      program,
      (contentStatement) => {
        if (contentStatement.value) {
          contentStrings.push(contentStatement.value)
          return [contentStatement]
        } else {
          return []
        }
      },
      { parse, partialSources: partials }
    )

    // 2) isolate repeating substrings in content strings
    const { chunks, indexMap, substrings } = findRepeatingSubstrings(
      contentStrings,
      minRepeatingSubstringLength
    )

    // 3) map content expressions in AST to split them accordingly
    let constantIndex = 0
    const constantNames = new Map<symbol, string>()
    const constants = new Map<string, string>()
    const result = flatMapContentStatements(
      cleaned.program,
      (contentStatement, index) => {
        const result: (AST.ContentStatement | AST.MustacheStatement)[] = []
        let chunkIndex = indexMap.indexOf(index)

        while (indexMap[chunkIndex] === index) {
          const chunk = chunks[chunkIndex]
          if (typeof chunk === "symbol") {
            const value = substrings.get(chunk)
            if (value === undefined) throw new Error("invariant violation")

            let constantName = constantNames.get(chunk)
            if (!constantName) {
              constantName = `__constant${constantIndex++}`
              constantNames.set(chunk, constantName)
              constants.set(constantName, value)
            }

            result.push({
              type: "MustacheStatement",
              path: {
                type: "PathExpression",
                data: false,
                depth: 0,
                parts: [constantName],
                head: constantName,
                tail: [],
                original: constantName,
                loc: contentStatement.loc,
              },
              params: [],
              escaped: false,
              loc: contentStatement.loc,
              strip: { open: false, close: false },
              hash: { type: "Hash", pairs: [], loc: contentStatement.loc },
            })
          } else {
            result.push({
              ...contentStatement,
              value: chunk,
            })
          }
          chunkIndex++
        }
        return result
      },
      { partialASTs: cleaned.partials }
    )

    return { ...result, constants }
  }

  return optimizingParse
}

export const indexOf = (
  chunks: (string | symbol)[],
  substring: string,
  startChunk: number,
  startChar: number
) => {
  for (let i = startChunk; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (typeof chunk === "symbol") continue

    const char = chunk.indexOf(substring, i === startChunk ? startChar : 0)
    if (char > -1) {
      return { chunk: i, char }
    }
  }
  return undefined
}

const arrayJoin = <E, I>(arr: E[], insert: I) =>
  arr.flatMap((element, i) => [
    element,
    ...(i < arr.length - 1 ? [insert] : []),
  ])

export const findRepeatingSubstrings = (
  strings: string[],
  minimalLength: number
) => {
  let chunks: (string | symbol)[] = strings
  const substrings = new Map<symbol, string>()
  let indexMap = Array.from(Array(chunks.length).keys()) // keeps track of index of the original chunk from which the resulting chunk was split out

  chunkLoop: for (let i = 0; i < chunks.length - i; i++) {
    const chunk = chunks[i]
    if (typeof chunk === "symbol") continue
    if (chunk.length < minimalLength) continue

    for (let j = 0; j <= chunk.length - minimalLength; j++) {
      let length = minimalLength
      let substring = chunk.substring(j, j + length)
      while (
        j + length <= chunk.length &&
        indexOf(chunks, substring, i, j + length)
      ) {
        length++
        substring = chunk.substring(j, j + length)
      }

      // length is now the matching length + 1
      // if it is the minimal length, there is no match starting at i
      if (length > minimalLength) {
        length--
        const substring = chunk.substring(j, j + length)
        const symbol = Symbol(substring)
        substrings.set(symbol, substring)
        const newIndexMap = new Array(indexMap.length)

        chunks = chunks.flatMap((chunk, chunkIndex) => {
          if (typeof chunk === "symbol") {
            newIndexMap[chunkIndex] = indexMap[chunkIndex]
            return chunk
          }
          // split on substring, then insert symbols in between
          const subchunks = arrayJoin(
            chunk.split(substring),
            symbol as symbol
          ).filter((chunk) => chunk !== "")
          if (indexMap[chunkIndex] === undefined) {
            throw new Error("invariant violation")
          }
          newIndexMap[chunkIndex] = new Array(subchunks.length).fill(
            indexMap[chunkIndex]
          )
          return subchunks
        })

        indexMap = newIndexMap.flat()
        i++ // increment one extra to jump over the inserted symbol
        // break inner loop to start over with the new chunks
        continue chunkLoop
      }
    }
  }

  return { substrings, chunks, indexMap }
}

function flatMapContentStatements(
  program: AST.Program,
  contentStatementCallback: (
    contentStatement: AST.ContentStatement,
    index: number
  ) => AST.Expression[],
  options:
    | {
        parse: (input: string) => AST.Program
        partialSources: Record<string, string>
      }
    | {
        partialASTs: Map<string, AST.Program>
      }
) {
  let index = 0
  const partialSources =
    "partialSources" in options ? options.partialSources : {}
  const partialASTs =
    "partialASTs" in options
      ? options.partialASTs
      : new Map<string, AST.Program>()
  const processedPartials = new Set<string>()

  const processedAST = processProgram(program)
  return { program: processedAST, partials: partialASTs }

  function processProgram(program: AST.Program): AST.Program {
    return {
      ...program,
      body: program.body.flatMap((s) => processStatement(s)),
    }
  }

  function processStatement(statement: AST.Statement) {
    switch (statement.type) {
      case "ContentStatement":
        return contentStatementCallback(
          statement as AST.ContentStatement,
          index++
        )

      case "BlockStatement":
        return processBlock(statement as AST.BlockStatement)

      case "PartialStatement":
        return processPartialStatement(statement as AST.PartialStatement)
    }

    return statement
  }

  function processBlock(statement: AST.BlockStatement) {
    return {
      ...statement,
      program: processProgram(statement.program),
    }
  }

  function processPartialStatement(statement: AST.PartialStatement) {
    if (statement.name.type !== "PathExpression") throw new Error("Unsupported")
    const partialName = statement.name.original

    if (!processedPartials.has(partialName)) {
      processedPartials.add(partialName)

      let partialAST = partialASTs.get(partialName)
      if (!partialAST) {
        const partialTemplate = partialSources && partialSources[partialName]
        if (!partialTemplate) {
          throw new Error(`Trying to use an unknown partial: ${partialName}`)
        }
        const parse = "parse" in options && options.parse
        if (!parse) throw new Error("invariant violation")
        partialAST = parse(partialTemplate)
      }

      partialASTs.set(partialName, processProgram(partialAST))
    }

    return statement
  }
}

const condenseAndParse = (input: string) =>
  baseParse(input.replace(/\s+/g, " "))
