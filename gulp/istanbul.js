module.exports = Object.assign(function(gulp, $, p_src, p_dest, f_done) {
	const instrumenter = require('isparta').Instrumentor;

	return gulp.src(p_dest+'/../**/*.js')
		.pipe($.istanbul({
			includeUntested: true,
			instrumenter,
		}))
		.pipe($.istanbul.hookRequire());
}, {
	dependencies: [
		'isparta',
		'gulp-istanbul',
	],
});
