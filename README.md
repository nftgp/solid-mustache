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

## Options

#### Name

Specify the name of the generated Solidity library or template.

| Default      | CLI Override      | API Override     |
| ------------ | ----------------- | ---------------- |
| `"Template"` | `--name <string>` | `name: <string>` |

#### Condense whitespace

Condense sequences of consecutive whitespace characters into a single space character.

| Default | CLI Override | API Override                 |
| ------- | ------------ | ---------------------------- |
| `false` | `--condense` | `condenseWhitespace: <bool>` |

#### Partials

Register [partials](https://handlebarsjs.com/guide/#partials).

When using the CLI, partials are specified as paths to the partial template files. The partials are registered under their respective file names (without extension).

When using the API, partials are specified as an object, where keys are the partial names and values the partial template strings.

| Default | CLI Override                     | API Override                              |
| ------- | -------------------------------- | ----------------------------------------- |
|         | `--partials <path0> <path1> ...` | `partials: { <name0>: <template0>, ... }` |

#### Print Width

Specify the line length that the printer will wrap on.

| Default | CLI Override          | API Override        |
| ------- | --------------------- | ------------------- |
| `80`    | `--print-width <int>` | `printWidth: <int>` |

#### Tab Width

Specify the number of spaces per indentation-level.

| Default | CLI Override        | API Override      |
| ------- | ------------------- | ----------------- |
| `2`     | `--tab-width <int>` | `tabWidth: <int>` |

#### Tabs

Indent lines with tabs instead of spaces.

| Default | CLI Override | API Override      |
| ------- | ------------ | ----------------- |
| `false` | `--use-tabs` | `useTabs: <bool>` |

#### Quotes

Use single quotes instead of double quotes.

| Default | CLI Override     | API Override          |
| ------- | ---------------- | --------------------- |
| `false` | `--single-quote` | `singleQuote: <bool>` |

#### Bracket Spacing

Print spaces between brackets.

| Default | CLI Override           | API Override             |
| ------- | ---------------------- | ------------------------ |
| `true`  | `--no-bracket-spacing` | `bracketSpacing: <bool>` |

#### Explicit Types

Use explicit types (`uint256`) rather than aliases (`uint`).

| Default | CLI Override          | API Override            |
| ------- | --------------------- | ----------------------- |
| `true`  | `--no-explicit-types` | `explicitTypes: <bool>` |

## API

### CLI

```bash
solid-mustache <template_file> [options]
```

The compiled .sol file will be written to the directory containing the template file.
By default it will use the template's filename, but with a .sol extension.

For writing to a different path, use the `--output <path>` option.

Additionally, all general [options](#options) can be specified.

### JavaScript

```ts
compile(template: string, options?: Options): string
```

The first argument (`template`) is the template string to compile.

The optional second argument allows customizing the compile [options](#options).

## Contribute

This package aims to be compatible with [handlebars](https://handlebarsjs.com).
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
