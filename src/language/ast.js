
const assembler = require('./assembler');

module.exports = {

	push(a_list, z_item) {
		if(undefined === z_item && !a_list.length) return a_list;
		a_list.push(z_item);
		return a_list;
	},

	append(a_appendage, a_primary) {
		return a_primary.concat(a_appendage);
	},

	merge(h_a, h_b) {
		for(let s_key in h_a) {
			h_b[s_key] = h_a[s_key];
		}
		return h_b;
	},

	option(h_pass, z_if, s_key) {
		if(z_if) h_pass[s_key] = true;
		return h_pass;
	},

	Inline: (s_code, b_suppress) => ({
		type: 'inline',
		code: s_code,
		suppress: b_suppress,
	}),

	Macro: (s_def, a_body, b_crammed=false) => {
		if(b_crammed) {
			a_body = a_body.map((g) => {
				if('verbatim' === g.type) {
					g.value = g.value.replace(/(\s|\r?\n)+/g, '');
				}

				return g;
			});
		}

		return {
			type: 'macro',
			macro: s_def,
			body: a_body,
			crammed: b_crammed,
		};
	},

	Global: (s_code) => ({
		type: 'global',
		code: s_code,
	}),

	Generator: (s_code) => ({
		type: 'generator',
		code: s_code,
	}),

	If: (s_condition, a_then_body, a_elseifs, a_else_body) => ({
		type: 'if',
		if: s_condition,
		then: a_then_body,
		elseifs: a_elseifs,
		else: a_else_body,
	}),

	Elseif: (s_condition, a_then_body) => ({
		type: 'elseif',
		if: s_condition,
		then: a_then_body,
	}),

	Import: (h_file) => ({
		type: 'import',
		file: h_file,
	}),

	Verbatim: (s_verbatim) => ({
		type: 'verbatim',
		value: s_verbatim,
	}),

	Program: (a_sections) => assembler(a_sections),
};
