# <img src="solid-mustache-logo.png" alt="logo" height="40" align="left" /> Solid Mustache

{{mustache}} templates compiling to Solidity

- Compiles templates to Solidity libraries
- Supports the following mustache/handlebars expressions:
  - [path expressions](#template-expressions): `{{person.name}}`
  - [conditionals](#conditionals): `if` & `unless`
  - [iterators](#iterators): `each`
  - [partials](#partials): `{{> partial}}`
- Uses [@handlebars/parser](https://github.com/handlebars-lang/handlebars-parser) for parsing mustache syntax

#### Content type agnostic

Mustache templates are agnostic to the content type of the template document, meaning you can use solid-mustache to generate templates for a wide variety of use cases.

#### Logic-less

The expressiveness of the template syntax is deliberately limited, forcing you to put logic elsewhere and promoting a separation of concerns.

#### Automatic and manual type narrowing

Since Solidity is statically typed, the input values for the template need type definitions.
solid-mustache automatically derives types for templates, so you don't have to worry about this aspect.
However, it does allow optional annotations of template expressions for using more gas efficient fixed length types.
Learn more about it in section ["Input data types"](#input-data-types).

## How to use

### Template expressions

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

### Conditionals

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

### Iterators

The `#each` block expressions allows you to iterate array type inputs, rendering a block of content repeatedly for each item:

```
{{#each planets}}
  {{name}}
{{/each}}
```

Note that using an `#each` block spawns a new context for its content block.
Any path expression within the content block is evaluated relative to the current item of the iteratee.
So in the example above `{{name}}` is evaluated as `planets[index].name`.

### Input data types

The compiler auto-generates a struct type for the input data argument to the template's render function.
It uses some heuristics for choosing appropriate types for struct fields:

| condition                              | example           | type chosen                                     |
| -------------------------------------- | ----------------- | ----------------------------------------------- |
| simple output                          | `{{title}}`       | `string title;`                                 |
| reference to field in path expression  | `{{person.name}}` | `Person person;` (creates new struct: `Person`) |
| reference via index in path expression | `{{items[0]}}`    | `string[] items;`                               |
| iterator                               | `{{#each items}}` | `string[] items;`                               |
| conditional                            | `{{#if active}}`  | `bool active;`                                  |

Out of gas cost considerations it might be preferable to use fixed length types when possible.
This can be achieved by using built-in helper syntax:

| condition                       | example                    | type chosen        |
| ------------------------------- | -------------------------- | ------------------ |
| iterator with `length` hash arg | `{{#each items length=4}}` | `string[4] title;` |
| `bytes<N>` helper               | `{{bytes8 title}}`         | `bytes8 title;`    |

Templates also support integer to string conversion, so that input fields can be marked as `uint`/`int`:

| condition        | example            | type chosen     |
| ---------------- | ------------------ | --------------- |
| `uint<N>` helper | `{{uint number}}`  | `uint number;`  |
| `int<N>` helper  | `{{int16 number}}` | `int16 number;` |

### Partials

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

#### <a name="partials-option"></a>Partials

Register [partials](https://handlebarsjs.com/guide/#partials).

When using the CLI, partials are specified as paths to the partial template files. The partials are registered under their respective file names (without extension).
By default, a glob pattern is used based on the dirname of the template file and the filename pattern `**.partial.hbs`.

When using the API, partials are specified as an object, where keys are the partial names and values are the partial template strings.

| Default | CLI Override        | API Override                              |
| ------- | ------------------- | ----------------------------------------- |
|         | `--partials <glob>` | `partials: { <name0>: <template0>, ... }` |

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
