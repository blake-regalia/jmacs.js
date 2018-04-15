
%{
	const ast = require('./ast');

	// copy abstract syntax tree constructors onto global scope object
	Object.assign(global, ast);
%}


%start grammar

/* enable EBNF grammar syntax */
%ebnf

%%
/* ------------------------ */
/* language grammar */
/* ------------------------ */

grammar
	: section* EOF
		{ return Program($1) }
	;

section
	: body_section
	| def
	| def_cram
	;

body_section
	: VERBATIM -> Verbatim($VERBATIM)
	| ESCAPED_AT -> Verbatim('@')
	| inline
	| suppressed
	| suppressed_line
	| if
	| global
	| generator
	| import
	;

import
	: '@import' js -> Import($js)
	;

if
	: '@if' js body_section* elseif* else? '@end' -> If($js, $3, $4, $5)
	;

elseif
	: '@else-if' js body_section* -> Elseif($js, $3)
	;

else
	: '@else' body_section* -> $2
	;

global
	: '@global' js -> Global($js)
	;

inline
	: '@{' js '}' -> Inline($js)
	;

suppressed
	: '@.{' js '}' -> Inline($js, true)
	;

suppressed_line
	: '@.' js -> Inline($js, true)
	;

def
	: '@def' js body_section* '@end' -> Macro($js, $3)
	;

def_cram
	: '@def-cram' js body_section* '@end' -> Macro($js, $3, true)
	;

generator
	: '@*{' js '}' -> Generator($js)
	;

js
	: jm -> $jm.join('')
	;

jm
	: JM+
	;
