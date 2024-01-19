const clear = require('clear');
const eslint = require('gulp-eslint');
const notify = require('gulp-notify');
const { series, src, dest, watch } = require('gulp');

const watchlist = [
  './*.js',
  './test/*.js',
  './components/*.js',
  // ignore these files
  '!./gulpfile.js'
];

function reportLintErrors(details) {
  let errorMessages = [];

  if (!(details && details.eslint && details.eslint.messages)) {
    return;
  } else if (details.eslint.messages.length === 0) {
    return;
  }

  details.eslint.messages.forEach(error => {
    errorMessages.push(`${error.message} at line ${error.line} column ${error.column}`);
  })

  return notify.onError({
    title: 'JavaScript error',
    message: `Location: ${details.relative} ${errorMessages.join('\n')}`
  })(details);
}

// define tasks to run

function clean(done) {
  clear();
  // could do other cleanup here
  done();
}

function lint(done) {
  src(watchlist)
    .pipe(eslint())
    .pipe(notify(reportLintErrors)) // called for each linted file
    .pipe(eslint.format());
    // .pipe(eslint.failAfterError()); // keep checking
  
  done();
}

watch(watchlist, series(clean, lint));

exports.lint = lint; // run using `gulp lint`
exports.default = series(clean, lint); // run using `gulp`
