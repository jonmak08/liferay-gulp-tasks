'use strict';

var cheerio = require('gulp-cheerio');
var del = require('del');
var maven = require('gulp-maven-deploy');
var path = require('path');
var prompt = require('gulp-prompt');
var runSequence = require('run-sequence');

module.exports = function(gulp, opt_options) {
	var options = opt_options || {};
	options.artifactIdPrefix = options.artifactIdPrefix || 'com.liferay.webjars.';
	options.artifactSrc = options.artifactSrc || ['**/*', '!node_modules/', '!node_modules/**'];
	options.packageJsonPath = path.resolve(options.packageJsonPath || 'package.json');
	options.repositories = options.repositories || {
		releases: [
			{
				'id': 'liferay-public-releases',
				'url': 'https://repository.liferay.com/nexus/content/repositories/liferay-public-releases/'
			}
		],
		snapshots: [
			{
				'id': 'liferay-public-snapshots',
				'url': 'https://repository.liferay.com/nexus/content/repositories/liferay-public-snapshots/'
			}
		]
	};

	var getFinalName = function(config) {
		return getName() + '-' + getVersion(config);
	};

	var getName = function() {
		return options.artifactName || require(options.packageJsonPath).name;
	};

	var getVersion = function(config) {
		var version = require(options.packageJsonPath).version;
		var snapshot = '-SNAPSHOT-' + Date.now();

		return (config && config.snapshot) ? version + snapshot : version;
	};

  var webjarPath;

	gulp.task('clean-maven-dist', function(callback) {
		del('maven-dist').then(function() {
			callback();
		});
	});

	gulp.task('prepare-maven-snapshot', function() {
		return gulp.src(options.artifactSrc)
			.pipe(gulp.dest(
				path.join('maven-dist/META-INF/resources/webjars', getName(), getVersion({snapshot: true}))
		));
	});

	gulp.task('install-maven-snapshot', function() {
		var snapshotConfig = { snapshot: true };

		return gulp.src('.')
			.pipe(maven.install({
				'config': {
					'artifactId': options.artifactIdPrefix + getName(),
					'buildDir': 'maven-dist',
					'finalName': getFinalName(snapshotConfig),
					'groupId': 'com.liferay.webjars',
					'type': 'jar',
					'version': getVersion(snapshotConfig)
				}
		}));
	});

	gulp.task('prepare-maven-artifact', function() {
		return gulp.src(options.artifactSrc)
			.pipe(gulp.dest(
				path.join('maven-dist/META-INF/resources/webjars', getName(), getVersion())
		));
	});

	gulp.task('publish-maven-artifact', function() {
		return gulp.src('.')
			.pipe(maven.deploy({
				'config': {
					'artifactId': options.artifactIdPrefix + getName(),
					'buildDir': 'maven-dist',
					'finalName': getFinalName(),
					'groupId': 'com.liferay.webjars',
					'type': 'jar',
					'version': getVersion(),
					'repositories': options.repositories.releases
				}
		}));
	});

	gulp.task('publish-maven-snapshot', function() {
		var snapshotConfig = { snapshot: true };

		return gulp.src('.')
			.pipe(maven.deploy({
				'config': {
					'artifactId': options.artifactIdPrefix + getName(),
					'buildDir': 'maven-dist',
					'finalName': getFinalName(snapshotConfig),
					'groupId': 'com.liferay.webjars',
					'type': 'jar',
					'version': getVersion(snapshotConfig),
					'repositories': options.repositories.snapshots
				}
		}));
	});

	gulp.task('maven-init', function() {
		var homeDir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

		return gulp.src('./node_modules/liferay-gulp-tasks/settings.xml')
			.pipe(prompt.prompt(
				[
					{
						type: 'input',
						message: 'PLEASE DEFINE THE FULL PATH WHERE YOU WANT TO CREATE THE WEBJAR: ',
						name: 'webjarPath'
					}
				],
				function(response) {
					webjarPath = response.webjarPath;
				}
		))
		.pipe(cheerio({
			run: function ($, file) {
				$('localRepository').text(webjarPath);
			},
			parserOptions: {
				xmlMode: true
			}
		}))
		.pipe(gulp.dest(path.resolve(homeDir, '.m2')));
	});

	gulp.task('maven-install', function(done) {
		runSequence('maven-init', 'prepare-maven-snapshot', 'install-maven-snapshot', 'clean-maven-dist', done);
	});

	gulp.task('maven-publish', function(done) {
		runSequence('prepare-maven-artifact', 'publish-maven-artifact', 'clean-maven-dist', done);
	});

	gulp.task('maven-publish-snapshot', function(done) {
		runSequence('prepare-maven-snapshot', 'publish-maven-snapshot', 'clean-maven-dist', done);
	});

	return gulp;
};
