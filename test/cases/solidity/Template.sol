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
  {__result = string(abi.encodePacked(__result, "// SPDX-License-Identifier: LGPL-3.0-only\npragma solidity ^0.8.6;\n\n\ncontract "));
__result = string(abi.encodePacked(__result, __input.name));
__result = string(abi.encodePacked(__result, " {\n    \n    constructor() {}\n\n    function render() public pure {\n\n    }\n\n}\n"));}
}