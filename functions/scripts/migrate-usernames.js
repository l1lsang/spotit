// Run with Application Default Credentials for the selected Firebase project.
// Preview: node scripts/migrate-usernames.js --project PROJECT_ID
// Apply:   node scripts/migrate-usernames.js --project PROJECT_ID --apply
const { randomUUID } = require('node:crypto')
const admin = require('firebase-admin')

async function migrateUsernames(db, { apply = false, pageSize = 200 } = {}) {
  const totals = { scanned: 0, eligible: 0, migrated: 0, skipped: 0 }
  let cursor
  while (true) {
    let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize)
    if (cursor) query = query.startAfter(cursor)
    const page = await query.get()
    if (page.empty) break
    for (const userDoc of page.docs) {
      totals.scanned += 1
      if (userDoc.data().username || userDoc.data().onboardingComplete === false) {
        totals.skipped += 1
        continue
      }
      totals.eligible += 1
      if (!apply) continue
      let complete = false
      for (let attempt = 0; attempt < 10 && !complete; attempt += 1) {
        const result = await db.runTransaction(async transaction => {
          const fresh = await transaction.get(userDoc.ref)
          if (!fresh.exists || fresh.data().username || fresh.data().onboardingComplete === false) return 'skipped'
          const username = 'user_' + randomUUID().replaceAll('-', '').slice(0, 20)
          const reservation = db.collection('usernames').doc('@' + username)
          if ((await transaction.get(reservation)).exists) return 'retry'
          transaction.create(reservation, { uid: fresh.id })
          transaction.update(userDoc.ref, {
            username,
            bio: fresh.data().bio || '',
            onboardingComplete: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          return 'migrated'
        })
        complete = result !== 'retry'
        if (result === 'migrated') totals.migrated += 1
        if (result === 'skipped') totals.skipped += 1
      }
      if (!complete) throw new Error('Could not reserve a unique username after 10 attempts.')
    }
    cursor = page.docs.at(-1)
  }
  return totals
}

module.exports = { migrateUsernames }

if (require.main === module) {
  const args = process.argv.slice(2)
  const projectIndex = args.indexOf('--project')
  const projectId = projectIndex >= 0 ? args[projectIndex + 1] : ''
  if (!projectId || projectId.startsWith('--')) {
    console.error('Usage: node scripts/migrate-usernames.js --project PROJECT_ID [--apply]')
    process.exitCode = 1
  } else {
    admin.initializeApp({ projectId })
    const apply = args.includes('--apply')
    migrateUsernames(admin.firestore(), { apply })
      .then(totals => console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', ...totals })))
      .catch(error => { console.error(error.message); process.exitCode = 1 })
  }
}
