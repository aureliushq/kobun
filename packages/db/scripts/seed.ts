import { getLocalOrRemoteDb } from "../utils"

async function main() {
	const _db = getLocalOrRemoteDb()
	console.log("🌱 Seeding database...")

	// Add seed data here

	console.log("✅ Seeding complete!")
}

main().catch((error) => {
	console.error("❌ Seeding failed!")
	console.error(error)
	process.exit(1)
})
