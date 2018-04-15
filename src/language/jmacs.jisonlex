
/* ------------------------ */
/* regular expressions */
/* ------------------------ */

numeric			((\d+(\.\d*)?)|(\.\d+))
alphanum_u		[A-Za-z_0-9]
word 			{alphanum_u}+
name 			[A-Za-z_]{alphanum_u}*

single_quoted_string 	['](?:[^'\\]|\\.)*[']
double_quoted_string 	["](?:[^"\\]|\\.)*["]

%x jm jm_nest jm_line jm_template

%options flex

%%
/* ------------------------ */
/* lexical vocabulary */
/* ------------------------ */

<jm,jm_nest,jm_line>{single_quoted_string} 		return 'JM';
<jm,jm_nest,jm_line>{double_quoted_string} 		return 'JM';
<jm,jm_nest,jm_line>"`" 						this.begin('jm_template'); return 'JM';
<jm,jm_nest,jm_line>"{"							this.begin('jm_nest'); return 'JM';

<jm_nest>"}"					this.popState(); return 'JM';

<jm_template>[\\].				return 'JM';
<jm_template>[$][{]				this.begin('jm_nest'); return 'JM';
<jm_template>"`"				this.popState(); return 'JM';

<jm>"}"							this.popState(); return '}';

<jm_line>\n 					this.popState();
<jm_line>[^\n] 					return 'JM';

<jm,jm_nest,jm_template>(?:.|\n)	return 'JM';


/* escape '@' character */
[@][@]					return 'ESCAPED_AT';
[@][/][/][^\n]*\n 	{ /* ignore line comments */ }
/*[@][#][^\n]*\n 	{ /* ignore line comments / } /**/
/*[@]\s*[/][*][^]*[*][/] 	{ /* ignore block comments *       / }  /**/

"@{"				this.begin('jm');   return '@{';
"@.{"				this.begin('jm');   return '@.{';
"@*{"				this.begin('jm');   return '@*{';
"@."				this.begin('jm_line'); return '@.';
"@$"				this.begin('jm_line'); return '@global';
"@global"			this.begin('jm_line'); return '@global';
"@-"				this.begin('jm_line'); return '@if';
"@if"				this.begin('jm_line'); return '@if';
"@+"				this.begin('jm_line'); return '@else-if';
"@else-if"			this.begin('jm_line'); return '@else-if';
"@:"				return '@else';
"@else"				return '@else';
"@;"				this.begin('jm_line'); return '@end';
"@end"				this.begin('jm_line'); return '@end';
"@>"				this.begin('jm_line'); return '@def';
"@def"	 			this.begin('jm_line'); return '@def';
"@>>"				this.begin('jm_line'); return '@def-cram';
"@def-cram"			this.begin('jm_line'); return '@def-cram';
"@^"				this.begin('jm_line'); return '@import';
"@import"			this.begin('jm_line'); return '@import';


[^@]+				return 'VERBATIM';
(?:.|\n) 			return 'VERBATIM';


<INITIAL,jm,jm_nest,jm_line,jm_template><<EOF>> 		return 'EOF';
