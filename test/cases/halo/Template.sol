// SPDX-License-Identifier: LGPL-3.0-only
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
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 2000 3000">\n  <def>\n    <path\n      d="M58.7687 76.7949C110.299 88.0702 154.043 62.7974 190 0.976313L110 139.54C77.1838 120.42 37.9799 109.915 -3.21719e-05 110.066L-1.0516e-05 70.0661C19.718 70.0595 39.5625 72.3317 58.7687 76.7949Z"\n      fill="#9A9EA7"\n      id="h0"\n    ></path>\n    <circle cx="100" cy="-50" r="20" fill="#9A9EA7" id="h1"></circle>\n  </def>\n  <circle cx="1000" cy="1060" r="5"></circle>\n  <g transform="translate(1000 1060)">\n'
      )
    );
    for (uint256 __i; __i < __input.rhythm.length; __i++) {
      __result = string(
        abi.encodePacked(
          __result,
          '      <g\n        style="transform: rotate(calc(',
          uint2str(__i),
          ' * 15deg)) translateY(-520px);"\n      >\n        '
        )
      );
      if (__input.rhythm[__i].halo0) {
        __result = string(abi.encodePacked(__result, '<use href="#h0"></use>'));
      }
      __result = string(abi.encodePacked(__result, "\n        "));
      if (__input.rhythm[__i].halo1) {
        __result = string(abi.encodePacked(__result, '<use href="#h1"></use>'));
      }
      __result = string(abi.encodePacked(__result, "\n      </g>\n"));
    }
    __result = string(abi.encodePacked(__result, "  </g>\n</svg>"));
  }

  function uint2str(uint256 _i) internal pure returns (string memory) {
    if (_i == 0) {
      return "0";
    }
    uint256 j = _i;
    uint256 len;
    while (j != 0) {
      len++;
      j /= 10;
    }
    bytes memory bstr = new bytes(len);
    uint256 k = len;
    while (_i != 0) {
      k = k - 1;
      uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
      bytes1 b1 = bytes1(temp);
      bstr[k] = b1;
      _i /= 10;
    }
    return string(bstr);
  }
}
