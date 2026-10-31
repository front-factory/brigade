#!/usr/bin/env node
if (Number(process.versions.node.split('.')[0]) < 22) {
    console.error(`brigade: Node 22 or newer is required (this is ${process.versions.node}).`);
    process.exit(1);
}

const { main } = await import('../src/cli.js');

process.exitCode = await main(process.argv.slice(2));
