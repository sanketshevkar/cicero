#!/usr/bin/env node
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Logger = require('@accordproject/concerto-util').Logger;
const Commands = require('./lib/commands');

require('yargs')
    .scriptName('cicero')
    .usage('$0 <cmd> [args]')
    .demandCommand(1, '# Please specify a command')
    .recommendCommands()
    .strict()
    .command('verify', 'verify the template signatures of the template author/developer', (yargs) => {
        yargs.option('template', {
            describe: 'path to the template',
            type: 'string'
        });
        yargs.option('warnings', {
            describe: 'print warnings',
            type: 'boolean',
            default: false
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`verify the signature of author/developer of ${argv.template} template`);
        }

        try {
            argv = Commands.validateVerifyArgs(argv);
            const options = {
                warnings: argv.warnings,
            };
            return Commands.verify(argv.template, options)
                .then((result) => {
                    Logger.info(`Author/developer's signature for ${argv.template} template is verified`);
                })
                .catch((err) => {
                    Logger.error(err.message);
                });
        } catch (err){
            Logger.error(err.message);
            return;
        }
    })

    .command('archive', 'create a template archive', (yargs) => {
        yargs.option('template', {
            describe: 'path to the template',
            type: 'string'
        });
        yargs.option('target', {
            describe: 'the target language of the archive',
            type: 'string',
            default: 'ergo'
        });
        yargs.option('output', {
            describe: 'file name for new archive',
            type: 'string',
            default: null
        });
        yargs.option('warnings', {
            describe: 'print warnings',
            type: 'boolean',
            default: false
        });
        yargs.option('keystore', {
            describe: 'p12 keystore path',
            type: 'string',
            default: null
        });
        yargs.option('passphrase', {
            describe: 'p12 keystore passphrase',
            type: 'string',
            default: null
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`create an archive for ${argv.template}`);
        }

        try {
            argv = Commands.validateArchiveArgs(argv);
            let options = {};

            if (argv.keystore) {
                options = {
                    warnings: argv.warnings,
                    keystore: {
                        path: argv.keystore,
                        passphrase: argv.passphrase
                    }
                };
            } else {
                options = {
                    warnings: argv.warnings,
                };
            }
            return Commands.archive(argv.template, argv.target, argv.output, options)
                .catch((err) => {
                    Logger.error(err.message);
                });
        } catch (err){
            Logger.error(err.message);
            return;
        }
    })
    .command('compile', 'generate code for a target platform', (yargs) => {
        yargs.option('template', {
            describe: 'path to the template',
            type: 'string'
        });
        yargs.option('target', {
            describe: 'target of the code generation',
            type: 'string',
            default: 'JSONSchema'
        });
        yargs.option('output', {
            describe: 'path to the output directory',
            type: 'string',
            default: './output/'
        });
        yargs.option('warnings', {
            describe: 'print warnings',
            type: 'boolean',
            default: false
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`compile template ${argv.template} for target ${argv.target}`);
        }

        try {
            argv = Commands.validateCompileArgs(argv);
            const options = {
                warnings: argv.warnings,
            };
            return Commands.compile(argv.template, argv.target, argv.output, options)
                .then((result) => {
                    Logger.info('Completed.');
                })
                .catch((err) => {
                    Logger.error(err.message + ' ' + JSON.stringify(err));
                });
        } catch (err){
            Logger.error(err.message);
            return;
        }
    })
    .command('get', 'save local copies of external dependencies', (yargs) => {
        yargs.option('template', {
            describe: 'path to the template',
            type: 'string'
        });
        yargs.option('output', {
            describe: 'output directory path',
            type: 'string'
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`saving external models into directory: ${argv.output}`);
        }

        try {
            argv = Commands.validateGetArgs(argv);
            return Commands.get(argv.template, argv.output)
                .then((result) => {
                    Logger.info(result);
                })
                .catch((err) => {
                    Logger.error(err.message);
                });
        } catch (err){
            Logger.error(err.message);
            return;
        }
    })
    .option('verbose', {
        alias: 'v',
        default: false
    })
    .help()
    .argv;