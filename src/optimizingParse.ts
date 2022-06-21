import { AST, parse } from "@handlebars/parser"

interface Options {
  condenseWhitespace?: boolean
  minRepeatingSubstringLength?: number
}
export const createOptimizingParse = ({
  condenseWhitespace: shallCondenseWhitespace,
  minRepeatingSubstringLength = 16,
}: Options = {}) => {
  const optimizingParse = (input: string, partials: Record<string, string>) => {
    const preprocessedTemplate = shallCondenseWhitespace
      ? condenseWhitespace(input)
      : input
    const program = parse(preprocessedTemplate)

    // 1) collect all content strings
    const contentStrings: string[] = []
    processAST(program, partials, (contentStatement) => {
      contentStrings.push(contentStatement.value)
      return [contentStatement]
    })

    // 2) isolate repeating substrings in content strings
    const { chunks, indexMap, substrings } = findRepeatingSubstrings(
      contentStrings,
      minRepeatingSubstringLength
    )

    // 3) map content expressions in AST to split them accordingly
    return processAST(program, partials, (contentStatement, index) => {
      const result: AST.ContentStatement[] = []
      let chunkIndex = indexMap.indexOf(index)
      while (indexMap[chunkIndex] === index) {
        const chunk = chunks[chunkIndex]
        const value = typeof chunk === "symbol" ? substrings.get(chunk) : chunk
        if (!value) throw new Error("invariant violation")
        result.push({
          ...contentStatement,
          value,
        })
        chunkIndex++
      }
      return result
    })
  }

  return optimizingParse
}

const condenseWhitespace = (str: string) => str.replace(/\s+/g, " ")

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

const arrayJoin = (arr: any[], insert: any) =>
  arr.flatMap((element, i) => [
    element,
    ...(i < arr.length - 1 ? [insert] : []),
  ])

export const findRepeatingSubstrings = (
  chunks: (string | symbol)[],
  minimalLength: number
) => {
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
          if (typeof chunk === "symbol") return chunk
          // split on substring, then insert symbols in between and remove empty strings possibly inserted when splitting on prefix or suffix
          const subchunks = arrayJoin(chunk.split(substring), symbol).filter(
            (chunk) => typeof chunk === "symbol" || chunk !== ""
          )
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

function processAST(
  program: AST.Program,
  partials: Record<string, string>,
  contentStatementCallback: (
    contentStatement: AST.ContentStatement,
    index: number
  ) => AST.ContentStatement[]
) {
  let index = 0
  const partialASTs = new Map<string, AST.Program>()
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
        return processProgram((statement as AST.BlockStatement).program)

      case "PartialStatement":
        return processPartialStatement(statement as AST.PartialStatement)
    }

    return statement
  }

  function processPartialStatement(statement: AST.PartialStatement) {
    if (statement.name.type !== "PathExpression") throw new Error("Unsupported")
    const partialName = statement.name.original

    if (!partialASTs.has(partialName)) {
      const partialTemplate = partials && partials[partialName]
      if (!partialTemplate) {
        throw new Error(`Trying to use an unknown partial: ${partialName}`)
      }

      const partialAST = parse(partialTemplate)
      partialASTs.set(partialName, processProgram(partialAST))
    }

    return statement
  }
}
