const path = require('path');
const vm = require('vm');
const sourcemap = require('source-map');

const T_EVAL_TIMEOUT = process.execArgv.filter(s => s.includes('--inspect'))
	? 4294967295  // maximum range
	: 30000;  // 30 seconds

const R_GLOBAL = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)(\s*)((?:[|^%*/+-]|<<|>>>?)?=)([^]+?);?$/;
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

function strip_indent(a_parts, s_indent_offset) {
	// remove indent offset from body
	if(s_indent_offset) {
		let b_prev_newline = true;

		for(let i_part=0, nl_parts=a_parts.length; i_part<nl_parts; i_part++) {
			const g_part = a_parts[i_part];

			// strip from before
			if(g_part && g_part.before) {
				g_part.before = g_part.before.replace(s_indent_offset, '');
			}

			switch(g_part.type) {
				case 'whitespace': {
					// newline
					if('\n' === g_part.text) {
						b_prev_newline = true;
						continue;
					}
					// space; remove indent offset
					else if(b_prev_newline) {
						const s_replace = g_part.text.replace(s_indent_offset, '');
						if(!s_replace) {
							a_parts.splice(i_part, 1);
							i_part -= 1;
							nl_parts -= 1;
						}
						else {
							g_part.text = s_replace;
						}
					}
					break;
				}

				case 'if': {
					strip_indent(g_part.then, s_indent_offset);
					g_part.elseifs.map(g => strip_indent(g, s_indent_offset));
					if(g_part.else) strip_indent(g_part.else, s_indent_offset);
					break;
				}

				default: {}  // eslint-disable-line no-empty
			}

			b_prev_newline = false;
		}
	}
}

