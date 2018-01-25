const fs = require('fs');
const path = require('path');
const compiler = require('../language/compiler');

module.exports = {
	load(p_file) {
		let s_input = fs.readFileSync(p_file, 'utf8');

		let h_result = compiler({
			input: s_input,
			cwd: path.dirname(path.resolve(p_file)),
		});

		return h_result;
	},

	compile(h_compile) {
		return compiler(h_compile);
	},
};
