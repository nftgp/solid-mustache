import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"

import { expect } from "chai"
import { Contract } from "ethers"
import { ethers } from "hardhat"

import "@nomiclabs/hardhat-ethers"

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
        const contractSource = compile(template)

        writeFileSync(
          path.join(__dirname, "cases", name, "Template.sol"),
          contractSource
        )

        const solcOutput = solCompile(contractSource)

        if (!solcOutput.contracts) {
          console.error("Solc failed")
          console.error(solcOutput)
          return
        }

        const { abi } = solcOutput.contracts["Template.sol"].Template
        const bytecode =
          solcOutput.contracts["Template.sol"].Template.evm.bytecode.object

        console.log("Successfully compiled Template.sol to bytecode")

        const [signer] = await ethers.getSigners()
        const factory = new ethers.ContractFactory(abi, bytecode, signer)
        const deploymentData = factory.interface.encodeDeploy()
        const gas = await ethers.provider.estimateGas({ data: deploymentData })
        contract = await factory.deploy()

        console.log(
          `Successfully deployed template contract (gas cost: ${gas})`
        )
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
          const gas = await contract.estimateGas.render(input)
          const result = await contract.render(input)
          console.log(`Gas for rendering input #${inputIndex}: ${gas}`)
          expect(result).to.equal(expectedOutput)
        })

        inputIndex++
      }
    })
  })
})
