/* globals describe it */
const assert = require('assert');
const deq = assert.deepStrictEqual;
const eq = (z_expect, z_actual) => {
	assert.strictEqual(z_actual, z_expect);
};

const jmacs = require('../../build/main/jmacs.js');


function compile(s_input, p_cwd='./') {
	let g_result = jmacs.compile({
		input: s_input,
		cwd: p_cwd,
	});

	let g_output;
	try {
		g_output = g_result.run();
	}
	catch(e_run) {
		throw new Error(`execution error in meta-script:\n${e_run.message}\n${e_run.stack}`);
	}

	let a_lines = g_output.code.trim().split(/\s*\n\s*/);
	if(1 === a_lines.length) return a_lines[0];
	return a_lines;
}

describe('parsing', () => {
	it('verbatim', () => {
		let s_verbatim = '';
		for(let i=32; i<127; i++) s_verbatim += 64 === i? '': String.fromCodePoint(i);
		eq(s_verbatim.trim(), compile(s_verbatim));
	});

	it('assignment and referencing', () => {
		eq('1 2 three', compile(`
			@.let one = 1;
			@.let two = 2;
			@.let three = 'three';
			@{one} @{two} @{three}
		`));
	});

	it('globals', () => {
		eq('1 2 three', compile(`
			@$ one = 1;
			@> scoped()
				@$ three = 'three';
				2
			@;
			@{one} @{scoped()} @{three}
		`).replace(/\t/g, ''));
	});


	it('operations', () => {
		eq('3 6 2 3 8 1 2 7 0', compile(`
			@{1 + 2} @{2 * 3} @{4 / 2} @{5 - 2} @{1 << 3} @{8 >> 3} @{16 >>> 3} @{5 | 2} @{6 & 1}
		`));
	});
});

describe('functions', () => {
	function call(s_method, ...a_args) {
		let s_script = `
			@$ hello = 'hello';

			@> exclaim(say='sup')
				@{say}!
			@;

			@> mutate(value)
				@$ hello = value;
			@;

			@> test_mutate(replace)
				@.mutate(replace)
				@{hello}
			@;

			@> flip(a, b)
				@{b} @{a}
			@;

			@{${s_method}(${a_args.join(', ')})}
		`;

		return compile(s_script);
	}

	it('default arg', () => {
		eq('sup!', call('exclaim'));
	});

	it('pass string arg', () => {
		eq('yes!', call('exclaim', `'yes'`));
	});

	it('pass concat expr arg', () => {
		eq('hello world!', call('exclaim', `hello+' world'`));
	});

	it('pass add expr arg', () => {
		eq('hi 2 u!', call('exclaim', `'hi '+(1+1)+' u'`));
	});

	// it('mutate', () => {
	// 	eq('goodbye', call('test_mutate', `'goodbye'`));
	// });

	it('two args', () => {
		eq('that this', call('flip', `'this'`, `'that'`));
	});
});


describe('logic', () => {
	function call(s_method, ...a_args) {
		return compile(`
			@> word(num)
				@- num == 1
					one
				@+ num == 2
					two
				@:
					nothing
				@;
			@;

			@{${s_method}(${a_args.join(', ')})}
		`);
	}

	it('ternary ?', () => {
		eq('1', compile('@{true? 1: 0}'));
	});

	it('if', () => {
		eq('one', call('word', '1'));
	});

	it('elseif', () => {
		eq('two', call('word', '2'));
	});

	it('else', () => {
		eq('nothing', call('word', '0'));
	});

	it('truthy', () => {
		eq('yes', compile(`@{'truthy'? 'yes': 'no'}`));
	});

	it('truthy negative', () => {
		eq('no', compile(`@{!'truthy'? 'yes': 'no'}`));
	});
});

describe('Math', () => {
	it('pi', () => {
		eq((Math.PI*2)+'', compile('@{Math.PI * 2}'));
	});

	it('floor', () => {
		eq('2', compile('@{Math.floor(10 / 4)}'));
	});

	it('ceil', () => {
		eq('3', compile('@{Math.ceil(10 / 4)}'));
	});
});

describe('String', () => {
	function call(s_method, ...a_args) {
		let s_script = `
			@$ word = 'hello';
			@{word.${s_method}(${a_args.join(',')})}
		`;

		return compile(s_script);
	}

	it('charAt', () => {
		eq('hello'.charAt(0), call('charAt', 0));
	});

	it('replace', () => {
		eq('hello'.replace('llo', 'y'), call('replace', `'llo'`, `'y'`));
	});
});

