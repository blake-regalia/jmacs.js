
%{
	const ast = require('./ast');

	// copy abstract syntax tree constructors onto global scope object
	Object.assign(global, ast);

	const indent = s => /^(\s*)\S/.exec(s)[1];
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
	: '@import' js INDENT -> {type:'import', target:$js}
	;

if
	: '@if' js INDENT body_section* elseif* else? '@end' -> {type:'if', if:$js, then:$4, elseifs:$5, else:$6, before:indent($1), indent:$INDENT}
	;

elseif
	: '@else-if' js INDENT body_section* -> {type:'else-if', if:$js, then:$4, indent:$INDENT}
	;

else
	: '@else' body_section* -> $2
	;

global
	: '@global' js INDENT -> {type:'global', def:$js}
	;

inline
	: '@{' js '}' -> {type:'inline', expr:$js, before:indent($1)}
	;

suppressed
	: '@.{' js '}' -> {type:'meta', meta:$js, line:false}
	;

suppressed_line
	: '@.' js -> {type:'meta', meta:$js, line:true}
	;

def
	: '@def' js INDENT body_section* '@end' -> {type:'macro', head:$js, body:$4, indent:$INDENT, before:indent($1)}
	;

def_cram
	: '@def-cram' js INDENT body_section* '@end' -> {type:'macro', head:$js, body:$4, cram:true}
	;

generator
	: '@*{' js '}' -> {type:'generator', expr:$js, before:indent($1)}
	;

js
	: jm -> {code:$jm.join(''), loc: @1}
	;

jm
	: JM+
	;
