module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            files: ['gruntfile.js', 'public/**/*.js'],
            options: {
                globals: {
                    jQuery: true
                },
                force: true,
                reporterOutput: 'jshint-reports.xml',
                reporter: 'checkstyle'
            }
        },
        jsdoc: {
            dist: {
                src: ['public/js/**/*.js'],
                options: {
                    destination: 'doc',
                    template: "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
                    configure: "conf/jsdoc.conf.json",
                    package: 'package.json',
                    recurse: true
                }
            }
        },
        nodewebkit: {
            options: {
                platforms: ['win32'],
                /*Where the build version of my node-webkit app is saved*/
                buildDir: './webkitbuilds',
                version: '0.12.3',
                winIco: './favicon.ico'
            },
            /*node-webkit app*/
            src: ['./public/**/*']
        },
        clean: {
            options: {
                force:true
            },
            build: {
                src: ["E:/webkitbuilds"]
            }
        },
        copy: {
            main: {
                files: [
                    {expand: true,cwd: './webkitbuilds/nw/win32/', src: ['**'], dest: 'E:/webkitbuilds/'},
                    {expand: true,cwd: 'E:/client/build/nwjs-v0.12.3-win-ia32/node_modules/', src: ['**'], dest: 'E:/webkitbuilds/node_modules/'}
                ]
            }
        },
        innosetup_compiler: {
            test: {
                options: {
                    gui: false,
                    verbose: false
                },
                script: 'E:/client/inno/setupTest.iss'
            },
            online: {
                options: {
                    gui: false,
                    verbose: false
                },
                script: 'E:/client/inno/setupRelease.iss'
            }
        },
        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-node-webkit-builder');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('innosetup-compiler');
    grunt.loadNpmTasks('grunt-jsdoc');

    grunt.registerTask('default', ['jshint', 'jsdoc', 'nodewebkit', 'clean', 'copy', 'innosetup_compiler']);


};