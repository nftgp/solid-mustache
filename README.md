# Solid Mustache

{{mustache}} templates that compile to Solidity.

- Uses [@handlebars/parser](https://github.com/handlebars-lang/handlebars-parser) for parsing mustache syntax.
- Compiles templates to Solidity contracts.
- Supports the following mustache/handlebars expressions:
  - [path expressions](https://handlebarsjs.com/guide/expressions.html#path-expressions)
  - iterators: `each`
  - conditionals: `if` & `unless`
  - [partials](https://handlebarsjs.com/guide/partials.html#basic-partials)

## How to use

### Installation

Add solid-mustache as a dev dependency. With npm:

```bash
npm install --save-dev solid-mustache
```

Or with yarn:

```bash
yarn add -D solid-mustache
```

### Compile template file

To compile a template file to Solidity

## API

### CLI

### JavaScript

## Contribute

This package aims to be compatible with [handlebars](https://handlebarsjs.com)..
Specifically, every template that can be compiled with solid-mustache shall also be supported in handlebars.
The inverse is not necessary, but we aim for it as far as it's reasonable.
If you see unexpected rendering results for your templates, submit an issue or, even better, create a PR adding your template as new test case in [test/cases](./test/cases).

### How test cases are structured

Each test case is represented by a folder, the folder name is the test case name.
In the folder there is a single template file. The file name must start with `template` and end with `.hbs`, e.g.: `template.svg.hbs`.

The folder also contains one or more json files with different test inputs.
These json files must be named with incrementing index starting at `0`: `0.json`, `1.json`, `2.json`, ...

When running the tests, the template will be rendered for each input json and the result snapshot is written to a new file in that same folder.
For example, the `template.svg.hbs` with input `0.json` is written to `0.svg`.

To update result snapshots, run `yarn test:update`.
