#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const compiler = require('../language/compiler');

const main = module.exports = {
	load(p_file, s_prepend='') {
		let s_input = fs.readFileSync(p_file, 'utf8');

		let p_file_resolved = path.resolve(p_file);

		return compiler({
			input: s_prepend+s_input,
			cwd: path.dirname(p_file_resolved),
			path: p_file_resolved,
		});
	},

	compile(h_compile) {
		return compiler(h_compile);
	},
};

if(module === require.main) {
	let h_cli = require('yargs')
		.usage('$0 [OPTIONS] FILE')
		.string('g')
			.alias('g', 'config')
			.describe('g', 'pass a JSON-like JavaScript object to insert global vars at the top')
		.boolean('m')
			.alias('m', 'meta')
			.describe('m', 'return the meta script instead of the output code')
		.alias('h', 'help')
		.alias('v', 'version')
		.help()
		.parse(process.argv);

	let a_pargs = h_cli._.slice(2);

	if(!a_pargs.length) {
		console.error(`ERROR: expected at least one file arugment; received 0\n`);
		require('yargs').showHelp();
		process.exit(0);
	}

	let p_input = path.resolve(process.cwd(), a_pargs[0]);

	let s_prepend = '';
	if(h_cli.config) {
		let h_vars = eval(`(${h_cli.config})`);
		for(let s_var in h_vars) {
			s_prepend += `@.const ${s_var} = ${JSON.stringify(h_vars[s_var])};\n`;
		}
	}

	let g_result = main.load(p_input, s_prepend);

	if(h_cli.meta) {
		process.stdout.write(g_result.meta.standalone);
	}
	else {
		(async() => {
			let g_output;
			try {
				g_output = await g_result.run();
			}
			catch(e_run) {
				throw new Error(`execution error in meta-script:\n${e_run.message}\n${e_run.stack}`);
			}

			process.stdout.write(g_output.code);
		})();
	}
}
