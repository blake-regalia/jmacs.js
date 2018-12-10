const fs = require('fs');

let g_package_json = require('./package.json');
let s_jmacs_version = g_package_json.version;


module.exports = {
	defs: {
		parser_file: fs.readdirSync('src/language')
			.filter(s => s.endsWith('.js')),

		syntax_file: fs.readdirSync('src/syntax')
			.filter(s => /\.(sublime-syntax|tm(Theme|Preferences))$/.test(s)),
	},

	tasks: {
		all: 'link',

		link: () => ({
			deps: [
				'build/**',
			],
			run: /* syntax: bash */ `
				pushd build/node-js/main
					npm link
				popd

				pushd build/eslint-plugin
					npm link jmacs
					npm link
				popd
			`,
		}),
	},

	outputs: {
		build: {
			'node-js': {
				main: {
					'jmacs.js': () => ({
						copy: 'src/main/jmacs.js',
					}),
				},

				language: {
					':parser_file': h => ({
						copy: `src/language/${h.parser_file}`,
					}),

					'parser.js': () => ({
						deps: ['src/language/*.{jison,jisonlex}'],
						run: /* syntax: bash */ `
							# compile grammar and lex; output to build dir
							jison $1 $2 -o $@
						`,
					}),
				},
			},

			'sublime-text': {
				':syntax_file': h => ({
					copy: `src/syntax/${h.syntax_file}`,
				}),
			},

			'eslint-plugin': {
				'main.js': h => ({
					copy: `src/eslint-plugin/main.js`,
				}),

				'package.json': () => ({
					deps: [
						'src/eslint-plugin/package.json',
						'package.json',
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
						+'"'+/* syntax: bash */ ` > $@
						npx sort-package-json $@
					`,
				}),
			},
		},
	},
};
