// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.6;

contract Template {
  struct __Input {
    string starsSeed;
    Planet[] planets;
  }

  struct Planet {
    string x;
    string y;
  }

  function render(__Input memory __input)
    public
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<svg\n  xmlns="http://www.w3.org/2000/svg"\n  version="1.1"\n  viewBox="0 0 2000 3000"\n  style="background: #112211;"\n>\n  <style type="text/css">\n    .bc{fill:none;stroke:#8BA0A5;}\n  </style>\n  <g>\n    <filter id="stars">\n      <feTurbulence baseFrequency="0.1" seed="',
        __input.starsSeed,
        '"></feTurbulence>\n      <feColorMatrix\n        values="0 0 0 7 -4  0 0 0 7 -4  0 0 0 7 -4  0 0 0 0 1"\n      ></feColorMatrix>\n    </filter>\n    <clipPath id="starsclip">\n      <circle cx="1000" cy="1060" r="520"></circle>\n    </clipPath>\n    <mask id="starsmask">\n      <g filter="url(#stars)" transform="scale(2)">\n        <rect width="100%" height="100%"></rect>\n      </g>\n    </mask>\n    <rect\n      width="100%"\n      height="100%"\n      fill="white"\n      mask="url(#starsmask)"\n      clip-path="url(#starsclip)"\n    ></rect>\n    <circle class="bc" cx="1000" cy="1060" r="260"></circle>\n    <circle class="bc" cx="1000" cy="1060" r="360"></circle>\n    <circle class="bc" cx="1000" cy="1060" r="440"></circle>\n    <circle class="bc" cx="1000" cy="1060" r="520"></circle>\n    <line class="bc" x1="740" y1="610" x2="1260" y2="1510"></line>\n    <line class="bc" x1="1260" y1="610" x2="740" y2="1510"></line>\n    <line class="bc" x1="1450" y1="800" x2="550" y2="1320"></line>\n    <line class="bc" x1="1450" y1="1320" x2="550" y2="800"></line>\n    <g transform="translate(1000 1060)">\n'
      )
    );
    for (uint256 __i; __i < __input.planets.length; __i++) {
      __result = string(
        abi.encodePacked(
          __result,
          '        <circle cx="',
          __input.planets[__i].x,
          '" cy="',
          __input.planets[__i].y,
          '" r="13" fill="white"></circle>\n'
        )
      );
    }
    __result = string(abi.encodePacked(__result, "    </g>\n  </g>\n</svg>"));
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
