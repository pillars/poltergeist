var fs          = require('fs')
var gulp        = require('gulp')
var runSequence = require('run-sequence')
var dotenv      = require('dotenv').config()

// Project plugins
var webserver      = require('gulp-webserver')
var rev            = require('gulp-rev')
var sass           = require('gulp-sass')
var clean          = require('gulp-clean')
var concat         = require('gulp-concat')
var replace        = require('gulp-replace-task')
var collect        = require('gulp-rev-collector')
var imagemin       = require('gulp-imagemin')
var pngquant       = require('imagemin-pngquant')
var uglify         = require('gulp-uglify')
var minifyCss      = require('gulp-minify-css')
var htmlmin        = require('gulp-htmlmin')
var awspublish     = require('gulp-awspublish')
var cloudfront     = require('gulp-cloudfront-invalidate-aws-publish')
var autoprefixer   = require('gulp-autoprefixer')
var nunjucksRender = require('gulp-nunjucks-render')

// Configuration
var buildPath  =  'build'
var srcPath = 'src'
var assetsPath = srcPath + '/assets'

gulp.task(
  'default',
  [
    'styles:compile',
    'scripts:compile',
    'fonts:compile',
    'images:compile',
    'html:compile',
    'serve'
  ],
  function () {
    gulp.watch(assetsPath + '/css/**/*.scss', ['styles:compile'])
    gulp.watch(assetsPath + '/js/**/*.js',    ['scripts:compile'])
    gulp.watch(assetsPath + '/fonts/**/*',    ['fonts:compile'])
    gulp.watch(assetsPath + '/images/**/*',   ['images:compile'])
    gulp.watch(srcPath + '/**/*.html',        ['html:compile'])
  }
)

gulp.task('build:optimize', function (callback) {
  return runSequence(
    'clean',
    [
      'styles:compile',
      'scripts:compile',
      'images:compile',
      'fonts:compile',
      'html:compile'
    ],
    [
      'styles:optimize',
      'scripts:optimize',
      'images:optimize',
      'html:optimize'
    ],
    callback
  )
})

gulp.task('build:version', function (callback) {
  // Versionning is done in multiple steps:
  // 1. images and fonts are used in css so we version them first
  // 2. we replace the new path for fonts and images in css and js
  // 3. because of step 2, css and js changes, now we version them
  // 4. we replace the new path for css and images in html
  // 5. we version html via Cloudfront cache invalidation
  return runSequence(
    [
      'images:version',
      'fonts:version'
    ],
    [
      'styles:replace',
      'scripts:replace'
    ],
    [
      'styles:version',
      'scripts:version'
    ],
    'html:replace',
    callback
  )
})

gulp.task('build:deploy', function (callback) {
  validateAWSConfig()
  runSequence(
    'build:optimize',
    'build:version',
    'build:gzip',
    'build:s3:publish:html',
    'build:s3:publish:assets',
    callback
  )
})

gulp.task('serve', function () {
  return gulp.src(buildPath)
    .pipe(webserver())
})

gulp.task('clean', function () {
  return gulp.src(buildPath, {read: false})
    .pipe(clean({force: true}))
})


// Styles
// ------

gulp.task('styles:compile', function () {
  return gulp.src(assetsPath + '/css/styles.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      browsers: ['last 2 versions'],
      cascade: false
    }))
    .pipe(gulp.dest(buildPath + '/css'))
})

gulp.task('styles:optimize', function () {
  return gulp.src(buildPath + '/css/styles.css')
    .pipe(minifyCss())
    .pipe(gulp.dest(buildPath + '/css'))
})

gulp.task('styles:version', function () {
  return version('css/')
})

gulp.task('styles:replace', function () {
  return replaceAssetsPath('*.css')
})


// Scripts
// -------

gulp.task('scripts:compile', function () {
  return gulp.src(assetsPath + '/js/scripts.js')
    .pipe(concat('scripts.js'))
    .pipe(gulp.dest(buildPath + '/js'))
})

gulp.task('scripts:optimize', function () {
  return gulp.src(buildPath + '/js/scripts.js')
    .pipe(uglify())
    .pipe(gulp.dest(buildPath + '/js/'))
})

