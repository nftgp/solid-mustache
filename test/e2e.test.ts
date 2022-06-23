import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import path, { dirname } from "path"

import { expect } from "chai"
import { cosmiconfigSync } from "cosmiconfig"
import { Contract } from "ethers"
import { Bytes, keccak256, toUtf8Bytes } from "ethers/lib/utils"
import { ethers } from "hardhat"
import solc from "solc"
import linker from "solc/linker"

import "@nomiclabs/hardhat-ethers"

import prettierConfig from "../.prettierrc.json"
import { compile } from "../src/compile"
import { createOptimizingParse } from "../src/optimizingParse"

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
          // This should potentially reduce the deploy cost of the contract, but leads to "Stack too deep" compiler error for some reason
          // optimizer: {
          //   enabled: true,
          //   runs: 1,
          // },
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

describe.only("end-to-end test suite", () => {
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

      const templatePath = path.join(
        __dirname,
        "cases",
        name,
        templateFile.name
      )
      const template = readFileSync(templatePath, {
        encoding: "utf8",
        flag: "r",
      })

      const partialFiles = files.filter((dirent) =>
        dirent.name.endsWith(".partial.hbs")
      )
      const partials: Record<string, string> = {}
      partialFiles.forEach((file) => {
        const [partialName] = file.name.split(".")
        const partialTemplate = readFileSync(
          path.join(__dirname, "cases", name, file.name),
          {
            encoding: "utf8",
            flag: "r",
          }
        )
        partials[partialName] = partialTemplate
      })
      if (partialFiles.length > 0) {
        console.log(
          `Registering ${
            partialFiles.length
          } partials for cases/${name}: ${Object.keys(partials).join(", ")}`
        )
      }

      const configFile = cosmiconfigSync("solid-mustache").search(
        dirname(templatePath)
      )

      let contract: Contract

      before(async () => {
        const contractSource = compile(template, {
          contract: true,
          partials,
          parse: createOptimizingParse(configFile?.config),
          ...prettierConfig,
        })

        writeFileSync(
          path.join(__dirname, "cases", name, "Template.sol"),
          contractSource
        )

        // contractSource = readFileSync(
        //   path.join(__dirname, "cases", name, "Template.sol"),
        //   { encoding: "utf-8" }
        // )

        const solcOutput = solCompile(contractSource)

        if (!solcOutput.contracts || solcOutput.errors) {
          console.error("Solc failed")
          console.log(solcOutput)
          return
        }
        console.log("Successfully compiled Template.sol to bytecode")

        const [signer] = await ethers.getSigners()
        const MAX_CONTRACT_SIZE = 24

        const { Template, ...compiledPartials } =
          solcOutput.contracts["Template.sol"]
        // console.log(Template)
        const { abi } = Template
        let templateBytecode = Template.evm.bytecode.object

        const partialEntries = Object.entries(compiledPartials)
        const links = {} as Record<string, string>
        for (let i = 0; i < partialEntries.length; i++) {
          const [name, Partial] = partialEntries[i] as [string, any]
          const { abi, evm } = Partial
          const factory = new ethers.ContractFactory(
            abi,
            evm.bytecode.object,
            signer
          )

          const size = computeBytecodeSizeInKiB(evm.bytecode.object)
          console.log(
            `${name} bytecode size: ${Math.round(size)} KiB, ${Math.round(
              (100 * size) / MAX_CONTRACT_SIZE
            )}% of limit`
          )

          const gas = await ethers.provider.estimateGas(
            factory.getDeployTransaction()
          )
          contract = await factory.deploy()
          console.log(
            `Successfully deployed ${name} to ${contract.address} (gas: ${gas})`
          )
          const key = keccak256(toUtf8Bytes(`Template.sol:${name}`)).substring(
            2,
            36
          )
          links[`$${key}$`] = contract.address
        }

        if (partialEntries.length > 0) {
          templateBytecode = linker.linkBytecode(templateBytecode, links)
          console.log(`Successfully linked ${partialEntries.length} libraries`)
        }

        const size = computeBytecodeSizeInKiB(templateBytecode)
        console.log(
          `Template bytecode size: ${Math.round(size)} KiB, ${Math.round(
            (100 * size) / MAX_CONTRACT_SIZE
          )}% of limit`
        )

        const factory = new ethers.ContractFactory(
          abi,
          templateBytecode,
          signer
        )

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
