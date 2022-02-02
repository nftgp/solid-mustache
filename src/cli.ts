import { mkdirSync, readFileSync, writeFileSync } from "fs"
import path, { basename, dirname, extname } from "path"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { compile } from "./compile"

const { argv } = yargs(hideBin(process.argv)).command(
  "* <template_file> [options]",
  "test",
  (yargs) =>
    yargs
      .positional("template_file", {
        type: "string",
        describe: "the template file to compile",
        demandOption: true,
      })
      .option("out", {
        alias: "o",
        type: "string",
        description: "The path to write the compiled .sol file to",
      })
)

const main = async () => {
  const { template_file, out } = await argv
  const templatePath = path.resolve(template_file)
  const templateContent = readFileSync(templatePath, {
    encoding: "utf8",
    flag: "r",
  })

  const solContent = compile(templateContent)
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
