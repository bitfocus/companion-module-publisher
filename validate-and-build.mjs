// #!/usr/bin/env zx

import semver from 'semver'

const moduleName = argv._[1] // TODO - does this need some light parsing?
const tagName = argv._[2]

if (!moduleName || !tagName) {
	console.error(`Missing required arguments`)
	process.exit(1)
}

try {
	await $`git -C module show-ref -q --verify "refs/tags/${tagName}" 2>/dev/null`
} catch (e) {
	console.error(`Ref "${tagName}" is not a valid tag`)
	process.exit(1)
}

const pkgJsonStr = await fs.readFile('./module/package.json')
const pkgJson = JSON.parse(pkgJsonStr)

if (pkgJson.name !== `@companion-module/${moduleName}`) {
console.error(`Name in package does not match environment (Got "${pkgJson.name}", expected "@companion-module/${moduleName}")`)
	process.exit(1)
}

if (!semver.eq(pkgJson.version, tagName)) {
	console.error(`Version in package does not match tag (Got "${pkgJson.version}", expected "${tagName}")`)
	process.exit(1)
}

console.log('Looks OK to release')

let scriptName = null
if (pkgJson.scripts) {
	// Find the first known build script name
	const candidateScripts = ['companion:build', 'build']
	for (const name of candidateScripts) {
		if (pkgJson.scripts[name]) {
			scriptName = name
			break
		}
	}
}

if (scriptName) {
	console.log('Module needs building')
	
	await $`yarn --cwd module install`
	await $`yarn --cwd module run ${scriptName}`

} else {
	console.log('Module doesnt need building')
}


