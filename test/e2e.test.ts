import { expect } from "chai"
import { ethers } from "hardhat"
import "@nomiclabs/hardhat-ethers"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import { compile } from "../src/compile"
import { Contract } from "ethers"

const solc = require("solc")

function solCompile(contractSource: string) {
  return JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          "Template.sol": {
            content: contractSource,
          },
        },
        settings: {
          outputSelection: {
            "*": {
              "*": ["*"],
            },
          },
        },
      }),
      { import: findImports }
    )
  )
}

function findImports(importPath: string) {
  if (importPath === "@rari-capital/solmate/src/utils/SSTORE2.sol") {
    return {
      contents: readFileSync(
        path.join(__dirname, "../node_modules", importPath),
        {
          encoding: "utf8",
          flag: "r",
        }
      ),
    }
  } else {
    return { error: "File not found" }
  }
}

describe("end-to-end test suite", () => {
  const cases = readdirSync(path.join(__dirname, "cases"), {
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.endsWith(".skip"))

  cases.forEach((name) => {
    describe(name, () => {
      const files = readdirSync(path.join(__dirname, "cases", name), {
        withFileTypes: true,
      })

      const templateFile = files.find(
        (dirent) =>
          dirent.name.startsWith("template.") && dirent.name.endsWith(".hbs")
      )

      if (!templateFile) {
        console.warn(
          `No template file found for test case cases/${name}. Skipping.`
        )
        return
      }

      const template = readFileSync(
        path.join(__dirname, "cases", name, templateFile.name),
        {
          encoding: "utf8",
          flag: "r",
        }
      )

      let contract: Contract

      before(async () => {
        const { contractSource, chunks } = compile(template)

        writeFileSync(
          path.join(__dirname, "cases", name, "Template.sol"),
          contractSource
        )

        const solcOutput = solCompile(contractSource)

        if (!solcOutput.contracts) {
          console.error("Solc failed")
          console.error(solcOutput)
        }

        const { abi } = solcOutput.contracts["Template.sol"].Template
        const bytecode =
          solcOutput.contracts["Template.sol"].Template.evm.bytecode.object

        console.log("Successfully compiled Template.sol to bytecode")

        const [signer] = await ethers.getSigners()
        const factory = new ethers.ContractFactory(abi, bytecode, signer)
        contract = await factory.deploy()

        console.log("Successfully deployed template contract")
      })

      const [, outputExtension] = templateFile.name.split(".")

      let inputIndex = 0
      while (
        existsSync(path.join(__dirname, "cases", name, `${inputIndex}.json`))
      ) {
        const input = JSON.parse(
          readFileSync(
            path.join(__dirname, "cases", name, `${inputIndex}.json`),
            {
              encoding: "utf8",
              flag: "r",
            }
          )
        )

        const expectedOutput = readFileSync(
          path.join(
            __dirname,
            "cases",
            name,
            `${inputIndex}.${outputExtension}`
          ),
          {
            encoding: "utf8",
            flag: "r",
          }
        )

        it(`renders correctly for inputs #${inputIndex}`, async () => {
          const result = await contract.render(input)
          expect(result).to.equal(expectedOutput)
        })

        inputIndex++
      }
    })
  })
})
