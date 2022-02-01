// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract Template {
  struct Input {
    string color;
    string[] words;
  }

  function render(Input memory __input)
    public
    pure
    returns (string memory __result)
  {__result = string(abi.encodePacked(__result, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\">\n  <line\n    x1=\"0\"\n    y1=\"0\"\n    x2=\"200\"\n    y2=\"200\"\n    stroke=\""));
__result = string(abi.encodePacked(__result, __input.color));
__result = string(abi.encodePacked(__result, "\"\n    stroke-width=\"8\"\n  ></line>\n"));
for(uint256 __index_0; __index_0 < __input.words.length; __index_0++) {
__result = string(abi.encodePacked(__result, "    <text x=\"20\" y=\"20\">"));
__result = string(abi.encodePacked(__result, __input.words[__index_0]));
__result = string(abi.encodePacked(__result, "</text>\n"));
}
__result = string(abi.encodePacked(__result, "</svg>"));}
}