// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract Template {
  struct __Input {
    string color;
    string[] words;
    bool showCircle;
  }

  function render(__Input memory __input)
    public
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">\n  <line\n    x1="0"\n    y1="0"\n    x2="200"\n    y2="200"\n    stroke="',
        __input.color,
        '"\n    stroke-width="8"\n  ></line>\n'
      )
    );
    for (uint256 __i; __i < __input.words.length; __i++) {
      __result = string(
        abi.encodePacked(
          __result,
          '    <text x="20" y="20">',
          __input.words[__i],
          "</text>\n"
        )
      );
    }
    __result = string(abi.encodePacked(__result, ""));
    if (__input.showCircle) {
      __result = string(
        abi.encodePacked(
          __result,
          '    <circle cx="100" cy="100" r="10"></circle>\n'
        )
      );
    }
    __result = string(abi.encodePacked(__result, "</svg>"));
  }
}
