const path = require('path');
const vm = require('vm');
const sourcemap = require('source-map');

// const T_EVAL_TIMEOUT = 8000;  // 8 seconds
const T_EVAL_TIMEOUT = Infinity; // 64 seconds

const R_GLOBAL = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)(\s*)((?:[|^%*/+-]|<<|>>>?)?=)(.+?);?$/;
const R_IDENTIFIER_SAFE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const srcmap = (z_code, g_loc, s_name=null) => {
	// ysn_meta.add(
	return (new sourcemap.SourceNode(
		g_loc.first_line,
		g_loc.first_column,
		'meta',
		z_code,
		s_name,
	));
};

const h_codify = {
	import({target:g_target}) {
		let s_file = eval(g_target.code);
		let s_cwd = process.cwd();
		let p_file = path.resolve(this.state.cwd, s_file);
		const jmacs = require('../main/jmacs.js');

		let g_result = jmacs.load(p_file);

		// import exports
		this.state.exports = new Set([...this.state.exports, ...g_result.exports]);

		// let g_output;
		// try {
		// 	g_output = g_result.run();
		// }
		// catch(e_run) {
		// 	throw new Error(`cannot import '${p_file}' because it has a syntax error: ${e_run.message}\n${e_run.stack}`);
		// }

		return {
			lint: [],
			meta: g_result.meta.code,
		};
	},

	macro({head:g_head, body:a_body, cram:b_cram}) {
		if(b_cram) {
			for(let g_node of a_body) {
				if(g_node.text) g_node.text = g_node.text.replace(/\s/g, '');
			}
		}
		else {
			// gobble indent
			let nl_body = a_body.length;
			for(let i_text=0; i_text<nl_body-1; i_text++) {
				if(a_body[i_text].text) {
					let s_text_0 = a_body[i_text].text;
					let s_pre = s_text_0.replace(/^(\s*)[^]*$/, '$1');
					let nl_pre = s_pre.length;

					// // trim whitespace from beginning while we're here
					// a_body[i_text].text = s_text_0.slice(s_pre.length);
					// if(!a_body[i_text].text) {
					// 	a_body.splice(i_text, 1);
					// 	nl_body -= 1;
					// }

					let r_pre_nl = new RegExp('\\n'+s_pre, 'g');
					let r_pre_anchor = new RegExp('^'+s_pre);

					let b_prev_newline = false;
					for(let g_node of a_body) {
						if(g_node.text) {
							if(b_prev_newline) {
								if(r_pre_anchor.test(g_node.text)) {
									g_node.text = g_node.text.replace(r_pre_anchor, '');
									g_node.loc.first_column += nl_pre;
									g_node.loc.last_column += nl_pre;
								}
							}
							else {
								g_node.text = g_node.text.replace(r_pre_nl, '\n');
								g_node.loc.first_column += nl_pre;
								g_node.loc.last_column += nl_pre;
							}

							b_prev_newline = g_node.text.endsWith('\n');
						}
						else if(g_node.line) {
							b_prev_newline = true;
						}
						else {
							b_prev_newline = false;
						}
					}

					break;
				}
			}

			// trim whitespace from end
			for(let i_text=nl_body-1; i_text>=0; i_text--) {
				if(a_body[i_text].text) {
					let g_tail = a_body[i_text];
					g_tail.text = g_tail.text.replace(/\n\s*$/, '');

					if(!g_tail.text) {
						a_body.splice(i_text, 1);
						nl_body -= 1;
					}

					break;
				}
			}
		}

		let g_codified = this.codify(a_body);

		// export function name
		let s_name = g_head.code.replace(/^\s*([^\s\n*(]+)[^]*$/, '$1');
		this.state.exports.add(s_name);

		return {
			lint: [
				'function ',
				srcmap(g_head.code.trim(), g_head.loc),
				' {\n',
				...g_codified.lint,
				'}\n',
			],
			meta: /* syntax: js */ `global['${s_name}'] = function ${g_head.code} {
				const __JMACS_OUTPUT = [];
				${g_codified.meta}
				return new __JMACS.output(__JMACS_OUTPUT);
			}`,
		};
	},

	verbatim: ({text:s_text, loc:g_loc}) => ({
		lint: [],
		meta: /* syntax: js */ `
			__JMACS_OUTPUT.push(
				...__JMACS.srcmap(
					${JSON.stringify(s_text)},
					${JSON.stringify(g_loc)},
					'verbatim',
				));
		`,
	}),

	whitespace: ({text:s_ws}) => ({
		lint: [],
		meta: /* syntax: js */ `
			__JMACS_OUTPUT.push(${JSON.stringify(s_ws)});
		`,
	}),

	inline: ({expr:g_expr}) => ({
		lint: [
			'(() => (',
			srcmap(g_expr.code, g_expr.loc),
			'))();\n',
		],
		meta: /* syntax: js */ `
			__JMACS_OUTPUT.push(
				...__JMACS.srcmap(
					__JMACS.safe_exec(() => (${g_expr.code})),
					${JSON.stringify(g_expr.loc)},
					'inline',
				));
		`,
	}),

	meta: ({meta:g_meta, line:b_line}) => ({
		lint: [
			srcmap(g_meta.code, g_meta.loc, b_line? 'line': 'block'),
			'\n',
		],
		meta: g_meta.code,
	}),

	if(g) {
		let gc_then = this.codify(g.then);

		let a_lint = [
			'if(',
			srcmap(g.if.code, g.if.loc),
			') {\n',
			gc_then.lint,
			'}\n',
		];

		let s_meta = /* syntax: js */ `
			if(__JMACS.safe_exec(() => (${g.if.code}))) {
				${gc_then.meta}
			}`;

		for(let g_elseif of g.elseifs) {
			let gc_elseif_then = this.codify(g_elseif.then);

			a_lint.push(...[
				'else if(',
				srcmap(g_elseif.if.code, g_elseif.if.loc),
				') {\n',
				...gc_elseif_then.lint,
				'}\n',
			]);

			s_meta += /* syntax: js */ `
				else if(__JMACS.safe_exec(() => (${g_elseif.if.code}))) {
					${gc_elseif_then.meta}
				}`;
		}

		if(g.else) {
			let gc_else_then = this.codify(g.else);

			a_lint.push(...[
				'else {\n',
				...gc_else_then.lint,
				'}\n',
			]);

			s_meta += /* syntax: js */ `
				else {
					${gc_else_then.meta}
				}`;
		}

		return {
			lint: a_lint,
			meta: s_meta,
		};
	},

	global({def:g_def}) {
		let m_global = R_GLOBAL.exec(g_def.code);
		if(!m_global) throw new Error(`invalid global assignment ${g_def.code}`);
		let [, s_var, s_ws, s_oper, s_value] = m_global;
		// let s_ws = s_ws1 + s_ws_2;
		let n_nls = s_ws.includes('\n')? s_ws.match(/\n/g).length: 0;

		let i_col = g_def.loc.first_column;
		let i_row = g_def.loc.first_line;
		if(n_nls) {
			i_col += n_nls;
			i_row = /\n([^\n]+)$/.exec(s_ws)[1].length;
		}

		// add to global identifiers
		let b_first = !this.state.exports.has(s_var);
		this.state.exports.add(s_var);

		return {
			lint: [
				...(R_IDENTIFIER_SAFE.test(s_var)
					? [
						'global.',
						srcmap(s_var, g_def.loc),
						' ',
					]
					: [
						`global['`,
						srcmap(s_var, g_def.loc),
						`'] `,
					]),
				srcmap(s_oper+s_value, {first_column:i_col, first_line:i_row}),
				'\n',
			],
			meta: /* syntax: js */ `${b_first? 'let ': ''}${s_var} = global['${s_var}'] ${s_oper} __JMACS.safe_exec(() => (${s_value}));`,
		};
	},

	generator({expr:g_expr}) {
		return {
			lint: [
				'(function*() {\n',
				srcmap(g_expr.code, g_expr.loc),
				'})();\n',
			],
			meta: /* syntax: js */ `
				// debugger;
				__JMACS_OUTPUT.push(...(function*() {
					${g_expr.code}
				})());`,
		};
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
			let a_codified = [];
			let g_prev = null;

			let b_nws = false;
			for(let g_node of z_syntax) {
				if(b_nws) {
					// codify non-whitespace
					a_codified.push(this.codify(g_node));
				}
				else if('whitespace' === g_node.type) {
					g_prev = g_node;
				}
				else {
					// include previous whitespace after newline
					if(g_prev) {
						a_codified.push(this.codify(Object.assign(g_prev, {
							text: g_prev.text.replace(/^[^]*?([^\n]*)$/, '$1'),
						})));
					}

					// codify non-whitespace
					a_codified.push(this.codify(g_node));

					//
					b_nws = true;
				}
			}

			let a_lint = [];
			let a_meta = [];

			for(let g_node of a_codified) {
				if(g_node.lint) a_lint.push(...g_node.lint);
				a_meta.push(g_node.meta);
			}

			return {
				lint: a_lint,
				meta: a_meta.join('\n'),
			};
		}
		else {
			let f_codifier = h_codify[z_syntax.type];
			if(!f_codifier) {
				throw new Error(`codifier not exist: ${z_syntax.type}`);
			}
			return f_codifier.apply(this, [z_syntax]);
		}
	}

	run(s_code) {
		let h_module = {exports:{}};
		let h_nodejs_env = {
			__dirname: this.state.cwd,
			__filename: this.state.path,
			exports: h_module.exports,
			module: h_module,
			require: require,
		};

		// prep script
		let s_script = /* syntax: js */ `
			(function(${Object.keys(h_nodejs_env).join(',')}) {
				${s_code}
			})(${Object.keys(h_nodejs_env).map(s => `__JMACS.${s}`).join(',')})`;

		let y_script = new vm.Script(s_script, {
			filename: this.state.path,
		});

		let h_context = {};
		for(let _key of Reflect.ownKeys(global)) {
			Reflect.defineProperty(h_context, _key,
				Reflect.getOwnPropertyDescriptor(global, _key));
		}

		Object.assign(h_context, {
			__JMACS: h_nodejs_env,
		});

		// eval code
		return y_script.runInNewContext(h_context, {
			filename: this.state.path,
			timeout: T_EVAL_TIMEOUT,
		});
	}
}

