
%{
	const ast = require('./ast');

	// copy abstract syntax tree constructors onto global scope object
	Object.assign(global, ast);
%}


/*%right OPERATOR_ASSIGNMENT*/
%right TERNARY
%left '||'
%left '&&'
%left '===' '==' '!='
%left '<' '>' '<=' '>='
%left '+' '-'
%left '>>>' '>>' '<<'
%left '*' '/' '%'
%left '|'
%left '&'

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
	| macro
	;

include
	: '@include' expression -> Include($expression)
	;

body_section
	: VERBATIM -> Verbatim($VERBATIM.replace(/^[ \t]+/, ' ').replace(/^\n+/, '\n'))
	| if
	| set
	| let
	| inline
	| include
	| repeat
	;

if
	: '@if' expression body_section* elseif* else? '@end' -> If($expression, $3, $4, $5)
	;

elseif
	: '@elseif' expression body_section* -> Elseif($expression, $3)
	;

else
	: '@else' body_section* -> $2
	;

set
	: '@set' NAME '='? expression -> Assignment($NAME, $expression)
	;

let
	: '@let' NAME '='? expression -> Assignment($NAME, $expression)
	;

inline
	: '@{' expression '}' -> Inline($expression)
	;

repeat
	: '@repeat' expression body_section* '@end' -> Repeat($expression, $3)
	;

macro
	: '@def' NAME parameters macro_body '@end' -> Macro($NAME, $parameters, $macro_body)
	;

parameters
	: '(' (parameter ',')* parameter? ')' -> push($2, $3)
	;

parameter
	: NAME defaults? -> Parameter($NAME, $2)
	;

defaults
	: '=' terminal_value -> $2
	;

macro_body
	: body_section*
	;

unary_expression
	: value
	| '!' unary_expression -> UnaryExpr($1, $2)
	| '-' unary_expression -> UnaryExpr($1, $2)
	;

bitshift_expression
	: unary_expression
	| bitshift_expression '>>>' unary_expression -> BinaryExpr($1, $2, $3)
	| bitshift_expression '>>' unary_expression -> BinaryExpr($1, $2, $3)
	| bitshift_expression '<<' unary_expression -> BinaryExpr($1, $2, $3)
	;

bitwise_and_expression
	: bitshift_expression
	| bitwise_and_expression '&' bitshift_expression -> BinaryExpr($1, $2, $3)
	;

bitwise_or_expression
	: bitwise_and_expression
	| bitwise_or_expression '|' bitwise_and_expression -> BinaryExpr($1, $2, $3)
	;

multiplicative_expression
	: bitwise_or_expression
	| multiplicative_expression '*' bitwise_or_expression -> BinaryExpr($1, $2, $3)
	| multiplicative_expression '/' bitwise_or_expression -> BinaryExpr($1, $2, $3)
	| multiplicative_expression '%' bitwise_or_expression -> BinaryExpr($1, $2, $3)
	;

additive_expression
	: multiplicative_expression
	| additive_expression '+' multiplicative_expression -> BinaryExpr($1, $2, $3)
	| additive_expression '-' multiplicative_expression -> BinaryExpr($1, $2, $3)
	;

relational_expression
	: additive_expression
	| relational_expression '<' additive_expression -> BinaryExpr($1, $2, $3)
	| relational_expression '>' additive_expression -> BinaryExpr($1, $2, $3)
	| relational_expression '<=' additive_expression -> BinaryExpr($1, $2, $3)
	| relational_expression '>=' additive_expression -> BinaryExpr($1, $2, $3)
	;

equality_expression
	: relational_expression
	| equality_expression '===' relational_expression -> BinaryExpr($1, $2, $3)
	| equality_expression '==' relational_expression -> BinaryExpr($1, $2, $3)
	| equality_expression '!=' relational_expression -> BinaryExpr($1, $2, $3)
	;

conditional_and_expression
	: equality_expression
	| conditional_and_expression '&&' equality_expression -> BinaryExpr($1, $2, $3)
	;

conditional_or_expression
	: conditional_and_expression
	| conditional_or_expression '||' conditional_and_expression -> BinaryExpr($1, $2, $3)
	;

conditional_expression
	: conditional_or_expression
	| conditional_or_expression '?' expression ':' conditional_expression %prec TERNARY -> TernaryCondition($1, $3, $5)
	;

expression
	: conditional_expression
	;

operator
	: '+' | '-' | '*' | '/' | '<' | '>' | '<=' | '>=' | '===' | '==' | '!=' | '&&' | '||' | '>>>' | '>>' | '<<' | '&' | '|'
	;

value
	: macro_call
	| terminal_value
	| '(' expression ')' -> $expression
	| '!' expression -> Not($expression)
	;

macro_call
	: NAME macro_call_args -> MacroCall($NAME, $macro_call_args)
	;

macro_call_args
	: '(' (expression ',')* expression? ')' -> push($2, $3)
	;

terminal_value
	: NAME -> Variable($NAME)
	| STRING -> StringValue($STRING)
	| NUMBER -> NumberValue($NUMBER)
	| 'true' -> BooleanValue(true)
	| 'false' -> BooleanValue(false)
	| 'loop.index' -> Variable('loop_index')
	| '[]' -> ArrayValue([])
	;

