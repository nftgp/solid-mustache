// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract Template {
  struct __Input {
    ;
  }

  function render(__Input memory __input)
    public
    pure
    returns (string memory __result)
  {
    __result = string(
      abi.encodePacked(
        __result,
        '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 3000">\n  <style type="text/css">\n    .bc{fill:none;stroke:#8BA0A5;}\n  </style>\n  <g>\n    <circle class="bs" cx="999.5" cy="1060" r="258.9"></circle>\n    <circle class="bs" cx="999.5" cy="1060" r="359.6"></circle>\n    <circle class="bs" cx="999.5" cy="1060" r="439.7"></circle>\n    <circle class="bs" cx="999.5" cy="1060" r="519.6"></circle>\n    <line class="bs" x1="740" y1="609.7" x2="1259.7" y2="1509.9"></line>\n    <line class="bs" x1="1259.9" y1="609.8" x2="739.8" y2="1509.8"></line>\n    <line class="bs" x1="1450.1" y1="800.1" x2="549.7" y2="1319.5"></line>\n    <line class="bs" x1="1449.8" y1="1320" x2="550" y2="799.6"></line>\n  </g>\n</svg>'
      )
    );
  }
}
