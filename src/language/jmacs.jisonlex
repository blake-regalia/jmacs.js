
/* ------------------------ */
/* regular expressions */
/* ------------------------ */

numeric			((\d+(\.\d*)?)|(\.\d+))
alphanum_u		[A-Za-z_0-9]
word 			{alphanum_u}+
name 			[A-Za-z_]{alphanum_u}*

single_quoted_string 	['](?:[^'\\]|\\.)*[']
double_quoted_string 	["](?:[^"\\]|\\.)*["]

%x jm jm_nest_brace jm_nest_paren jm_nest_bracket jm_line jm_template

%options flex

%%
/* ------------------------ */
/* lexical vocabulary */
/* ------------------------ */

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{single_quoted_string} 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{double_quoted_string} 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"`" 						this.begin('jm_template'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"{"							this.begin('jm_nest_brace'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"("							this.begin('jm_nest_paren'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"["							this.begin('jm_nest_bracket'); return 'JM';

<jm_nest_brace>"}"					this.popState(); return 'JM';
<jm_nest_paren>")"					this.popState(); return 'JM';
<jm_nest_bracket>"]"					this.popState(); return 'JM';

<jm_template>[\\].				return 'JM';
<jm_template>[$][{]				this.begin('jm_nest_brace'); return 'JM';
<jm_template>"`"				this.popState(); return 'JM';

<jm>"}"							this.popState(); return '}';

<jm_line>\n 					this.popState();
<jm_line>[^\n] 					return 'JM';

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_template>(?:.|\n)	return 'JM';


/* escape '@' character */
[@][@]					return 'ESCAPED_AT';
[\s]*[@][/][/][^\n]*\n 	{ /* ignore line comments */ }
/*[@][#][^\n]*\n 	{ /* ignore line comments / } /**/
/*[@]\s*[/][*][^]*[*][/] 	{ /* ignore block comments *       / }  /**/

"@{"				this.begin('jm');   return '@{';
"@.{"				this.begin('jm');   return '@.{';
"@*{"				this.begin('jm');   return '@*{';
[\s]*"@."				this.begin('jm_line'); return '@.';
[\s]*"@$"\s?				this.begin('jm_line'); return '@global';
[\s]*"@global"\s?			this.begin('jm_line'); return '@global';
[\s]*"@-"\s?				this.begin('jm_line'); return '@if';
[\s]*"@if"\s?				this.begin('jm_line'); return '@if';
[\s]*"@+"\s?				this.begin('jm_line'); return '@else-if';
[\s]*"@else-if"\s?			this.begin('jm_line'); return '@else-if';
[\s]*"@:"				return '@else';
[\s]*"@else"				return '@else';
[\s]*"@;"				this.begin('jm_line'); return '@end';
[\s]*"@end"				this.begin('jm_line'); return '@end';
[\s]*"@>"\s?				this.begin('jm_line'); return '@def';
[\s]*"@def"\s?	 			this.begin('jm_line'); return '@def';
[\s]*"@>>"\s?				this.begin('jm_line'); return '@def-cram';
[\s]*"@def-cram"\s?			this.begin('jm_line'); return '@def-cram';
[\s]*"@^"\s?				this.begin('jm_line'); return '@import';
[\s]*"@import"\s?			this.begin('jm_line'); return '@import';


[\s\r\n]+ 			return 'VERBATIM'
[^@]+				return 'VERBATIM';
(?:.|\n) 			return 'VERBATIM';


<INITIAL,jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line,jm_template><<EOF>> 		return 'EOF';
