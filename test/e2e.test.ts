import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"

import { expect } from "chai"
import { Contract } from "ethers"
import { ethers } from "hardhat"

import "@nomiclabs/hardhat-ethers"

import prettierConfig from "../.prettierrc.json"
import { compile } from "../src/compile"

// eslint-disable-next-line @typescript-eslint/no-var-requires
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
      })
    )
  )
}

describe("end-to-end test suite", () => {
  let cases = readdirSync(path.join(__dirname, "cases"), {
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.endsWith(".skip"))

  if (cases.some((name) => name.endsWith(".only"))) {
    cases = cases.filter((name) => name.endsWith(".only"))
  }

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
        const contractSource = compile(template, {
          contract: true,
          format: prettierConfig,
        })

        writeFileSync(
          path.join(__dirname, "cases", name, "Template.sol"),
          contractSource
        )

        const solcOutput = solCompile(contractSource)

        if (!solcOutput.contracts || solcOutput.errors) {
          console.error("Solc failed")
          console.error(solcOutput)
          return
        }

        const { abi } = solcOutput.contracts["Template.sol"].Template
        const bytecode =
          solcOutput.contracts["Template.sol"].Template.evm.bytecode.object

        const size = computeBytecodeSizeInKiB(bytecode)
        const MAX_CONTRACT_SIZE = 24

        console.log(
          `Successfully compiled Template.sol to bytecode (size: ${Math.round(
            size
          )} KiB, ${Math.round(size / MAX_CONTRACT_SIZE)}% of limit)`
        )

        const [signer] = await ethers.getSigners()
        const factory = new ethers.ContractFactory(abi, bytecode, signer)
        // const deploymentData = factory.interface.encodeDeploy()
        const gas = await ethers.provider.estimateGas(
          factory.getDeployTransaction()
        )
        contract = await factory.deploy()

        console.log(`Successfully deployed template contract (gas: ${gas})`)
      })

      const [, outputExtension] = templateFile.name.split(".")

      let inputIndex = 0
      while (
        existsSync(path.join(__dirname, "cases", name, `${inputIndex}.json`))
      ) {
        const currentInputIndex = inputIndex

        const input = JSON.parse(
          readFileSync(
            path.join(__dirname, "cases", name, `${inputIndex}.json`),
            {
              encoding: "utf8",
              flag: "r",
            }
          )
        )

        const outputPath = path.join(
          __dirname,
          "cases",
          name,
          `${currentInputIndex}.${outputExtension}`
        )

        it(`renders correctly for inputs #${currentInputIndex}`, async () => {
          const gas = await contract.estimateGas.render(input)
          const result = await contract.render(input)
          const percentOfBlockGasLimit = Math.round(
            (gas.toNumber() / 15000000) * 100
          )
          console.log(
            `Gas for rendering input #${currentInputIndex}: ${gas} (${percentOfBlockGasLimit}% of block gas limit)`
          )

          if (!process.env.UPDATE_SNAPSHOTS && existsSync(outputPath)) {
            const expectedOutput = readFileSync(outputPath, {
              encoding: "utf8",
              flag: "r",
            })
            expect(result).to.equal(expectedOutput)
          } else {
            writeFileSync(outputPath, result)
            console.log(`Output snapshot written to ${outputPath}`)
          }
        })

        inputIndex++
      }
    })
  })
})

function computeBytecodeSizeInKiB(bytecode: string) {
  // -2 to remove 0x from the beginning of the string
  // /2 because one byte consists of two hexadecimal values
  // /1024 to convert to size from byte to kibibytes
  return (bytecode.length - 2) / 2 / 1024
}
