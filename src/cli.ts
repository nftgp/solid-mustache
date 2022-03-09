import { mkdirSync, readFileSync, writeFileSync } from "fs"
import path, { basename, dirname, extname } from "path"

import { cosmiconfigSync } from "cosmiconfig"
import glob from "glob"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { compile } from "./compile"

const { argv } = yargs(hideBin(process.argv)).command(
  "* <template-file> [options]",
  "test",
  (yargs) =>
    yargs
      .positional("template-file", {
        type: "string",
        describe: "the template file to compile",
        demandOption: true,
      })
      .option("out", {
        alias: "o",
        type: "string",
        description: "The path to write the compiled .sol file to",
      })
      .option("name", {
        alias: "n",
        type: "string",
        description: "The name to use for the compiled library",
      })
      .option("solidity-pragma", {
        alias: "s",
        type: "string",
        default: "^0.8.6",
        description: "Define the solidity pragma",
      })
      .option("header", {
        alias: "h",
        type: "string",
        default: "// SPDX-License-Identifier: UNLICENSED",
        description: "Define a custom header for the .sol file",
      })
      .option("condense", {
        alias: "c",
        type: "boolean",
        description:
          "Condense sequences of consecutive whitespace into a single space char",
      })
      .option("partials", {
        alias: "p",
        type: "string",
        description:
          "Glob pattern for partial template files. Registers the partials under their respective file names (without extension).",
      })
      .option("print-width", {
        type: "number",
        default: 80,
        description: "Specify the line length that the printer will wrap on.",
      })
      .option("tab-width", {
        type: "number",
        default: 2,
        description: "Specify the number of spaces per indentation-level.",
      })
      .option("use-tabs", {
        type: "boolean",
        description: "Indent lines with tabs instead of spaces.",
      })
      .option("single-quote", {
        type: "boolean",
        description: "Use single quotes instead of double quotes.",
      })
      .option("no-bracket-spacing", {
        type: "boolean",
        description: "Do not print spaces between brackets.",
      })
      .option("no-explicit-types", {
        type: "boolean",
        description: "Use type aliases (`uint`, `int`, etc.).",
      })
)

const main = async () => {
  const {
    templateFile,
    out,
    name,
    solidityPragma,
    header,
    condense,
    partials,
    noBracketSpacing,
    noExplicitTypes,
    ...otherFormatOptions
  } = await argv

  const templatePath = path.resolve(templateFile)
  const templateContent = readFileSync(templatePath, {
    encoding: "utf8",
    flag: "r",
  })

  const dir = dirname(templatePath)
  const configFile = cosmiconfigSync("solid-mustache").search(dir)

  const defaultPartials = `${dir}/{partials/*,*.partial}.{hbs,handlebars}`

  const solContent = compile(templateContent, {
    ...configFile,
    name,
    solidityPragma,
    header,
    partials: loadPartials(partials || defaultPartials),
    condenseWhitespace: condense,

    bracketSpacing: !noBracketSpacing,
    explicitTypes: !noExplicitTypes,
    ...otherFormatOptions,
  })
  const outputPath = getOutputPath(templatePath, out)
  writeFile(outputPath, solContent)

  console.log(`Successfully compiled to ${outputPath}`)
}

main()

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function getOutputPath(templatePath: string, out: string | undefined) {
  const templateDirname = dirname(templatePath)
  const templateBasename = basename(templatePath)
  const templateName = templateBasename.substring(
    0,
    templateBasename.lastIndexOf(".")
  )

  // no out specified, use default
  if (!out) return path.resolve(templateDirname, `${templateName}.sol`)

  // out is a dir, use default filename
  if (!extname(out)) return path.resolve(out, `${templateName}.sol`)

  if (extname(out) !== ".sol") {
    throw new Error("Output path must be a directory or use the .sol extension")
  }

  return path.resolve(out)
}

function loadPartials(pattern: string) {
  const files = glob.sync(pattern)
  const result: Record<string, string> = {}
  files.forEach((pathString) => {
    const partialPath = path.resolve(pathString)
    const [name] = basename(partialPath).split(".")
    result[name] = readFileSync(partialPath, {
      encoding: "utf8",
      flag: "r",
    })
  })
  return result
}
