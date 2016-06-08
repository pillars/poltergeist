var fs          = require('fs')
var path        = require('path')
var gulp        = require('gulp')
var gutil       = require('gulp-util')
var assign      = require('object-assign')
var through     = require('through2')
var runSequence = require('run-sequence')
var dotenv      = require('dotenv').config()

// Project plugins
var autoprefixer     = require('gulp-autoprefixer')
var awspublish       = require('gulp-awspublish')
var clean            = require('gulp-clean')
var cloudfront       = require('gulp-cloudfront-invalidate-aws-publish')
var collect          = require('gulp-rev-collector')
var concat           = require('gulp-concat')
var frontMatter      = require('gulp-front-matter')
var htmlmin          = require('gulp-htmlmin')
var imagemin         = require('gulp-imagemin')
var marked           = require('marked')
var minifyCss        = require('gulp-minify-css')
var nunjucks         = require('nunjucks')
var nunjucksMarkdown = require('nunjucks-markdown')
var pngquant         = require('imagemin-pngquant')
var rename           = require('gulp-rename')
var replace          = require('gulp-replace-task')
var rev              = require('gulp-rev')
var sass             = require('gulp-sass')
var uglify           = require('gulp-uglify')
var webserver        = require('gulp-webserver')

// Configuration
var buildPath  =  'build'
var srcPath    = 'src'
var assetsPath = srcPath + '/assets'
var site       = require('./' + srcPath + '/site.json')
site.time = new Date()



// Templates
// ---------

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pendantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false
})

var nunjucksLoader = new nunjucks.FileSystemLoader([srcPath + '/templates'], {
  watch: false,
  noCache: false
})

var nunjucksEnv = new nunjucks.Environment(nunjucksLoader, {
  autoescape: false
})

nunjucksMarkdown.register(nunjucksEnv, marked)

var dateRegex = /(\d{4})-(\d{1,2})-(\d{1,2})-(.*)/

function filename2date() {
  return through.obj(
    function (file, enc, cb) {
      var name = path.dirname(file.path).split('/').pop()
      var matches = dateRegex.exec(name)
      if (matches) {
        var year  = matches[1]
        var month = matches[2]
        var day   = matches[3]
        var slug  = matches[4]
        file.frontMatter.date = new Date(year, month, day)
        file.frontMatter.url  = '/' + year + '/' + month + '/' + slug
      }
      this.push(file)
      cb()
    }
  )
}

function collectPosts() {
  var posts = site.posts || []
  var tags = site.tags || []
  return through.obj(
    function (file, enc, cb) {
      posts.push(file.frontMatter)
      posts[posts.length - 1].content = file.contents.toString()
      if (file.frontMatter.tags) {
        file.frontMatter.tags.forEach(function (tag) {
          if (tags.indexOf(tag) === -1) {
            tags.push(tag)
          }
        })
      }
      this.push(file)
      cb()
    },
    function (cb) {
      posts.sort(function (a, b) {
        return b.date - a.date
      })
      site.posts = posts
      site.tags = tags
      cb()
    }
  )
}

function nunjucksRender(file, contents, context, cb) {
  if (context.layout) {
    contents =
      '{% extends "' + context.layout + '" %}\n' +
      '{% block content %}' +
      contents +
      '{% endblock %}'
  }
  nunjucksEnv.renderString(contents, context, function (err, res) {
    if (err) {
      return cb(new PluginError('nunjucksRender', err, {showStack: true}))
    }
    file.contents = new Buffer(res)
    file.path = file.path.replace(/\.md$/, '.html')
    cb(null, file)
  })
}

function renderHTML() {
  return through.obj(
    function (file, enc, cb) {
      var contents
      var extension = file.path.split('.').pop()
      var context = assign({}, site, file.data || {}, file.frontMatter || {})

      if (extension === 'md') {
        context.layout = context.layout || 'layout.html'
        marked(file.contents.toString('utf8'), function (err, contents) {
          if (err) {
            return cb(new PluginError('renderHTML', err, {showStack: true}))
          }
          nunjucksRender(file, contents, context, cb)
        })
      }
      else {
        contents = file.contents.toString('utf8')
        nunjucksRender(file, contents, context, cb)
      }
    }
  )
}

gulp.task('templates:pages', function () {
  return gulp.src([
    srcPath + '/pages/**/*.html',
    srcPath + '/pages/**/*.md'
  ])
    .pipe(frontMatter({remove: true}))
    .pipe(renderHTML())
    .pipe(gulp.dest(buildPath))
})

gulp.task('templates:posts', function () {
  return gulp.src([
    srcPath + '/posts/**/*.html',
    srcPath + '/posts/**/*.md',
  ])
    .pipe(frontMatter({remove: true}))
    .pipe(filename2date())
    .pipe(collectPosts())
    .pipe(renderHTML())
    .pipe(rename(function (path) {
      var matches = dateRegex.exec(path.dirname)
      if (matches) {
        var year  = matches[1]
        var month = matches[2]
        var slug  = matches[4]
        path.dirname = year + '/' + month + '/' + slug
      }
    }))
    .pipe(gulp.dest(buildPath))
})

gulp.task('templates:compile', function (cb) {
  return runSequence(
    'templates:posts',
    'templates:pages',
    cb
  )
})

gulp.task('templates:optimize', function () {
  return gulp.src(buildPath + '/**/*.html')
  .pipe(htmlmin({
    collapseWhitespace: true,
    conservativeCollapse: true,
    minifyCSS: true,
    minifyJS: true
  }))
  .pipe(gulp.dest(buildPath))
})

gulp.task('templates:replace', function () {
  return replaceAssetsPath('*.html')
})

// gulp.task('templates:watch', function () {
//   gulp.watch(srcPath + '/templates/*.html', ['nunjucks:compile'])
// })



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



// dev & build
// -----------

gulp.task('default', function (cb) {
  return runSequence(
    'build:clean',
    [
      'styles:compile',
      'scripts:compile',
      'fonts:compile',
      'images:compile',
      'templates:compile'
    ],
    [
      'serve',
      'watch'
    ],
    cb
  )
})

gulp.task('watch', function () {
  gulp.watch(assetsPath + '/css/**/*.scss', ['styles:compile'])
  gulp.watch(assetsPath + '/js/**/*.js',    ['scripts:compile'])
  gulp.watch(assetsPath + '/fonts/**/*',    ['fonts:compile'])
  gulp.watch(assetsPath + '/images/**/*',   ['images:compile'])
  gulp.watch(
    [srcPath + 'posts/**/*.md', srcPath + 'pages/**/*.html'],
    ['templates:compile']
  )
})

gulp.task('build:optimize', function (cb) {
  return runSequence(
    'build:clean',
    [
      'styles:compile',
      'scripts:compile',
      'images:compile',
      'fonts:compile',
      'templates:compile'
    ],
    [
      'styles:optimize',
      'scripts:optimize',
      'images:optimize',
      'templates:optimize'
    ],
    cb
  )
})

gulp.task('build:version', function (cb) {
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
    'templates:replace',
    cb
  )
})

gulp.task('build:deploy', function (cb) {
  validateAWSConfig()
  runSequence(
    'build:optimize',
    'build:version',
    'build:gzip',
    'build:s3:publish:html',
    'build:s3:publish:assets',
    cb
  )
})

gulp.task('build:clean', function () {
  return gulp.src(buildPath, {read: false})
    .pipe(clean({force: true}))
})

gulp.task('serve', function () {
  return gulp.src(buildPath)
    .pipe(webserver())
})