gulp.task('scripts:version', function () {
  return version('js/')
})

gulp.task('scripts:replace', function () {
  return replaceAssetsPath('*.js')
})



// Images
// -------

gulp.task('images:compile', function () {
  return gulp.src(assetsPath + '/images/**/*')
    .pipe(gulp.dest(buildPath + '/images'))
})

gulp.task('images:optimize', function () {
  return gulp.src(buildPath + '/images/**/*')
    .pipe(imagemin({
      progressive: true,
      svgoPlugins: [{removeViewBox: false}],
      use: [pngquant()]
    }))
    .pipe(gulp.dest(buildPath + '/images'))
})

gulp.task('images:version', function () {
  return version('images/')
})



// Fonts
// -----

gulp.task('fonts:compile', function () {
  return gulp.src(assetsPath + '/fonts/**/*')
    .pipe(gulp.dest(buildPath + '/fonts'))
})

gulp.task('fonts:version', function () {
  return version('fonts/')
})



// Templates
// ---------

gulp.task('html:compile', function () {
  return gulp.src([
    srcPath + '/**/*.html',
    '!' + srcPath + '/templates/**/*'
  ])
    .pipe(nunjucksRender({
      path: [srcPath + '/templates']
    }))
    .pipe(gulp.dest(buildPath))
})

gulp.task('html:optimize', function () {
  return gulp.src(buildPath + '/**/*.html')
    .pipe(htmlmin({
      collapseWhitespace: true,
      conservativeCollapse: true,
      minifyCSS: true,
      minifyJS: true
    }))
    .pipe(gulp.dest(buildPath))
})

gulp.task('html:replace', function () {
  return replaceAssetsPath('*.html')
})



// versioning
// -----------

function version(assetFolder) {
  assetFolder = assetFolder || ''
  return gulp.src(buildPath + '/' + assetFolder + '**/*')
    .pipe(rev())
    .pipe(gulp.dest(buildPath + '/' + assetFolder))
    .pipe(rev.manifest({
      merge: true
    }))
    .pipe(gulp.dest(srcPath))
}

function replaceAssetsPath(assetType) {
  assetType = assetType || '*'
  var url = validateENV('PRODUCTION_ASSET_URL')

  return gulp.src([
    srcPath + '/rev-manifest.json',
    buildPath + '/**/' + assetType
  ])
    .pipe(collect({
      replaceReved: true,
      dirReplacements: {
        '/': url + '/',
        '/css': url + '/css',
        '/js': url + '/js'
      }
    }))
    .pipe(gulp.dest(buildPath))
}


// S3
// --

gulp.task('build:gzip', function () {
  return gulp.src([
      '!' + buildPath + '/**/*.gz',
      buildPath + '/**/*'
    ])
    .pipe(awspublish.gzip({ ext: '.gz' }))
    .pipe(gulp.dest(buildPath))
})

var publisher = awspublish.create({
  region: process.env.AWS_REGION,
  params: {
    Bucket: process.env.S3_BUCKET
  }
})

var headers = {
  'Cache-Control': 'max-age=31536000, no-transform, public'
}

function validateENV(variable) {
  if (!process.env[variable]) {
    console.log('Error: could not deploy. ' + variable + ' ENV variable is missing.')
    process.exit(1)
  }
  return process.env[variable]
}

function validateAWSConfig() {
  validateENV('AWS_ACCESS_KEY_ID')
  validateENV('AWS_SECRET_ACCESS_KEY')
  validateENV('AWS_REGION')
  validateENV('S3_BUCKET')
  validateENV('CLOUDFRONT_DISTRIBUTION')
}

gulp.task('build:s3:publish:html', function () {
  validateAWSConfig()
  return gulp.src(buildPath + '/**/*.{html,html.gz}')
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe(awspublish.reporter())
    .pipe(cloudfront({
      distribution: process.env.CLOUDFRONT_DISTRIBUTION
    }))
})

gulp.task('build:s3:publish:assets', function () {
  validateAWSConfig()
  return gulp.src([
    '!' + buildPath + '/**/*.{html,html.gz}',
    buildPath + '/**'
  ])
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe(awspublish.reporter())
})
