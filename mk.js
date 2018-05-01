
let g_package_json = require('./package.json');
let s_jmacs_version = g_package_json.version;

let s_dep_self_dir = '$(dirname "$@")';

let pd_build = 'build';
let pd_build_main = `${pd_build}/main`;
let pd_build_language = `${pd_build}/language`;
let pd_build_syntax = `${pd_build}/syntax`;
let pd_dist_eslint = `dist/eslint-plugin`;

const rule_copy = (s_dir, s_file=':file.js') => ({
	// copy rule
	[`${pd_build}/${s_dir}/${s_file}`]: {
		deps: [
			`src/${s_dir}/${s_file.replace(/^:/, '$')}`,
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
		'eslint',
		// 'syntax',
	],

	link: {
		run: /* syntax: bash */ `
			pushd ${pd_build_main}
				npm link
			popd
			pushd ${pd_dist_eslint}
				npm link jmacs
				npm link
			popd
		`,
	},

	publish: {
		run: /* syntax: bash */ `
			pushd ${pd_build_main}
				npm publish
			popd
			pushd ${pd_dist_eslint}
				npm publish
			popd
		`,
	},

	eslint: [
		...[
			'package.json',
			'index.js',
		].map(s => `${pd_dist_eslint}/${s}`),
	],

	syntax: [
		...[
			'excelsior.tmTheme',
			'jmacs.sublime-syntax',
		].map(s => `${pd_build_syntax}/${s}`),
	],

	publish: {
		deps: ['all'],
		run: /* syntax: bash */ `
			# publish jmacs
			npm publish

			# publish eslint-plugin-jmacs
			cd ${pd_dist_eslint}
			npm publish
		`,
	},

	patch: {
		deps: ['all'],
		run: /* syntax: bash */ `
			npm version patch
			
		`,
	},

	[`${pd_dist_eslint}/package.json`]: {
		deps: [
			'src/eslint-plugin/package.json',
			'./package.json',
			s_dep_self_dir,
		],
		run: /* syntax: bash */ `
			cat $1 | npx lambduh "`
			+ /* syntax:js */ `json =>
				Object.assign(json, {
					version: '${s_jmacs_version}',
					dependencies: {
						jmacs: '^${s_jmacs_version}',
					},
				})
				&& json`.replace(/[\n\t]/g, '')
			+ /* syntax: bash */ `" > $@
		`,
	},

	...rule_copy('syntax', 'excelsior.tmTheme'),
	...rule_copy('syntax', 'jmacs.sublime-syntax'),

	[`${pd_dist_eslint}/index.js`]: {
		deps: [
			'src/eslint-plugin/index.js',
			s_dep_self_dir,
		],
		run: /* syntax: bash */ `
			cp $1 $@
		`,
	},

	test: {
		deps: [
			'test/main/*.js',
		],
		run: /* syntax: bash */ `
			mocha $1
		`,
	},

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

	// a subdirectory in output dir
	'&output': /(build|dist)/,
	[`(&output)/:subdir`]: {
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
