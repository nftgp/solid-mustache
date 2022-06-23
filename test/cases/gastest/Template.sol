// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;

string constant __constant0 = '>\n  <rect class="c" x="100" y="1000" width="100" height="10" rx="4"></rect';

contract Template {
  struct __Input {
    string title;
  }

  function render(__Input memory __input)
    public
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 2000 3000"',
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        __constant0,
        ">\n  ",
        __input.title,
        "\n</svg>"
      )
    );
  }

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
