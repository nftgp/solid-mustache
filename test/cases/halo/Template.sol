// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;

contract Template {
  struct __Input {
    Rhythm[] rhythm;
  }

  struct Rhythm {
    bool halo0;
    bool halo1;
  }

  function render(__Input memory __input)
    public
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 2000 3000">\n  <defs>\n    <path\n      d="M58.7687 76.7949C110.299 88.0702 154.043 62.7974 190 0.976313L110 139.54C77.1838 120.42 37.9799 109.915 -3.21719e-05 110.066L-1.0516e-05 70.0661C19.718 70.0595 39.5625 72.3317 58.7687 76.7949Z"\n      fill="#9A9EA7"\n      id="h0"\n    ></path>\n    <circle cx="100" cy="-50" r="20" fill="#9A9EA7" id="h1"></circle>\n  </defs>\n  <circle cx="1000" cy="1060" r="5"></circle>\n  <g transform="translate(1000 1060)">\n'
      )
    );
    for (uint256 __i; __i < __input.rhythm.length; __i++) {
      __result = string(
        abi.encodePacked(
          __result,
          '      <g\n        style="transform: rotate(calc(',
          SolidMustacheHelpers.uintToString(__i, 0),
          ' * 15deg)) translateY(-520px);"\n      >\n        ',
          __input.rhythm[__i].halo0 ? '<use href="#h0"></use>' : "",
          "\n        ",
          __input.rhythm[__i].halo1 ? '<use href="#h1"></use>' : "",
          "\n      </g>\n"
        )
      );
    }
    __result = string(abi.encodePacked(__result, "  </g>\n</svg>"));
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
