# jmacs.js 😉
[![Build Status via Travis CI](https://travis-ci.org/blake-regalia/jmacs.js.png?branch=master)](https://travis-ci.org/blake-regalia/jmacs.js)
[![NPM version](https://img.shields.io/npm/v/jmacs.svg)](https://www.npmjs.com/package/jmacs)
[![Dependency Status](https://david-dm.org/blake-regalia/jmacs.js.svg)](https://david-dm.org/blake-regalia/jmacs.js)
[![dependencies Status](https://david-dm.org/blake-regalia/jmacs.js/dev-status.svg)](https://david-dm.org/blake-regalia/jmacs.js?type=dev)

This macro preprocessor lets you write *'meta-code'*, inline with your ordinary code. The *meta-code* gets run in its own JavaScript vm context as it generates your desired output script by building strings. You can do anything in this meta-environment just as you would in a node.js environment, including `require`'ing libraries and using any nifty ES feature like generators, async/await, etc.

## Install
`npm install --save-dev jmacs`

## Features
 - **WYCIWYG** -- What you code is what you get. Programmatically generate any file you like with this preprocessor. Just add the `.jmacs` extension onto the end of your desired output file name: e.g., `index.js.jmacs`, `.eslintrc.yaml.jmacs`, `graph.dot.jmacs`
 - **Linting** -- Yep! You can simultaneously lint your meta-code *and* the output script all at once. Just `npm i -D eslint-plugin-jmacs` and then extend `plugin:jmacs/all` in your .eslintrc 
 - **Syntax Highlighting** (for Sublime) -- Visual cues are important! Included is a .sublime-syntax file that extends the awesome [Ecmascript-Sublime](https://github.com/bathos/Ecmascript-Sublime) syntax. Right now it only supports `.js.jmacs` files. I'll work on getting this published on Package Control but in the meantime just `npm i -g jmacs` and then `ln -s $(npm config get prefix)/lib/node_modules/jmacs/src/syntax ${PATH_TO_SUBLIME_PACKAGES}/User/jmacs`.

![Syntax Highlighting Showcase](https://github.com/blake-regalia/jmacs.js/raw/master/docs/syntax-eg.png)

## Quick overview
There are a few ways to enter this meta-environment:
 - `@.` -- the **'one-liner'** syntax will evaluate everything after this token up to the end-of-line in the meta-environment
 - `@$` -- the **'global-var'** syntax will define/mutate a global variable in the meta-environment (useful inside macros & functions)
 - `@{...}` -- the **'interpolation'** syntax evaluates the `...` code as an expression and injects the result (coerced to a string) into the output script
 - `@*{...}` -- the **'generator'** syntax evaluates the `...` code as the body of a generator function, expands it until all of its yields have been iterated, and then concatenates the results to the output script
 - `@.{...}` -- the **'quiet-block'** syntax will evaluate everything inside `...` without injecting anything into the output script
 - `@if` (or `@-`), `@else-if` (or `@+`), and `@else` (or `@:`) -- the **'conditional'** syntax can be used to safely test conditions in the meta-environment and then inject the verbatim of their contents into the output script
 - `@> macro_name(args)` -- the **'macro-def'** syntax creates a simple `function` in the meta-environment that will return the contents verbatim of its macro body
 - `@import` (or `@^`) -- takes another `.jmacs` file and prepends its contents to this file before execution

## Example
Input source code file `example.js.jmacs`:
```js
@// one-liner meta code
@. let s_who = 'world';

@// declare a macro function
@> say(...a_args)
    // this is verbatim
    console.log('i say: "@{a_args.join(' ')}!"');
@;

module.exports = function() {
    @{say('hello', s_who)}
};
```

Output source code file `example.js`:
```js
module.exports = function() {
    // this is verbatim
    console.log('hello world!');
};
```

## CLI
```bash
$ jmacs --help
jmacs [OPTIONS] FILE

Options:
  -g, --config   pass a JSON-like JavaScript object to insert global vars at the top  [string]
  -m, --meta     return the meta script instead of the output code                    [boolean]
  -h, --help     Show help                                                            [boolean]
  -v, --version  Show version number                                                  [boolean]
```

## Syntax
<!-- # TODO: THIS
For Sublime Text 3, you can install the `jmacs`
-->
> This language makes use of the `@` character to denote lines and blocks of meta-code. To avoid confusion with the decorator syntax, it is preferred to use the shorthand version of each directive (e.g., using `@-` instead of `@if`, `@+` instead of `@else-if`, and so on). To produce a literal `@` character in the output script, escaping is done with two characters in sequence: `@@`.


----
## API

### `@.` -- silent one-liner
Do something in the meta-scope without injecting anything into the output script. Most commonly used to declare scoped variables.

Input:
```js
@.let builtins = ['Array', 'String'];
```

Output (empty)
```js
```

It can also be useful if you intend to [build your jmacs file with a config](#cli) to let eslint know in the meta-environment that you have some globals defined like so:

```js
@./* global FORMAT, EXTENSION */

@- FORMAT
    ...
@;
```

### `@{` -- open interpolated meta-block

Input:
```js
@.let a_builtins = ['Array', 'String'];
@{a_builtins.reduce((s_out, s_in) => s_out + `${s_in}.prototype.lengthSquared = `, `function() {
    return this.length * this.length;
};`)}
```

Output:
```js
Array.prototype.lengthSquared = String.prototype.lengthSquared = function() {
    return this.length * this.length;
};
```

### `@*{` -- open generator meta-block

Input:
```js
@.let a_builtins = ['Array', 'String'];
@*{
    for(let s_in of a_builtins) {
        yield `@{s_in}.prototype.lengthSquared = `;
    }
} function() {
    return this.length * this.length;
}
```

Output:
```js
Array.prototype.lengthSquared = String.prototype.lengthSquared = function() {
    return this.length * this.length;
};
```

### `@.{` -- open silent meta-block
Same as the one-liner except for multiple lines.
```
@.{
    let a = 3;
    let b = Math.sqrt(a) * Math.sqrt(2);
}
```

### `}` -- close meta-block

### `@-` / `@if` -- open a conditional verbatim-section
### `@+` / `@else-if`
### `@:` / `@else`
This keyword can be used to safely test for variables, even if they have not been defined. This is useful when you intend to pass configs form the command line using the `-g` option.
```
@.const DECLARED_FALSE = false;
@- NEVER_DECLARED
    // not inserted
@+ DECLARED_FALSE
    // not inserted either
@:
    // this is inserted
@;
```

### `@;` / `@end` -- close innermost verbatim-section
Use this token to denote the end of a verbatim section, i.e., after a conditional (if/else-if/else) or macro definition.

### `@>` -- define a macro
`jmacs` simply interpets the text following this token as a function declaration (i.e., everything before the opening brace). You can safely include function declaration features supported by the current version of your node environment, e.g., default assignments, destructuring, rest params, etc.
```
@> memoize(s_name, s_load)
	get @{s_name}() {
	    delete this.@{s_name};
	    return (this.@{s_name} = @{s_load});
	}
@;

@> describe({
    fruit,
    color,
    taste='good',
}, ...extras)
        `a @{color} ${@{fruit}} tastes @{taste}; @{JSON.stringify(extras)}`
@;
```

### `@>>` -- define a macro but remove all whitespace
A great use for macros is to construct regular expressions. This token makes it easy to spread out the contents of your regex for readability as well as to reuse frequent sub-patterns by building them with macros.

![Syntax Highlighting Showcase](https://github.com/blake-regalia/jmacs.js/raw/master/docs/regex-eg.png)

> The `@//@regex` is a type of syntax directive that hints to the syntax highlighter how it should interpret this section of verbatim code.

### `@^` / `@import` -- take the contents of another file and insert it into this spot
Evaluates the text following this token as an expression, so you can use any variables in the meta-environment, template literals, etc.
```js
@import 'common-macros.jmacs'
@import 'constants.js'
@import `${script}.jmacs`


```