const h_codify = {
	import({target:g_target}, g_extras) {
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
			deps: [
				p_file,
				...g_result.meta.deps
			],
		};
	},

	macro({head:g_head, body:a_body, cram:b_cram, before:s_before}, g_extras) {
		// normalize cram
		b_cram = b_cram || g_extras.cram;

		const {
			s_pre,
			s_strip,
		} = this.indents(s_before, g_extras.align);

		strip_indent(a_body, s_strip);

		// not a crammed-space macro
		if(!b_cram) {
			// gobble indent
			let nl_body = a_body.length;

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

		// codify children
		let g_codified = this.codify(a_body, {
			...g_extras,
			cram: b_cram,
			indent_start: s_before,
		});

		// export function name
		let s_name = g_head.code.replace(/^\s*([^\s\n*(]+)[^]*$/, '$1');
		this.state.exports.add(s_name);

		const sj_pre = /* syntax: js */ `
			__JMACS_OUTPUT.push(${JSON.stringify(s_pre)});
		`;

		return {
			lint: [
				'function ',
				srcmap(g_head.code.trim(), g_head.loc),
				' {\n',
				...g_codified.lint,
				'}\n',
			],
			meta: sj_pre+/* syntax: js */ `const ${s_name} = global['${s_name}'] = function ${g_head.code} {
				const __JMACS_OUTPUT = [];
				${g_codified.meta}
				return new __JMACS.output(__JMACS_OUTPUT);
			}`,
		};
	},

	verbatim: ({text:s_text, loc:g_loc}, g_extras) => ({
		lint: [],
		meta: /* syntax: js */ `
			__JMACS_OUTPUT.push(
				...__JMACS.srcmap(
					${JSON.stringify(g_extras.cram? s_text.replace(/\s+/g, ''): s_text)},
					${JSON.stringify(g_loc)},
					'verbatim',
				));
		`,
	}),

	whitespace: ({text:s_ws}, g_extras) => ({
		lint: [],
		meta: g_extras.cram? '': /* syntax: js */ `
			__JMACS_OUTPUT.push(${JSON.stringify(s_ws)});
		`,
	}),

	inline({expr:g_expr, before:s_before}, {cram:b_cram, align:s_align_prior=null}) {
		const {
			s_pre,
			s_align_future,
		} = this.indents(s_before, s_align_prior, true);

		return {
			lint: [
				'(() => (',
				srcmap(g_expr.code, g_expr.loc),
				'))();\n',
			],
					// ${s_before? JSON.stringify(s_before)+',': ''}
					// (s_before? h_codify.verbatim({text:s_before, loc:g_expr.loc}, {}).meta: '')+
			meta: /* syntax: js */ `
				__JMACS_OUTPUT.push(
					${JSON.stringify(s_pre)},
					...__JMACS.srcmap(
						__JMACS.${b_cram? 'cram': 'indent'}(
							__JMACS.safe_exec(() => (${g_expr.code}), ${JSON.stringify(g_expr.code)})${b_cram? '': `, '${s_align_future || ''}'`}
						),
						${JSON.stringify(g_expr.loc)},
						'inline',
					));
			`,
		};
	},

	meta: ({meta:g_meta, line:b_line}, g_extras) => {
		return ({
			lint: [
				srcmap(g_meta.code, g_meta.loc, b_line? 'line': 'block'),
				'\n',
			],
			meta: g_meta.code,
		});
	},

	if(g, g_extras) {
		const {
			s_pre,
			s_align_future,
			s_strip,
		} = this.indents(g.before, g_extras.align, false);


		g_extras = {
			...g_extras,
			align: s_align_future,
		};

		// strip parts
		{
			// strip then
			strip_indent(g.then, s_strip);

			// strip else ifs
			g.elseifs.map(g_elseif => strip_indent(g_elseif, s_strip));

			// strip else
			if(g.else) strip_indent(g.else, s_strip);
		}

		// codify 'then' block
		let gc_then = this.codify(g.then, g_extras);

		let a_lint = [
			'if(',
			srcmap(g.if.code, g.if.loc),
			') {\n',
			gc_then.lint,
			'}\n',
		];

		let s_meta = /* syntax: js */ `
			__JMACS_OUTPUT.push(${JSON.stringify(s_pre)});
			if(__JMACS.safe_exec(() => (${g.if.code}), ${JSON.stringify(g.if.code)})) {
				${gc_then.meta}
			}`;

		for(let g_elseif of g.elseifs) {
			let gc_elseif_then = this.codify(g_elseif.then, g_extras);

			a_lint.push(...[
				'else if(',
				srcmap(g_elseif.if.code, g_elseif.if.loc),
				') {\n',
				...gc_elseif_then.lint,
				'}\n',
			]);

			s_meta += /* syntax: js */ `
				else if(__JMACS.safe_exec(() => (${g_elseif.if.code}), ${JSON.stringify(g_elseif.if.code)})) {
					${gc_elseif_then.meta}
				}`;
		}

		if(g.else) {
			let gc_else_then = this.codify(g.else, g_extras);

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

	global({def:g_def}, g_extras) {
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
			meta: /* syntax: js */ `${b_first? 'let ': ''}${s_var} = global['${s_var}'] ${s_oper} __JMACS.safe_exec(() => (${s_value}), ${JSON.stringify(s_value)});`,
		};
	},

	generator({expr:g_expr, before:s_before}, {align:s_align_prior}) {
		const {
			s_pre,
		} = this.indents(s_before, s_align_prior, true);

		return {
			lint: [
				'(function*() {\n',
				srcmap(g_expr.code, g_expr.loc),
				'})();\n',
			],
			meta: /* syntax: js */ `
				__JMACS_OUTPUT.push(
					${JSON.stringify(s_pre)},
					...(
						[...(function*() {
							${g_expr.code}
						})()]
							.reduce((a_nodes, w_node) => {
								a_nodes.push(
									...__JMACS.srcmap(
										w_node,
										${JSON.stringify(g_expr.loc)},
										'generator'
									)
								);
								return a_nodes;
							}, [])
					)
				);`,
		};
	},
};

class evaluator {
	constructor(g_state) {
		Object.assign(this, {
			state: g_state,
			context: vm.createContext({}),
			_s_indent: '\t',
		});
	}

	indents(s_before, s_align_prior, b_preserve_pre=false) {
		s_align_prior = s_align_prior || '';
		let s_align_future = s_align_prior;
		if(s_before && '\n' === s_before[0]) {
			s_align_future += /([ \t]*)$/.exec(s_before)[1];
			if(!b_preserve_pre) s_before = '\n';
		}

		return {
			s_pre: s_before+s_align_prior,
			// s_align_this: s_align_prior+s_align_future,
			s_align_future: s_align_future,
			s_strip: s_align_future+this._s_indent,
		};
	}

	codify(z_syntax, g_extras={}) {
		if(Array.isArray(z_syntax)) {
			let a_codified = [];
			let g_prev = null;
			let g_save = null;

			let b_nws = false;
			for(let g_node of z_syntax) {
				if(b_nws) {
					// codify non-whitespace
					a_codified.push(this.codify(g_node, g_extras));
				}
				else if('whitespace' === g_node.type) {
					g_save = g_node;
				}
				else {
					// include previous whitespace after newline
					if(g_save) {
						a_codified.push(this.codify(Object.assign(g_save, {
							text: g_save.text,
						}), g_extras));
					}

					// codify non-whitespace
					a_codified.push(this.codify(g_node, g_extras));

					//
					b_nws = true;
				}

				g_prev = g_node;
			}

			let a_lint = [];
			let a_meta = [];
			let a_deps = [];

			for(let g_node of a_codified) {
				if(g_node.lint) a_lint.push(...g_node.lint);
				a_meta.push(g_node.meta);
				if(g_node.deps) a_deps.push(...g_node.deps);
			}

			return {
				lint: a_lint,
				meta: a_meta.join('\n'),
				deps: [...new Set(a_deps)],
			};
		}
		else {
			let f_codifier = h_codify[z_syntax.type];
			if(!f_codifier) {
				throw new Error(`codifier not exist: ${z_syntax.type}`);
			}
			return f_codifier.apply(this, [z_syntax, g_extras]);
		}
	}

	run(s_code) {
		let h_module = {exports:{}};
		let h_nodejs_env = {
			__dirname: this.state.cwd,
			__filename: this.state.path,
			exports: h_module.exports,
			module: h_module,
			require: (s_package) => {
				// already in cache
				if('source-map' === s_package) return sourcemap;

				// resolve to path
				let p_require = require.resolve(s_package, {
					paths: [
						path.dirname(this.state.path),
					],
				});

				// load module
				return require(p_require);  // eslint-disable-line global-require
			},
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

const gobble = (s_text, s_indent='') => {
	let m_pad = /^(\s+)/.exec(s_text.replace(/^([ \t]*\n)/, ''));
	if(m_pad) {
		return s_indent+s_text.replace(new RegExp(`\\n${m_pad[1]}`, 'g'), '\n'+s_indent.trim()).trim();
	}
	else {
		return s_indent+s_text.trim();
	}
};

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

		let s_eval = gobble(/* syntax: js */ `
			const __JMACS_OUTPUT = [];

			const __JMACS = {
				R_IDENTIFIER_SAFE: ${R_IDENTIFIER_SAFE},

				sourcemap: require('source-map'),

				output: class {
					constructor(a_output) {
						this[__JMACS.is_output] = true;
						this.output = a_output;
					}

					valueOf() {
						return this.output.map(z => z+'').join('');
					}

					toString() {
						return this.valueOf();
					}
				},

				is_output: '**IS_JMACS_OUTPUT**',

				stringify(z_code, g_loc=null) {
					switch(typeof z_code) {
						case 'undefined': {
							debugger;
							throw new Error(\`refusing to serialize undefined\${g_loc? \` @\${g_loc.first_line}:\${g_loc.first_column} - \${g_loc.last_line}\${g_loc.last_column}\`: ''}\`);
						}

						case 'string': return \`'\${z_code}'\`;

						case 'number':
						case 'boolean':
							return z_code+'';

						case 'function': {
							return z_code.toString();
						}

						case 'object': {
							// jmacs output
							if(z_code instanceof __JMACS.output) return z_code+'';

							// array
							if(Array.isArray(z_code)) return \`[\${z_code.map(z => __JMACS.stringify(z)).join(', ')}]\`;

							// regular expression
							if(z_code instanceof RegExp) return z_code.toString();

							// other type of object
							switch(z_code.toString()) {
								case '[object Map]': {
									let hm_code = z_code;
									let a_items = [];
									for(let [zi_key, z_item] of hm_code) {
										a_items.push(\`[\${__JMACS.stringify(zi_key)}, \${__JMACS.stringify(z_item)}]\`);
									}
									return /* syntax: js */ \`new Map([\${a_items.join(', ')}])\`;
								}

								case '[object Set]': {
									let as_code = z_code;
									let a_items = [];
									for(let z_item of as_code) {
										a_items.push(__JMACS.stringify(z_item));
									}
									return /* syntax: js */ \`new Set([\${a_items.join(', ')}])\`;
								}

								case '[object Object]': {
									let h_object = z_code;
									let s_object = '{';
									for(let s_key in h_object) {
										if(__JMACS.R_IDENTIFIER_SAFE.test(s_key)) s_object += s_key+':';
										else s_object += \`'\${s_key.replace(/'/g, '\\\\\\'')}':\`;

										s_object += __JMACS.stringify(h_object[s_key])+', ';
									}

									return s_object+'}';
								}

								default: break;
							}

							break;
						}

						default: break;
					}

					throw new Error(\`not sure how to serialize object: \${z_code}\`);

					// return util.inspect(z_code, {
					// 	depth: Infinity,
					// 	customInspect: false,
					// 	maxArrayLength: Infinity,
					// 	breakLength: Infinity,

					// });
				},

				indent(z_code, s_indent) {
					if(!s_indent) return z_code;

					return (z_code+'').split(/\\n/g).map((s, i) => (i? s_indent: '')+s).join('\\n');
				},

				srcmap: (z_code, g_loc, s_name=null) => {
					if(z_code && z_code[__JMACS.is_output]) {
						return z_code.output;
					}

					let i_row = g_loc.first_line;
					let i_col = g_loc.first_column;

					let a_lines = 'string' === typeof z_code
						? z_code.split(/\\n/g)
						: __JMACS.stringify(z_code).split(/\\n/g);
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

				safe_exec: (__f, sjf_code, s_prev, c_depth=0) => {
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
								let sjf_reeval = \`
									let \${s_identifier} = global[\${JSON.stringify(s_identifier)}];
									return (\${__f.toString()})();
								\`;
								return __JMACS.safe_exec(new Function(sjf_reeval), sjf_reeval, '*'+s_identifier, c_depth+1);
							}

							// prevent infinite loop
							if(s_identifier === s_prev) {
								debugger;
								throw new Error(\`cannot use identifier \${s_identifier}\`);
							}

							// print
							console.warn(\`identifier was never declared: '\${s_identifier}'; automatically declaring as undefined\`);

							// re-evaluate
							let sjf_reeval = \`
								let \${s_identifier};
								return (\${__f.toString()})();
							\`;
							return __JMACS.safe_exec(new Function(sjf_reeval), sjf_reeval, s_identifier, c_depth+1);
						}
						else {
							debugger;
							throw new Error(\`execution error in meta-script while attempting to execute """\\n\${sjf_code}\\n"""... \\n\${e_append.message}\\n\${e_append.stack}\`);
						}
					}
				},

				cram: (z_code) => {
					return (z_code+'').replace(/\\s+/g, '');
				},
			};

			${g_codified.meta}

			return (() => {
				let ysn_output = (new __JMACS.sourcemap.SourceNode(null, null, null, __JMACS_OUTPUT))
					.toStringWithSourceMap();

				return {
					code: ysn_output.code,
					map: ysn_output.map.toString(),
				};
			})();
		`);

		return {
			exports: a_exports,

			meta: {
				deps: g_codified.deps,

				code: g_codified.meta,

				standalone: s_eval,

				lint: ysn_meta.toString(),

				consumer: () => new sourcemap.SourceMapConsumer(ysn_meta.toStringWithSourceMap().map.toString()),
			},

			run() {
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
