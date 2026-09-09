// Preview: node functions/scripts/migrate-groups.js --project PROJECT_ID
// Apply:   node functions/scripts/migrate-groups.js --project PROJECT_ID --apply
const admin = require('firebase-admin')

async function migrateGroups(db, { apply = false, pageSize = 200 } = {}) {
  const totals = { scanned: 0, eligible: 0, migrated: 0 }
  let cursor
  while (true) {
    let query = db.collection('groups').orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize)
    if (cursor) query = query.startAfter(cursor)
    const page = await query.get()
    if (page.empty) break
    for (const group of page.docs) {
      totals.scanned++
      if (group.data().visibility !== undefined) continue
      totals.eligible++
      if (!apply) continue
      await db.runTransaction(async transaction => {
        const current = await transaction.get(group.ref)
        if (current.exists && current.data().visibility === undefined) {
          transaction.update(group.ref, { visibility: 'public' })
        }
      })
      totals.migrated++
    }
    cursor = page.docs.at(-1)
  }
  return totals
}

if (require.main === module) {
  const projectId = process.argv[process.argv.indexOf('--project') + 1]
  if (!process.argv.includes('--project') || !projectId || projectId.startsWith('--')) {
    console.error('Pass --project PROJECT_ID. Add --apply to migrate existing public groups.')
    process.exitCode = 1
  } else {
    admin.initializeApp({ projectId })
    migrateGroups(admin.firestore(), { apply: process.argv.includes('--apply') })
      .then(totals => console.log(JSON.stringify(totals)))
      .catch(error => { console.error(error.message); process.exitCode = 1 })
  }
}

module.exports = { migrateGroups }
