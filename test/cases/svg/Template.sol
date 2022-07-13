// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;

contract Template {
  struct __Input {
    bool showCircle;
    string color;
    string[] words;
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
    __result = string(
      abi.encodePacked(
        __result,
        '    <line\n      x1="0"\n      y1="0"\n      x2="200"\n      y2="200"\n      stroke="',
        __input.color,
        '"\n      stroke-width="4"\n    ></line>\n'
      )
    );
    for (uint256 __i; __i < __input.words.length; __i++) {
      __result = string(
        abi.encodePacked(
          __result,
          '    <text x="20" y="20">',
          __input.words[__i],
          '</text>\n    <text x="100" y="20" fill="',
          __input.color,
          '">',
          __input.words[__i],
          "</text>\n\n",
          text(__input.words[__i]),
          text(__input.color)
        )
      );
    }
    __result = string(
      abi.encodePacked(
        __result,
        __input.showCircle ? '    <circle cx="100" cy="100" r="10" />\n' : "",
        !__input.showCircle
          ? '    <rect x1="100" y1="100" x2="110" y2="110" />\n'
          : "",
        "\n</svg>"
      )
    );
  }

  function textsub(string memory __input)
    internal
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<text x="300" y="300">sub: ',
        __input,
        "</text>"
      )
    );
  }

  function text(string memory __input)
    internal
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<text x="200" y="200">',
        __input,
        "</text>\n",
        textsub(__input)
      )
    );
  }
}

library SolidMustacheHelpers {
  function intToString(int256 i, uint256 decimals)
    internal
    pure
    returns (string memory)
  {
    if (i >= 0) {
      return uintToString(uint256(i), decimals);
    }
    return string(abi.encodePacked("-", uintToString(uint256(-i), decimals)));
  }

  function uintToString(uint256 i, uint256 decimals)
    internal
    pure
    returns (string memory)
  {
    if (i == 0) {
      return "0";
    }
    uint256 j = i;
    uint256 len;
    while (j != 0) {
      len++;
      j /= 10;
    }
    uint256 strLen = decimals >= len
      ? decimals + 2
      : (decimals > 0 ? len + 1 : len);

    bytes memory bstr = new bytes(strLen);
    uint256 k = strLen;
    while (k > 0) {
      k -= 1;
      uint8 temp = (48 + uint8(i - (i / 10) * 10));
      i /= 10;
      bstr[k] = bytes1(temp);
      if (decimals > 0 && strLen - k == decimals) {
        k -= 1;
        bstr[k] = ".";
      }
    }
    return string(bstr);
  }
}
