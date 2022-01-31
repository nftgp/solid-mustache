// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract Template {
  struct Input {
    string color;
    string[] words;
  }

  // constructor() {}

  function render(Input memory input)
    public
    pure
    returns (string memory result)
  {
    result = string(abi.encodePacked(result, "test"));
    result = string(abi.encodePacked(result, input.color));
    for (uint256 i = 0; i < input.words.length; i++) {
      result = string(abi.encodePacked(result, input.words[i]));
    }
  }
}