module.exports = (a_sections) => {
	return function(p_cwd, p_file=null, h_global=null, h_macros={}) {

		let h_states = {
			cwd: p_cwd,
			path: p_file,
			macros: h_macros,
			global: h_global,
			output: '',
			exports: new Set(),
		};


		let k_evaluator = new evaluator(h_states);

		let g_codified = k_evaluator.codify(a_sections);

		let a_exports = [...h_states.exports];

		let ysn_meta = new sourcemap.SourceNode(null, null, null, [
			/* syntax: js */ `/* global ${
				a_exports
					.filter(s => R_IDENTIFIER_SAFE.test(s))
					.join(', ')} */\n`,
			...g_codified.lint,
		]);

		return {
			exports: a_exports,

			meta: {
				code: g_codified.meta,

				lint: ysn_meta.toString(),

				consumer: () => new sourcemap.SourceMapConsumer(ysn_meta.toStringWithSourceMap().map.toString()),
			},

			run() {
				let s_eval = /* syntax: js */ `
					const __JMACS_OUTPUT = [];

					const __JMACS = {
						sourcemap: require('source-map'),

						output: class {
							constructor(a_output) {
								this[__JMACS.is_output] = true;
								this.output = a_output;
							}
						},

						is_output: '**IS_JMACS_OUTPUT**',

						srcmap: (z_code, g_loc, s_name=null) => {
							if(z_code && z_code[__JMACS.is_output]) {
								return z_code.output;
							}

							let i_row = g_loc.first_line;
							let i_col = g_loc.first_column;

							let a_lines = (z_code+'').split(/\\n/g);
							let nl_lines = a_lines.length;
							let a_output = [];

							for(let i_line=0; i_line<nl_lines; i_line++) {
								let s_line = a_lines[i_line];
								let w_node = s_line;

								// content
								if(s_line.trim()) {
									w_node = new __JMACS.sourcemap.SourceNode(
										i_row,
										i_col,
										'meta',
										s_line,
										s_name,
									);
								}

								// next line
								i_row += 1;

								// 0th column
								i_col = 0;

								// content
								if(w_node) a_output.push(w_node);

								// inter-newline
								if(i_line < nl_lines-1) a_output.push('\\n');
							}

							return a_output;
						},

						safe_exec: (__f, s_prev, c_depth=0) => {
							try {
								return __f();
							} catch(e_append) {
								// allow reference errors
								// doesn't work anymore? e_append instance ReferenceError
								if(/^ReferenceError:/.test(e_append.stack)) {
									if(c_depth > 4) {
										debugger;
									}

									let s_identifier = e_append.message.replace(/^(.+) is not defined$/, '$1');

									// it is defined in global scope
									if(s_identifier in global) {
										// prevent infinite loop
										if('*'+s_identifier === s_prev) {
											debugger;
											throw new Error(\`cannot use identifier \${s_identifier}\`);
										}

										// re-evaluate
										return __JMACS.safe_exec(new Function(\`
											let \${s_identifier} = global[\${JSON.stringify(s_identifier)}];
											return (\${__f.toString()})();
										\`), '*'+s_identifier, c_depth+1);
									}

									// prevent infinite loop
									if(s_identifier === s_prev) {
										debugger;
										throw new Error(\`cannot use identifier \${s_identifier}\`);
									}

									// print
									console.warn(\`identifier was never declared: '\${s_identifier}'; automatically declaring as undefined\`);

									// re-evaluate
									return __JMACS.safe_exec(new Function(\`
										let \${s_identifier};
										return (\${__f.toString()})();
									\`), s_identifier, c_depth+1);
								}
								else {
									debugger;
									throw new Error(\`execution error in meta-script:\\n\${e_append.message}\\n\${e_append.stack}\`);
								}
							}
						},
					};
debugger;
					${g_codified.meta}
					return (() => {
						let ysn_output = (new __JMACS.sourcemap.SourceNode(null, null, null, __JMACS_OUTPUT))
							.toStringWithSourceMap();

						return {
							code: ysn_output.code,
							map: ysn_output.map.toString(),
						};
					})();
				`;
// debugger;
				let z_result;
				try {
					z_result = k_evaluator.run(s_eval);
				}
				catch(e_run) {
					throw new Error(`there is a syntax error in the meta-script:\n${e_run.message} \n${e_run.stack}`);
				}

				return {
					code: z_result.code,

					consumer: () => new sourcemap.SourceMapConsumer(z_result.map),
				};
			},
		};
	};
};
