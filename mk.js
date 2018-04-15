
let s_dep_self_dir = '$(dirname "$@")';

let pd_build = 'build';
let pd_build_main = `${pd_build}/main`;
let pd_build_language = `${pd_build}/language`;

const rule_copy = (s) => ({
	// copy rule
	[`${pd_build}/${s}/:file.js`]: {
		deps: [
			`src/${s}/$file.js`,
			s_dep_self_dir,
		],
		run: /* syntax: bash */ `
			cp $1 $@
		`,
	},
});

module.exports = {
	all: [
		'main',
		'language',
	],

	// rules
	...[
		'main',
		'debug',
	].reduce((h, s) => Object.assign(h, rule_copy(s)), {}),

	// main files
	main: [
		'jmacs.js',
	].map(s => `${pd_build_main}/${s}`),

	// debug files
	debug: [
		'test.js'
	].map(s => `${pd_build}/debug/${s}`),

	// syntax files
	syntax: [
		'jmacs.sublime-syntax',
	].map(s => `${pd_build}/syntax/${s}`),


	// syntax rule
	[`${pd_build}/syntax/:file`]: {
		deps: [
			`src/syntax/$file`,
			s_dep_self_dir,
		],
		run: /* syntax: bash */ `
			cp $1 $@
		`,
	},

	// language rule
	language: [
		'assembler',
		'ast',
		'compiler',
		'parser',
	].map(s => `${pd_build}/language/${s}.js`),

	// a subdirectory in dist
	[`${pd_build}/:subdir`]: {
		run: /* syntax: bash */ `
			mkdir -p $@
		`,
	},

	// parser file
	[`${pd_build_language}/parser.js`]: {
		case: true,
		deps: [
			...['*.jison', '*.jisonlex']
				.map(s => `src/language/${s}`),
			s_dep_self_dir,
		],
		run: /* syntax: bash */ `
			# compile grammar and lex; output to language's build dir
			jison $1 $2 -o $@
		`,
	},

	// supplementary language file
	[`${pd_build_language}/:code.js`]: {
		case: true,
		deps: [
			'src/language/$code.js',
			s_dep_self_dir,
		],
		run: /* syntax: bash */ `
			# copy src file to language's build dir
			cp $1 $@
		`,
	},
};
