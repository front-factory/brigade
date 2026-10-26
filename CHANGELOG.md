# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.6.3](https://github.com/front-factory/brigade/compare/v1.6.2...v1.6.3) (2026-10-26)

### Bug Fixes

* **settings:** start the main session in plan mode ([ca4b585](https://github.com/front-factory/brigade/commit/ca4b585a00e7a89ae28e4eeeb28b95dc5e907b18))

## [1.6.2](https://github.com/front-factory/brigade/compare/v1.6.1...v1.6.2) (2026-10-26)

### Bug Fixes

* **options:** compute the commit format from the kit instead of storing it ([7061e14](https://github.com/front-factory/brigade/commit/7061e142d86fab5fad9c208b49f2fa3ae264189c))
* **options:** refresh derived commit format on update ([ad05adc](https://github.com/front-factory/brigade/commit/ad05adc0a9f1903cba49384d2f0a9ea139e0f5f7))
* **test:** use forward slashes in the update-vs-fresh-install test ([95129a6](https://github.com/front-factory/brigade/commit/95129a6a2bc44b87138ae1e0e3c7955a0e494ae2))

## [1.6.1](https://github.com/front-factory/brigade/compare/v1.6.0...v1.6.1) (2026-10-26)

### Performance

* **templates:** deny more noisy paths in settings ([7cce256](https://github.com/front-factory/brigade/commit/7cce256fefcd17d515e0e2719d1df300c10b6841))
* **templates:** trim injected context to save tokens ([09f9955](https://github.com/front-factory/brigade/commit/09f99557a660d07b06e207d41fec133851984e9c))
* **templates:** turn legacy settings commands into thin aliases ([4a3b3d3](https://github.com/front-factory/brigade/commit/4a3b3d3dada68f08f027f7016333a61cc7dcd974))

## [1.6.0](https://github.com/front-factory/brigade/compare/v1.5.1...v1.6.0) (2026-10-25)

### Features

* **commands:** add /brigade-settings ([e32cbdc](https://github.com/front-factory/brigade/commit/e32cbdc7d630daef7d34a54a1ea4dd536a4c0506))
* **options:** default replies to English and offer ten languages ([b83695f](https://github.com/front-factory/brigade/commit/b83695fe4d01794e30def731a8db3ad6a9f6ef0d))

### Bug Fixes

* **git-guard:** ask on unknown git writes and allow more reads ([0a4c37f](https://github.com/front-factory/brigade/commit/0a4c37f9d2afa92096965c574c6c7986f8db8f15))
* **rules:** require the audit file when reporting review findings ([2518395](https://github.com/front-factory/brigade/commit/2518395ec1033f1cdcfa44aa5677924cfe5fe8e8))

## [1.5.1](https://github.com/front-factory/brigade/compare/v1.5.0...v1.5.1) (2026-10-23)

### Bug Fixes

* **conventions:** align angular and gitmoji formats with their specs ([9470991](https://github.com/front-factory/brigade/commit/9470991b5139120b1d3f02f5a3813af680746a7c))
* **conventions:** align the conventional format with the 1.0.0 spec ([9ff840e](https://github.com/front-factory/brigade/commit/9ff840e5ac1fa8930da095c871a9b13f2ee11dba))

## [1.5.0](https://github.com/front-factory/brigade/compare/v1.4.0...v1.5.0) (2026-10-23)

### Features

* **commands:** add /brigade-reference-branch ([09253c1](https://github.com/front-factory/brigade/commit/09253c1a7e622329b41f42e0fcff9eedb02742e4))
* **hooks:** let a developer lift the reference branch guard ([ff73a87](https://github.com/front-factory/brigade/commit/ff73a878653383f01f740504a04b600d5d5d878d))

### Bug Fixes

* **brigade:** record run-node.sh in the manifest ([0b870fc](https://github.com/front-factory/brigade/commit/0b870fc8a5293103c048f3d08909af6d3aa303d7))
* **hooks:** find node outside the interactive PATH ([72a62db](https://github.com/front-factory/brigade/commit/72a62db2d71a07f10119f7bf1d3468a465e093d2))
* **hooks:** run the launcher tests on Windows ([fc8707c](https://github.com/front-factory/brigade/commit/fc8707cd8bf3c6e89c5a28f11d4654e950745433))

## [1.4.0](https://github.com/front-factory/brigade/compare/v1.3.0...v1.4.0) (2026-10-23)

### Features

* **hooks:** show Brigade version in status line and session start ([ce8502c](https://github.com/front-factory/brigade/commit/ce8502c3b6dff0b202f1f44550ecca1cc303f460))

## [1.3.0](https://github.com/front-factory/brigade/compare/v1.2.2...v1.3.0) (2026-10-23)

### Features

* **cli:** preview the update and add --dry-run ([898d44e](https://github.com/front-factory/brigade/commit/898d44e78529ffd9e07218b7e27e7d9add3a6eab))
* **install:** merge edited kit files from a stored base copy ([fe60047](https://github.com/front-factory/brigade/commit/fe60047309d017e9dc47c4d5971bf14b59cbf5d1))
* **install:** remove obsolete kit files and merge settings.json ([9e9c19d](https://github.com/front-factory/brigade/commit/9e9c19d11b4dce42bcb58876ba25de54ebd27cd7))
* **merge:** add a line-based three-way merge ([5ed1c76](https://github.com/front-factory/brigade/commit/5ed1c76fe41589245d192fa87bf4190b06295db7))

### Bug Fixes

* **guard:** catch git behind wrappers, groups and dynamic subcommands ([032c9db](https://github.com/front-factory/brigade/commit/032c9dbdb8d70e9992747303dfc7575953b49f9c))
* **install:** reject unknown package managers and escape JSON values ([7a15406](https://github.com/front-factory/brigade/commit/7a1540699d2f819848b4d2c4e6b298d391c26ade))

## [1.2.2](https://github.com/front-factory/brigade/compare/v1.2.1...v1.2.2) (2026-10-22)

### Bug Fixes

* **cli:** refuse a blank custom commit format ([9aaf62e](https://github.com/front-factory/brigade/commit/9aaf62e54fba97f36ec47495989d3067c7659254))

## [1.2.1](https://github.com/front-factory/brigade/compare/v1.2.0...v1.2.1) (2026-10-22)

### Bug Fixes

* **cli:** append ignore lines without a heading ([ca78cb6](https://github.com/front-factory/brigade/commit/ca78cb6f9de622379b560964634fcf5b3e5d575a))
* **hooks:** analyse nested git commands in the guard ([5c7d3f0](https://github.com/front-factory/brigade/commit/5c7d3f05e08f5cc9b00a15b33e66ecd81a21354d))
* **hooks:** ask when the guard payload is unreadable ([65c6222](https://github.com/front-factory/brigade/commit/65c6222976bed0f05e2d69d96662204c0241bdf7))
* **hooks:** ask when the protected branches are unknown ([72189f7](https://github.com/front-factory/brigade/commit/72189f70b1d7c8136ed736b658669041422bfd8d))
* **hooks:** skip git global options in the guard ([5ceb1e2](https://github.com/front-factory/brigade/commit/5ceb1e21fbc53ac0c8cacfbfe193ada5e53f35d9))
* **kit:** deny reading the Bun lockfiles ([817be0d](https://github.com/front-factory/brigade/commit/817be0d4ba52872493acf3971f3dcffb56505069))
* **version:** compare pre-release tags in compareVersions ([fc498fb](https://github.com/front-factory/brigade/commit/fc498fbcc2a4ab17ea5687143f945d2abe3bbc1a))

## [1.2.0](https://github.com/front-factory/brigade/compare/v1.1.1...v1.2.0) (2026-10-21)

### Features

* **cli:** add express setup with editable recap and styled output ([b41e99c](https://github.com/front-factory/brigade/commit/b41e99ca1af5600340c192ff77bef64f21eab96c))
* **install:** move project options to a generated brigade-options.md ([06bf2e6](https://github.com/front-factory/brigade/commit/06bf2e62b0552a66613ad7610264e5a77a1f29fd))

### Bug Fixes

* **test:** drop FORCE_COLOR in ui tests ([c438957](https://github.com/front-factory/brigade/commit/c438957b332f224f0fa26fe2361164e6b9a7c6b8))
* **test:** pin the locale in the install tests ([506c72b](https://github.com/front-factory/brigade/commit/506c72b4c21931f5fb3b9e607501e59c1522ae0d))

## [1.1.1](https://github.com/front-factory/brigade/compare/v1.1.0...v1.1.1) (2026-10-21)

### Bug Fixes

* **cli:** warn when the manifest is lost and share it ([232300c](https://github.com/front-factory/brigade/commit/232300c583bfd84fe7187d3910eba197d5320470))
* **install:** write architecture.md once and never propose over it ([5171fec](https://github.com/front-factory/brigade/commit/5171fecca6ab1be3778010b12ad6d13ed3e3fd4c))

## [1.1.0](https://github.com/front-factory/brigade/compare/v1.0.0...v1.1.0) (2026-10-21)

### Features

* **cli:** make the install atomic and harden the CLI ([1eec657](https://github.com/front-factory/brigade/commit/1eec65721fe5bdf42e39315a70c2183967b6112f))
* **cli:** update without asking again, only ask new options ([7ecf490](https://github.com/front-factory/brigade/commit/7ecf4908a011e3bb8cfda9227a5d2d99991ec0ca))

## 1.0.0 (2026-10-21)

### Features

* add the brigade init CLI and the web kit ([23710f7](https://github.com/front-factory/brigade/commit/23710f7ae56a53cae26ac052d77f7574a3ccea1c))
* **kit:** add the skills, context folder and feature workflow ([0ae172d](https://github.com/front-factory/brigade/commit/0ae172df3784717cb795aa78d3388698457ba86d))
