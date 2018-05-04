
/* ------------------------ */
/* regular expressions */
/* ------------------------ */

numeric			((\d+(\.\d*)?)|(\.\d+))
alphanum_u		[A-Za-z_0-9]
word 			{alphanum_u}+
name 			[A-Za-z_]{alphanum_u}*

line_comment 			[/]\/.*?\n
block_comment			[/]\*[^]*?\*\/
single_quoted_string 	['](?:[^'\\]|\\.)*[']
double_quoted_string 	["](?:[^"\\]|\\.)*["]
regular_expression 		[/](?:[^/[\\]|\\.|\[(?:[^\]\\]|\\.)*])+\/

%x jm jm_nest_brace jm_nest_paren jm_nest_bracket jm_line jm_template

%options flex

%%
/* ------------------------ */
/* lexical vocabulary */
/* ------------------------ */

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{line_comment}		 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{block_comment} 			return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{single_quoted_string} 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{double_quoted_string} 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{regular_expression} 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"`" 						this.begin('jm_template'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"{"							this.begin('jm_nest_brace'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"("							this.begin('jm_nest_paren'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"["							this.begin('jm_nest_bracket'); return 'JM';

<jm_nest_brace>"}"				this.popState(); return 'JM';
<jm_nest_paren>")"				this.popState(); return 'JM';
<jm_nest_bracket>"]"			this.popState(); return 'JM';

<jm_template>[\\].				return 'JM';
<jm_template>"${"				this.begin('jm_nest_brace'); return 'JM';
<jm_template>"`"				this.popState(); return 'JM';

<jm>"}"							this.popState(); return '}';

<jm_line>\n 					this.popState();
<jm_line>[^\n] 					return 'JM';

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_template>(?:.|\n)	return 'JM';


/* escape '@' character */
[@][@]					return 'ESCAPED_AT';
[ \t]*[@][/][/][^\n]*\n 	{ /* ignore line comments */ }
/*[@][#][^\n]*\n 	{ /* ignore line comments / } /**/
/*[@]\s*[/][*][^]*[*][/] 	{ /* ignore block comments *       / }  /**/

"@{"							this.begin('jm');   return '@{';
"@*{"							this.begin('jm');   return '@*{';
[ \t]*"@.{"						this.begin('jm');   return '@.{';
[ \t]*"@."						this.begin('jm_line'); return '@.';
[ \t]*"@$"[ \t]?				this.begin('jm_line'); return '@global';
[ \t]*"@global"[ \t]?			this.begin('jm_line'); return '@global';
[ \t]*"@-"[ \t]?				this.begin('jm_line'); return '@if';
[ \t]*"@if"[ \t]?				this.begin('jm_line'); return '@if';
[ \t]*"@+"[ \t]?				this.begin('jm_line'); return '@else-if';
[ \t]*"@else-if"[ \t]?			this.begin('jm_line'); return '@else-if';
[ \t]*"@:"						return '@else';
[ \t]*"@else"					return '@else';
[ \t]*"@;"						this.begin('jm_line'); return '@end';
[ \t]*"@end"					this.begin('jm_line'); return '@end';
[ \t]*"@>"[ \t]?				this.begin('jm_line'); return '@def';
[ \t]*"@def"[ \t]?	 			this.begin('jm_line'); return '@def';
[ \t]*"@>>"[ \t]?				this.begin('jm_line'); return '@def-cram';
[ \t]*"@def-cram"[ \t]?			this.begin('jm_line'); return '@def-cram';
[ \t]*"@^"[ \t]?				this.begin('jm_line'); return '@import';
[ \t]*"@import"[ \t]?			this.begin('jm_line'); return '@import';


[\s\r\n]+ 			return 'VERBATIM'
[^@]+				return 'VERBATIM';
(?:.|\n) 			return 'VERBATIM';


<INITIAL,jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line,jm_template><<EOF>> 		return 'EOF';
