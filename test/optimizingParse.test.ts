import { expect } from "chai"

import { findRepeatingSubstrings, indexOf } from "../src/optimizingParse"

describe("findRepeatingSubstrings", () => {
  it("should find repetitions in a single string", () => {
    const { substrings, chunks } = findRepeatingSubstrings(["banana"], 2)
    expect([...substrings.values()]).to.deep.equal(["an"])
    const reconstructed = chunks
      .map((chunk) =>
        typeof chunk === "symbol" ? substrings.get(chunk) : chunk
      )
      .join("")
    expect(reconstructed).to.equal("banana")
  })

  it("should respect the minimum substring length", () => {
    const { substrings, chunks } = findRepeatingSubstrings(["banana"], 3)
    expect([...substrings.values()]).to.deep.equal([])
    const reconstructed = chunks
      .map((chunk) =>
        typeof chunk === "symbol" ? substrings.get(chunk) : chunk
      )
      .join("")
    expect(reconstructed).to.equal("banana")
  })

  it("should find repetitions across multiple chunks", () => {
    const { substrings, chunks } = findRepeatingSubstrings(
      ["banana", "anna"],
      2
    )
    expect([...substrings.values()]).to.deep.equal(["an"])
    const reconstructed = chunks
      .map((chunk) =>
        typeof chunk === "symbol" ? substrings.get(chunk) : chunk
      )
      .join("")
    expect(reconstructed).to.equal("bananaanna")
  })

  it("should look for the longest repeating substring", () => {
    const { substrings, chunks } = findRepeatingSubstrings(
      ["banana", "nana"],
      2
    )
    expect([...substrings.values()]).to.deep.equal(["ana"])
    const reconstructed = chunks
      .map((chunk) =>
        typeof chunk === "symbol" ? substrings.get(chunk) : chunk
      )
      .join("")
    expect(reconstructed).to.equal("banananana")
  })

  it("should return a mapping of result chunk to original chunk indices", () => {
    const { substrings, chunks, indexMap } = findRepeatingSubstrings(
      ["banana", "anna"],
      2
    )
    console.log({ substrings, chunks, indexMap })
    expect(chunks).to.have.length(6) // [ 'b', Symbol(an), Symbol(an), 'a', Symbol(an), 'na' ]
    expect(indexMap).to.deep.equal([0, 0, 0, 0, 1, 1])
  })
})

describe("indexOf", () => {
  it("should find the index of a substring", () => {
    const chunks = ["banana", "nana"]
    const result = indexOf(chunks, "nana", 0, 0)
    expect(result?.chunk).to.equal(0)
    expect(result?.char).to.equal(2)
  })

  it("should find the index of a substring after a certain start position", () => {
    const chunks = ["banana", "nana"]
    const result = indexOf(chunks, "nana", 0, 5)
    expect(result?.chunk).to.equal(1)
    expect(result?.char).to.equal(0)
  })
})
