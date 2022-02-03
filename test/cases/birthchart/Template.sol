// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract Template {
    struct Planet {
        string x;
        string y;
    }

    struct __Input {
        Planet[] planets;
    }

    function render(__Input memory __input)
        public
        pure
        returns (string memory __result)
    {
        __result = string(
            abi.encodePacked(
                __result,
                '<svg\n  version="1.1"\n  xmlns="http://www.w3.org/2000/svg"\n  viewBox="0 0 2000 3000"\n  style="background: black;"\n>\n  <style type="text/css">\n    .bc{fill:none;stroke:#8BA0A5;}\n  </style>\n  <g>\n    <circle class="bc" cx="1000" cy="1060" r="260"></circle>\n    <circle class="bc" cx="1000" cy="1060" r="360"></circle>\n    <circle class="bc" cx="1000" cy="1060" r="440"></circle>\n    <circle class="bc" cx="1000" cy="1060" r="520"></circle>\n    <line class="bc" x1="740" y1="610" x2="1260" y2="1510"></line>\n    <line class="bc" x1="1260" y1="610" x2="740" y2="1510"></line>\n    <line class="bc" x1="1450" y1="800" x2="550" y2="1320"></line>\n    <line class="bc" x1="1450" y1="1320" x2="550" y2="800"></line>\n    <g transform="translate(1000 1060)">\n'
            )
        );
        for (uint256 __i; __i < __input.planets.length; __i++) {
            __result = string(
                abi.encodePacked(__result, '        <circle\n          cx="')
            );
            __result = string(
                abi.encodePacked(__result, __input.planets[__i].x)
            );
            __result = string(abi.encodePacked(__result, '"\n          cy="'));
            __result = string(
                abi.encodePacked(__result, __input.planets[__i].y)
            );
            __result = string(
                abi.encodePacked(
                    __result,
                    '"\n          r="6.5"\n          fill="white"\n        ></circle>\n'
                )
            );
        }
        __result = string(
            abi.encodePacked(__result, "    </g>\n  </g>\n</svg>")
        );
    }
}
