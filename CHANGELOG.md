# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
