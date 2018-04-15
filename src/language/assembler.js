const fs = require('fs');
const path = require('path');
const vm = require('vm');

const T_EVAL_TIMEOUT = 8000;  // 8 seconds

const R_GLOBAL = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(.+?);?$/;

const h_eval = {
	verbatim(h_verbatim) {
		return h_verbatim.value;
	},

	inline(h_inline, y_context) {
		let z_result = this.run(h_inline.code, y_context);
		debugger;
		return h_inline.suppress? '': z_result+'';
	},

	if(h_if) {
		if(this.run(h_if.if)) {
			return this.eval(h_if.then);
		}
		else {
			let s_output = '';

			let b_elseifs = h_if.elseifs.some((h) => {
				if(this.run(h.if)) {
					s_output = this.eval(h.then);
					return true;
				}
			});

			if(!b_elseifs && this.run(h_if.else)) {
				s_output = this.eval(h_if.else);
			}

			return s_output;
		}
	},

	macro(h_macro) {
		let f_macro = this.evaluate(`function ${h_macro.def} {
			let __JMACS_OUTPUT = '';
			${h_macro.body.map(this.codify).join('\n')}
			return __JMACS_OUTPUT;
		}`);

		debugger;
		this.macros[f_macro.name] = f_macro;
		return '';
	},

	import(h_import, h_context) {
		let s_file = this.evaluate(h_import.file, h_context);

		let p_file = path.resolve(this.cwd, s_file);
		let s_input = fs.readFileSync(p_file, 'utf8');
		let h_result = require('./compiler')({
			input: s_input,
			cwd: path.dirname(p_file),
		});

		if(h_result.error) {
			throw h_result.error;
		}

		// merge macros and globals
		let h_import_macros = h_result.macros;
		for(let s_macro in h_import_macros) {
			this.macros[s_macro] = h_import_macros[s_macro];
		}

		let h_import_global = h_result.global;
		for(let s_global in h_import_global) {
			this.global[s_global] = h_import_global[s_global];
		}

		// append output
		return h_result.output;
	},
};

const h_codify = {
	import(g) {
		let s_file = eval(g.file);
		let s_cwd = process.cwd();
		let p_file = path.join(this.state.cwd, s_file);
		const jmacs = require('../main/jmacs.js');
		debugger;
		return jmacs.load(p_file).output;
	},

	macro(g) {
		return `function ${g.macro} {
			let __JMACS_OUTPUT = '';
			${this.codify(g.body)}
			return __JMACS_OUTPUT;
		}`;
	},

	verbatim: g => `__JMACS_OUTPUT += ${JSON.stringify(g.value)};`,

	inline: g => {
		return g.suppress
		? g.code
		: /* syntax: js */ `
			__JMACS_OUTPUT += __safe_exec(() => (${g.code}));
		`
	},

	if(g) {
		let s_output = `if(__safe_exec(() => (${g.if}))) {
			${this.codify(g.then)}
		}`;

		for(let g_elseif of g.elseifs) {
			s_output += `
				else if(__safe_exec(() => (${g_elseif.if}))) {
					${this.codify(g_elseif.then)}
				}`;
		}

		if(g.else) {
			s_output += `
				else {
					${this.codify(g.else)}
				}`;
		}

		return s_output;
	},

	global(g) {
		let m_global = R_GLOBAL.exec(g.code);
		if(!m_global) throw new Error(`invalid global assignment ${g.code}`);
		return /* syntax: js */ `__global['${m_global[1]}'] ${m_global[2]};`;
	},

	generator(g) {
		return /* syntax: js */ `__JMACS_OUTPUT += [...(function*() {
			${g.code}
		})()].join('');`
	},
};

class evaluator {
	constructor(g_state) {
		Object.assign(this, {
			state: g_state,
			context: vm.createContext({}),
		});
	}

	codify(z_syntax) {
		if(Array.isArray(z_syntax)) {
			return z_syntax.map(h => this.codify(h).join('\n')).join('\n');
		}
		else {
			let f_codifier = h_codify[z_syntax.type];
			if(!f_codifier) {
				throw new Error(`codifier not exist: ${z_syntax.type}`);
			}
			return [f_codifier.apply(this, [z_syntax])];
		}
	}

	run(s_code) {
		// prep script
		let y_script = new vm.Script(s_code, {});

		// set global
		this.context.__global = this.context;

		// eval code
		return y_script.runInContext(this.context, {
			timeout: T_EVAL_TIMEOUT,
		});
	}

	eval(z_syntax) {
		if(Array.isArray(z_syntax)) {
			return z_syntax.map(h => this.codify(h).join('\n'));
		}
		else {
			let s_evaluator = z_syntax.type;
			if(!s_evaluator) {
				throw new Error(`evaluator not exist: ${s_evaluator}`);
			}
			return h_eval[s_evaluator].apply(this, [z_syntax]);
		}
	}
}

module.exports = (a_sections) => {
	return function(p_cwd, h_global=null, h_macros={}) {

		let h_states = {
			cwd: p_cwd,
			macros: h_macros,
			global: h_global,
			output: '',
		};


		let k_evaluator = new evaluator(h_states);

		let s_output = k_evaluator.eval(a_sections).join('\n');

		return {
			output: s_output,

			run() {
				let s_eval = /* syntax: js */ `
					let __JMACS_OUTPUT = '';

					const __safe_exec = (__f, s_prev) => {
						try {
							return __f();
						} catch(e_append) {
							// allow reference errors
							if(e_append instanceof ReferenceError) {
								let s_identifier = e_append.message.replace(/^(.+) is not defined$/, '$1');

								// prevent infinite loop
								if(s_identifier === s_prev) {
									debugger;
									throw new Error(\`cannot use identifier \${s_identifier}\`);
								}

								// print
								console.warn(\`undefined identifier: '\${s_identifier}'; automatically declaring as undefined\`);

								// re-evaluate
								return __safe_exec(new Function(\`
									let \${s_identifier};
									return (\${__f.toString()})();
								\`), s_identifier);
							}
							else {
								throw new Error(\`execution error in meta-script:\\n\${e_append.message}\\n\${e_append.stack}\`);
								return '';
							}
						}
					};

					${s_output}
					__JMACS_OUTPUT;
				`;

				let z_result;
				try {
					z_result = k_evaluator.run(s_eval);
				}
				catch(e_run) {
					throw new Error(`there is a syntax error in the meta-script:\n${e_run.message} \n${e_run.stack}`);
				}

				return z_result;
			},
		};
	};
};
