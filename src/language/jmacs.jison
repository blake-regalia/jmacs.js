
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
	: VERBATIM -> {type:$VERBATIM.trim()?'verbatim':'whitespace', text:$VERBATIM, loc:@1}
	| ESCAPED_AT -> {type:'verbatim', text:'@', loc:@1}
	| inline
	| suppressed
	| suppressed_line
	| if
	| global
	| generator
	| import
	;

import
	: '@import' js -> {type:'import', target:$js}
	;

if
	: '@if' js body_section* elseif* else? '@end' -> {type:'if', if:$js, then:$3, elseifs:$4, else:$5}
	;

elseif
	: '@else-if' js body_section* -> {type:'else-if', if:$js, then:$3}
	;

else
	: '@else' body_section* -> $2
	;

global
	: '@global' js -> {type:'global', def:$js}
	;

inline
	: '@{' js '}' -> {type:'inline', expr:$js}
	;

suppressed
	: '@.{' js '}' -> {type:'meta', meta:$js, line:false}
	;

suppressed_line
	: '@.' js -> {type:'meta', meta:$js, line:true}
	;

def
	: '@def' js body_section* '@end' -> {type:'macro', head:$js, body:$3}
	;

def_cram
	: '@def-cram' js body_section* '@end' -> {type:'macro', head:$js, body:$3, cram:true}
	;

generator
	: '@*{' js '}' -> {type:'generator', expr:$js}
	;

js
	: jm -> {code:$jm.join(''), loc: @1}
	;

jm
	: JM+
	;
