
/* ------------------------ */
/* regular expressions */
/* ------------------------ */

numeric			((\d+(\.\d*)?)|(\.\d+))
alphanum_u		[A-Za-z_0-9]
word 			{alphanum_u}+
name 			[A-Za-z_]{alphanum_u}*

regex 			[~][/](?:[^/\n\\]|\\.)+[/][a-z]*

single_quoted_string 	['](?:[^'\\]|\\.)*[']
double_quoted_string 	["](?:[^"\\]|\\.)*["]
backtick_quoted_string 	[`](?:[^`\\]|\\.)*[`]


%x eval line regex

%options flex

%%
/* ------------------------ */
/* lexical vocabulary */
/* ------------------------ */

<eval,line>"?"			return '?'
<eval,line>":"			return ':'

<eval,line>"[]" 		return '[]'

<eval,line>"("			return '('
<eval,line>")"			return ')'
<eval,line>"["			return '['
<eval,line>"]"			return ']'

<eval,line>"+"			return '+'
<eval,line>"-"			return '-'
<eval,line>"*"			return '*'
<eval,line>"/"			return '/'
<eval,line>"%"			return '%'

<eval,line>">>>"		return '>>>'
<eval,line>">>"			return '>>'
<eval,line>"<<"			return '<<'

<eval,line>"<"			return '<'
<eval,line>">"			return '>'
<eval,line>"<="			return '<='
<eval,line>">="			return '>='

<eval,line>"&&"			return '&&'
<eval,line>"||"			return '||'

<eval,line>"&"			return '&'
<eval,line>"|"			return '|'

<eval,line>"==="		return '==='
<eval,line>"=="			return '=='
<eval,line>"!="			return '!='

<eval,line>"!"			return '!'

<line>"="				return '='
<eval>"#"				return '#'

<eval,line>","			return ','

<eval,line>"true"					return 'true'
<eval,line>"false"					return 'false'
<eval,line>{name}					return 'NAME'
<eval,line>{numeric}				return 'NUMBER'
<eval,line>{single_quoted_string} 	return 'STRING'
<eval,line>{double_quoted_string}	return 'STRING'
<eval,line>{backtick_quoted_string} return 'BACKTICK'
<eval,line>"loop.index"				return 'loop.index'

<eval>"}"				this.popState(); return '}';
<eval>\s+				{ /* ignore whitespace */ }
<eval>.					return 'INVALID'

<line>[ \t]+				{ /* ignore whitespace */ }
<line>\n 					{ this.popState() }


[@]\s*[/][/][^\n]*\n 	{ /* ignore line comments */ }
/*[@]\s*[/][*][^]*[*][/] 	{ /* ignore block comments *       / }  /**/

"@{"				this.begin('eval'); return '@{';
"@set"				this.begin('line'); return '@set'
"@let"				this.begin('line'); return '@let'
"@def"	 			this.begin('line'); return '@def';
"@macro"	 		this.begin('line'); return '@def';
"@repeat" 			this.begin('line'); return '@repeat';
"@include"			this.begin('line'); return '@include';
"@if"				this.begin('line'); return '@if';
"@elseif"			this.begin('line'); return '@elseif';
"@else"				return '@else';
"@end"\n			return '@end';

<INITIAL>[^@]+				return 'VERBATIM';
(?:.|\n) 					return 'VERBATIM';


/*[`]([^`]|\\`)*[`]					return 'VERBATIM';  /* template string */
/*{double_quoted_string}				return 'VERBATIM';  /* double-quoted string */
/*{single_quoted_string}				return 'VERBATIM';  /* single-quoted string */
/*[/][/][^\n]*\n						return 'VERBATIM';  /* single-line comment */
/*[/][*][^]*?[*][/]					return 'VERBATIM';  /* multi-line comment */
/*[/](?:\[(?:[^\]]|\\\])+\]|\\\/|[^*        /\n])(?:\[(?:[^\]]|\\\])+\]|\\\/|[^\n/])*[/]		return 'VERBATIM';  /* regex */
/*[^/@]+ 					return 'VERBATIM';  /**/
/*"@"						return 'VERBATIM';  /**/


<<EOF>> 		return 'EOF'
