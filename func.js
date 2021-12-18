import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("config/config.json"));

export function slugify(name) {
	name = name.replace(" ", "-");
	name = name.toLowerCase();
	name = name.split("");
	name = name.filter((i) => RegExp(config.slugExp).test(i));
	name = name.join("");

	return name;
}

export function randomChar() {
	return config.slugChars[Math.floor(Math.random() * config.slugChars.length)];
}

export async function chooseSlug(value, db) {
	const baseSlug = slugify(value);
	let slug = baseSlug;

	let snapshot = db.collection("geese").doc(slug);
	let doc = await snapshot.get();

	while (doc.exists) {
		slug = baseSlug + "-";

		for (let i = 0; i < 5; i++) {
			slug += randomChar();
		}

		snapshot = db.collection("geese").doc(slug);
		doc = await snapshot.get();
	}

	return slug;
}
