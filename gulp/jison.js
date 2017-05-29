const fs = require('fs');

// module
module.exports = Object.assign(function(gulp, $, p_src, p_dest) {
	const glob = require('glob');
	const through = require('through2');

	const jison_generator = require('jison').Generator;
	const ebnf_parser = require('ebnf-parser');
	const lex_parser = require('lex-parser');

	// resolve lex file
	let p_lex_file = glob.sync(p_src+'/*.jisonlex')[0];

	// load jison source file
	return gulp.src(p_src+'/*.jison')

		// handle uncaught exceptions thrown by any of the plugins that follow
		.pipe($.plumber())

		// // do not recompile unchanged files
		// .pipe($.cached(this.task))

		// compile jison script
		.pipe(through.obj(function(d_file, s_encoding, f_done) {

			// no file
			if(d_file.isNull()) return f_done(null, d_file);

			// stream
			if(d_file.isStream()) return f_done(new $.util.PluginError('gulp-jison-parser', 'Streams not supported'));

			// try generating parser
			try {
				// ref file contents
				let s_contents = d_file.contents.toString();

				// parse jison grammer
				let h_grammar = ebnf_parser.parse(s_contents);

				//	read lex file
				let s_lex_contents = fs.readFileSync(p_lex_file, 'utf-8');

				// set lex option on grammar
				h_grammar.lex = lex_parser.parse(s_lex_contents);

				// pass grammer to jison to generate parser
				let s_parser = new jison_generator(h_grammar, {}).generate();

				// convert parser string to buffer
				d_file.contents = new Buffer(s_parser);

				// rename file extension
				d_file.path = $.util.replaceExtension(d_file.path, '.js');

				// add this file to stream
				this.push(d_file);
			}
			catch (err) {
				// Convert the keys so PluginError can read them
				err.lineNumber = err.line; err.fileName = err.filename;

				// Add a better error message
				err.message = `${err.message} in file ${err.fileName} line no. ${err.lineNumber}`;

				// throw error
				throw new $.util.PluginError('jison', err);
			}

			// done
			return f_done();
		}))

		// rename output file
		.pipe($.rename('parser.js'))

		// write output to dist directory
		.pipe(gulp.dest(p_dest));
}, {
	dependencies: [
		'glob',
		'through2',
		'jison',
		'ebnf-parser',
		'lex-parser',
		'gulp-plumber',
		'gulp-cached',
		'gulp-util',
		'gulp-rename',
	],
});
