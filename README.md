# <img src="solid-mustache-logo.png" alt="logo" height="40" align="left" /> Solid Mustache

### {{mustache}} templates compiling to Solidity

- Compiles templates to Solidity libraries
- Supports the following mustache/handlebars expressions:
  - [path expressions](#template-expressions): `{{person.name}}`
  - [conditionals](#conditionals): `#if` & `#unless`
  - [iterators](#iterators): `#each`
  - [partials](#partials): `{{> partial}}`
- Uses [@handlebars/parser](https://github.com/handlebars-lang/handlebars-parser) for parsing mustache syntax

#### Content type agnostic

Mustache templates are agnostic to the content type of the template document, meaning you can use solid-mustache to generate templates for a wide variety of use cases.

#### Logic-less

The expressiveness of the template syntax is deliberately limited, forcing you to put logic elsewhere and promoting separation of concerns.

#### Automatic and manual type narrowing

Since Solidity is statically typed, the input values for the template need type definitions.
solid-mustache automatically derives types for template inputs, so you don't have to worry about this aspect.
However, it also supports optional annotations in template expressions for using more gas efficient fixed length types.
Learn more about it in section ["Input data types"](#input-data-types).

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

To compile a template file to Solidity, run:

```bash
npm run solid-mustache ./path/to/template.hbs
```

The compiled template library will be written to `./path/to/template.sol`.

### Writing templates

#### Template expressions

solid-mustache uses the mustache syntax of double curly braces for template expressions:

```
Hello {{firstName}} {{lastName}}!
```

This template compiles to a library with a `render` function taking an input argument of the following type:

```
struct __Input {
  string firstName;
  string lastName;
}
```

Template expressions can also contain path expressions, like:

```
{{planets[i].name}}
```

**Warning:** Contrarily to handlebars.js, interpolations won't be escaped automatically in solid-mustache. If necessary, this must be taken care of before passing the interpolation values to the template's render function.

#### Conditionals

For conditional rendering use `if` block expressions:

```
{{#if active}}
  ON
{{/if}}
```

For the parameter following `#if` any kind of path to a boolean value may be used, but boolean expressions are not supported.
You can however realize `else` constructs using the negated `#unless` block expression:

```
{{#unless active}}
  OFF
{{/unless}}
```

#### Iterators

The `#each` block expressions allows you to iterate array type inputs, rendering a block of content repeatedly for each item:

```
{{#each planets}}
  {{name}}
{{/each}}
```

Note that using an `#each` block spawns a new context for its content block.
Any path expression within the content block is evaluated relative to the current item of the iteratee.
So in the example above `{{name}}` is evaluated as `planets[index].name`.

#### Input data types

The compiler auto-generates a struct type for the input data argument to the template's render function.
It uses some heuristics for choosing appropriate types for struct fields:

| condition                              | example           | type chosen                                                                |
| :------------------------------------- | :---------------- | :------------------------------------------------------------------------- |
| simple output                          | `{{title}}`       | `string title;`                                                            |
| reference to field in path expression  | `{{person.name}}` | `Person person;`<br/> creates new struct: `struct Person { string name; }` |
| reference via index in path expression | `{{items[0]}}`    | `string[] items;`                                                          |
| iterator                               | `{{#each items}}` | `string[] items;`                                                          |
| conditional                            | `{{#if active}}`  | `bool active;`                                                             |

For gas cost reasons it might be preferable to use fixed length types when possible.
This can be achieved by using built-in helper syntax:

| condition                       | example                    | type chosen        |
| :------------------------------ | :------------------------- | :----------------- |
| iterator with `length` hash arg | `{{#each items length=4}}` | `string[4] title;` |
| `bytes<N>` helper               | `{{bytes8 title}}`         | `bytes8 title;`    |

Templates also support integer to string conversion, so that input fields can be marked as `uint`/`int`:

| condition        | example            | type chosen     |
| :--------------- | :----------------- | :-------------- |
| `uint<N>` helper | `{{uint number}}`  | `uint number;`  |
| `int<N>` helper  | `{{int16 number}}` | `int16 number;` |

The integer to string conversion even allows printing integers with a fixed number of decimal places, for example:

| expression                  | `myNumber` value | printed result |
| :-------------------------- | :--------------- | :------------- |
| `uint8 myNumber decimals=2` | `123`            | `1.23`         |
| `int16 myNumber decimals=3` | `-9`             | `-0.009`       |

#### Partials

Partials allow reusing templates from other templates.
Any normal template can be used as a partial.
In order to make it available, a partial must be registered under a name using the [`partials` option](#partials-option) when compiling.

You can then call the partial through the partial call syntax:

```
{{> myPartial}}
```

It's possible to execute partials on a custom context by passing a path expression to the partial call:

```
{{> myPartial myStructField}}
```

Partials are useful for splitting large templates into multiple Solidity libraries to keep each one of them within the EVM contract size limit.
This is achieved using the `extra` hash param, specifiying the name for the extra library to split out for the partial:

```
{{> myPartial extra="MyPartial" }}
```

### Configuration

solid-mustache uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration file support.
This means you can configure it using any of the following ways:

- A `"solid-mustache"` key in your package.json
- A `.solid-mustacherc` file in JSON format.
- A `.solid-mustacherc.json` file.
- A `.solid-mustacherc.js`, `.solid-mustacherc.cjs`, `solid-mustache.config.js`, or `solid-mustache.config.cjs` file that exports an object using `module.exports`.

The configuration file will be resolved starting from the location of the template file and searching up the file tree until a config file is found.

All configuration options can also be specified as CLI arguments.
CLI arguments override values from configuration files.
Config files are not read if using solid-mustache via the JavaScript API.

## Options

#### Name

Specify the name of the generated Solidity library or template.

| Default      | Config field     | CLI Override      |
| ------------ | ---------------- | ----------------- |
| `"Template"` | `name: <string>` | `--name <string>` |

#### Solidity pragma

Define the Solidity pragma for the compiled .sol file.

| Default     | Config field               | CLI Override                 |
| ----------- | -------------------------- | ---------------------------- |
| `"^0.8.6""` | `solidityPragma: <string>` | `--solidity-pragma <string>` |

#### Header

Define a custom header for the .sol file.

| Default                                     | Config field       | CLI Override        |
| ------------------------------------------- | ------------------ | ------------------- |
| `"// SPDX-License-Identifier: UNLICENSED""` | `header: <string>` | `--header <string>` |

#### Condense whitespace

Condense sequences of consecutive whitespace characters into a single space character.

| Default | Config field                 | CLI Override |
| ------- | ---------------------------- | ------------ |
| `false` | `condenseWhitespace: <bool>` | `--condense` |

#### <a name="partials-option"></a>Partials

Register [partials](https://handlebarsjs.com/guide/#partials).

When using the CLI, partials are specified as paths to the partial template files. The partials are registered under their respective file names (without extension).
By default, a glob pattern is used based on the dirname of the template file and the filename pattern `**.partial.hbs`.

When using the API, partials are specified as an object, where keys are the partial names and values are the partial template strings.

| Default | Config field                              | CLI Override        |
| ------- | ----------------------------------------- | ------------------- |
|         | `partials: { <name0>: <template0>, ... }` | `--partials <glob>` |

#### Deduplication

Extract duplicate template substrings longer than the specified threshold into constants to potentially reduce the bytecode size.

| Default | Config field             | CLI Override               |
| ------- | ------------------------ | -------------------------- |
|         | `dedupeThreshold: <int>` | `--dedupe-threshold <int>` |


#### Print Width

Specify the line length that the printer will wrap on.

| Default | Config field        | CLI Override          |
| ------- | ------------------- | --------------------- |
| `80`    | `printWidth: <int>` | `--print-width <int>` |

#### Tab Width

Specify the number of spaces per indentation-level.

| Default | Config field      | CLI Override        |
| ------- | ----------------- | ------------------- |
| `2`     | `tabWidth: <int>` | `--tab-width <int>` |

#### Tabs

Indent lines with tabs instead of spaces.

| Default | Config field      | CLI Override |
| ------- | ----------------- | ------------ |
| `false` | `useTabs: <bool>` | `--use-tabs` |

#### Quotes

Use single quotes instead of double quotes.

| Default | Config field          | CLI Override     |
| ------- | --------------------- | ---------------- |
| `false` | `singleQuote: <bool>` | `--single-quote` |

#### Bracket Spacing

Print spaces between brackets.

| Default | Config field             | CLI Override           |
| ------- | ------------------------ | ---------------------- |
| `true`  | `bracketSpacing: <bool>` | `--no-bracket-spacing` |

#### Explicit Types

Use explicit types (`uint256`) rather than aliases (`uint`).

| Default | Config field            | CLI Override          |
| ------- | ----------------------- | --------------------- |
| `true`  | `explicitTypes: <bool>` | `--no-explicit-types` |

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
