// Marks the TypeScript test output directory as CommonJS so Node can run
// the compiled .js test files even though frontend/package.json declares
// "type": "module".
const fs = require('node:fs')
const path = require('node:path')

const dir = path.join(__dirname, '..', '.test-build')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }) + '\n')
