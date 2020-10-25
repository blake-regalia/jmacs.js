
/* ------------------------ */
/* regular expressions */
/* ------------------------ */

numeric			((\d+(\.\d*)?)|(\.\d+))
alphanum_u		[A-Za-z_0-9]
word 				{alphanum_u}+
name 				[A-Za-z_]{alphanum_u}*

line_comment 			[/]\/.*?\n
block_comment			[/]\*[^]*?\*\/
single_quoted_string 	['](?:[^'\\]|\\.)*[']
double_quoted_string 	["](?:[^"\\]|\\.)*["]
regular_expression 		[/](?:[^/[\\]|\\.|\[(?:[^\]\\]|\\.)*])+\/

%x jm jm_nest_brace jm_nest_paren jm_nest_bracket jm_line jm_template jm_indent

%options flex

%%
/* ------------------------ */
/* lexical vocabulary */
/* ------------------------ */

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{line_comment}		 		return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{block_comment} 			return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{single_quoted_string} 	return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{double_quoted_string} 	return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>{regular_expression} 		return 'JM';

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"`" 	this.begin('jm_template'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"{"		this.begin('jm_nest_brace'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"("		this.begin('jm_nest_paren'); return 'JM';
<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line>"["		this.begin('jm_nest_bracket'); return 'JM';

<jm_nest_brace>"}"			this.popState(); return 'JM';
<jm_nest_paren>")"			this.popState(); return 'JM';
<jm_nest_bracket>"]"			this.popState(); return 'JM';

<jm_template>[\\].			return 'JM';
<jm_template>"${"				this.begin('jm_nest_brace'); return 'JM';
<jm_template>"`"				this.popState(); return 'JM';

<jm>"}"							this.popState(); return '}';

<jm_line>\n\s* 				this.popState(); return 'INDENT';
<jm_line>[^\n] 				return 'JM';

<jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_template>(?:.|\n)	return 'JM';


/* escape '@' character */
[@][@]							return 'ESCAPED_AT';
[ \t]*[@][/][/][^\n]*\n 	{ /* ignore line comments */ }
/*[@][#][^\n]*\n 	{ /* ignore line comments / } /**/
/*[@]\s*[/][*][^]*[*][/] 	{ /* ignore block comments *       / }  /**/

(?:\r?\n[ \t]*)?"@{"						this.begin('jm');   return '@{';
(?:\r?\n[ \t]*)?"@*{"					this.begin('jm');   return '@*{';
(?:\r?\n[ \t]*)?"@.{"					this.begin('jm');   return '@.{';
(?:\r?\n[ \t]*)?"@."						this.begin('jm_line'); return '@.';
(?:\r?\n[ \t]*)?"@$"[ \t]*				this.begin('jm_line'); return '@global';
(?:\r?\n[ \t]*)?"@global"[ \t]*		this.begin('jm_line'); return '@global';
(?:\r?\n[ \t]*)?"@-"[ \t]*				this.begin('jm_line'); return '@if';
(?:\r?\n[ \t]*)?"@if"[ \t]*			this.begin('jm_line'); return '@if';
(?:\r?\n[ \t]*)?"@+"[ \t]*				this.begin('jm_line'); return '@else-if';
(?:\r?\n[ \t]*)?"@else-if"[ \t]*		this.begin('jm_line'); return '@else-if';
(?:\r?\n[ \t]*)?"@:"[ \t]*\n			return '@else';
(?:\r?\n[ \t]*)?"@else"[ \t]*\n		return '@else';
(?:\r?\n[ \t]*)?"@;"[ \t]*				return '@end';
(?:\r?\n[ \t]*)?"@end"[ \t]*			return '@end';
(?:\r?\n[ \t]*)?"@>"[ \t]*				this.begin('jm_line'); return '@def';
(?:\r?\n[ \t]*)?"@def"[ \t]*			this.begin('jm_line'); return '@def';
(?:\r?\n[ \t]*)?"@>>"[ \t]*			this.begin('jm_line'); return '@def-cram';
(?:\r?\n[ \t]*)?"@def-cram"[ \t]*	this.begin('jm_line'); return '@def-cram';
(?:\r?\n[ \t]*)?"@^"[ \t]*				this.begin('jm_line'); return '@import';
(?:\r?\n[ \t]*)?"@import"[ \t]*		this.begin('jm_line'); return '@import';
(?:\r?\n[ \t]*)?"@#"						this.begin('jm_indent'); return '@indent';
(?:\r?\n[ \t]*)?"@indent"				this.begin('jm_indent'); return '@indent';

<jm_indent>[-+]+(['][^']*[']|["][^"]*["])?[ \t]?	this.popState(); return 'jm_indent_quantifier';


[ \t]+([\r\n])* 		return 'VERBATIM'
[^@\s\r\n]+				return 'VERBATIM';
(?:.|[\r\n]) 			return 'VERBATIM';


<INITIAL,jm,jm_nest_brace,jm_nest_paren,jm_nest_bracket,jm_line,jm_template><<EOF>> 		return 'EOF';
