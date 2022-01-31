import { expect } from "chai";
import { ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "@ethersproject/bignumber";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { compile } from "../src/compile";
import { Contract } from "ethers";

const solc = require("solc");

describe("end-to-end test suite", () => {
  const cases = readdirSync(path.join(__dirname, "cases"), {
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  cases.forEach((name) => {
    describe(name, () => {
      const files = readdirSync(path.join(__dirname, "cases", name), {
        withFileTypes: true,
      });

      const templateFile = files.find(
        (dirent) =>
          dirent.name.startsWith("template.") && dirent.name.endsWith(".hbs")
      );

      if (!templateFile) {
        console.warn(
          `No template file found for test case cases/${name}. Skipping.`
        );
        return;
      }

      const template = readFileSync(
        path.join(__dirname, "cases", name, templateFile.name),
        {
          encoding: "utf8",
          flag: "r",
        }
      );

      let contract: Contract;

      before(async () => {
        const { templateContractSource, storage } = compile(template);

        writeFileSync(
          path.join(__dirname, "cases", name, "Template.sol"),
          templateContractSource
        );

        const solcOutput = JSON.parse(
          solc.compile(
            JSON.stringify({
              language: "Solidity",
              sources: {
                "Template.sol": {
                  content: templateContractSource,
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
        );

        const { abi } = solcOutput.contracts["Template.sol"].Template;
        const bytecode =
          solcOutput.contracts["Template.sol"].Template.evm.bytecode.object;

        console.log("Successfully compiled Template.sol to bytecode");

        const [signer] = await ethers.getSigners();
        const factory = new ethers.ContractFactory(abi, bytecode, signer);
        contract = await factory.deploy();

        console.log("Successfully deployed template contract");
      });

      const [, outputExtension] = templateFile.name.split(".");

      let inputIndex = 0;
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
        );

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
        );

        it(`renders correctly for inputs #${inputIndex}`, async () => {
          const result = await contract.render(input);
          console.log(result);
        });

        inputIndex++;
      }
    });
  });
});
