// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;
import "@rari-capital/solmate/src/utils/SSTORE2.sol";

contract Template {
  struct __Input {
    Color color;
    string[] words;
  }

  struct Color {
    string color;
  }

  address private pointer;

  constructor(string memory chunks) {
    pointer = SSTORE2.write(bytes(chunks));
  }

  function render(Input memory input)
    public
    view
    returns (string memory result)
  {
    result = string(SSTORE2.read(pointer, 0, 32));
    result = string(abi.encodePacked(result, "test"));
    result = string(abi.encodePacked(result, input.color));
    for (uint256 i = 0; i < input.words.length; i++) {
      result = string(abi.encodePacked(result, input.words[i]));
    }
  }
}
