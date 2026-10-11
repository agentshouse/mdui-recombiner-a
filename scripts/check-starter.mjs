import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { verify, validate, parse } from '@agentshouse/mdmodel'
const schema = fs.readFileSync('schema.yaml', 'utf8')
const model = verify(schema)
assert.equal(model.verdict, 'accept')
const documents = {}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink())
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else { assert(entry.isFile() && file.endsWith('.md')); documents[path.relative('starter', file)] = fs.readFileSync(file, 'utf8') }
  }
}
walk('starter')
assert(Object.keys(documents).length > 0)
assert.equal(validate({ 'settings/schema.yaml': schema, ...documents }, { binaryTargets: [] }, model.model).verdict, 'accept')
const originals = new Map(JSON.parse(fs.readFileSync('tests/support/samples/seed-room-changes.json', 'utf8')).changes.map(row => [row.path.replace(/^\/rooms\/[^/]+\//, ''), row.content]))
for (const [file, content] of Object.entries(documents)) {
  assert.equal(content, originals.get(file), 'Starter must preserve original licensed example paths and bytes.')
  const result = parse(content, file); assert(result.ok)
  assert.equal(result.document.type, 'recombiner_book')
  assert.equal(result.document.fields.license, 'CC-BY-4.0')
}
assert.equal(fs.readFileSync('public/samples/manual.catalog.json', 'utf8'), fs.readFileSync('tests/support/samples/manual.catalog.json', 'utf8'), 'Runtime catalogue fixture must remain unchanged.')
console.log(`PASS: ${Object.keys(documents).length} complete original licensed catalogue document.`)
