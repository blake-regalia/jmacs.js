# jmacs.js 😉
[![Build Status via Travis CI](https://travis-ci.org/blake-regalia/jmacs.js.png?branch=master)](https://travis-ci.org/blake-regalia/jmacs.js)
[![NPM version](https://img.shields.io/npm/v/jmacs.svg)](https://www.npmjs.com/package/jmacs)
[![Dependency Status](https://david-dm.org/blake-regalia/jmacs.js.svg)](https://david-dm.org/blake-regalia/jmacs.js)
[![dependencies Status](https://david-dm.org/blake-regalia/jmacs.js/dev-status.svg)](https://david-dm.org/blake-regalia/jmacs.js?type=dev)

Simple and elegant macros for JavaScript that function much closer to the macros in C than the *common alternative* JavaScript macro library.

## Install
`npm install --save-dev jmacs`

## Syntax
The syntax for this language was inspired by [Builder](https://github.com/electricimp/Builder). The **jmacs** library aims to improve upon the shortcomings of Builder by formally defining the underlying grammar using [Jison](https://github.com/zaach/jison), along with some complementary features.

----
## API


### @def
Defines a new macro with the identifier given by `name` which accepts the given `arguments` and evaluates the given `body`.
```
@def <name>(<arguments>)
	<body>
@end
```

*Example:*
 - `input/example.js`
	```
	@def comment(str)
	    // @{str}
	@end

	@def greet(who='world')
	    @{comment('say hello to '+who)}
		console.log('hello, @{who}!');
	@end
	
	@{greet()}
	@{greet('you')}
	```

 - `output/example.js`
	```
	// say hello to world
	console.log('hello, world!');
	// say hello to you
	console.log('hello, you!');
	```


### @set
Assign the given `value` to the given `variable` in the current scope, unless a variable with the same identifer already exists in some outer scope (in which case the variable is overwritten).

*Example:*
 - `input/example.js`
	 ```
	 @set color '"red"'
	 
	 @def mutate()
		@set color '0x00ff00'
	 @end
	 
	 brick.setColor(@{color});
	 @{mutate()}
	 brick.setColor(@{color});
	 ```

 - `output/example.js`
	 ```
	 brick.setColor("red");
	 brick.setColor(0x00ff00);
	 ```

### @if  /  @elseif  /  @else
```
@if
	<if-then>
@elseif
	<elseif-then>
@else
	<else-then>
@end
```

*Example:*
 - `input/example.js`
	```
	@def num(word)
		@if word == 'one'
			1
		@elseif word == 'two'
			2
		@else
			0
		@end
	@end
	
	@{num('one')} + @{num('two'} + @{num('?')};
	```

 - `output/example.js`
	```
	1 + 2 + 0;
	```

### Operators
The following binary operators perform their equivalent evaluation in JavaScript:
`+ - * / % < > <= >= == != && || >>> >> << & |`
> This includes, string concatenation, addition, subtraction, multiplication, division, modulus, less/greater-than/or-equal-to, equals, strict-equals, not equals, and, or, bitwise shifting, bitwise and, bitwise or.

In addition, the negation `!` operator and the ternary `?` operators work the same as they does in JavaScript (i.e., if-then-else on truthy/falsy values):
```
@set value 'truthy'
@{value? 'yes': 'no'}  // yes
@{!value? 'yes': 'no'}  // no
```

### Math and String
Static properties and static functions on the `Math` object, and prototype functions on the `String` object in JavaScript are exposed as builtin variables/functions in jmacs.

```
@{PI}  // 3.141592653589793
@{floor(10 / 4)}  // 2
@{ceil(10 / 4)}  // 3
@{random()}  // 0.3539317091848069

@set word 'hello'
@{length(word)}  // 5
@{charAt(word, 0)}  // h
@{replace(word, 'llo', 'y')}  // hey
```

... And many more yet to be documented features
