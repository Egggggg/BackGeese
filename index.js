import Cloudinary from "cloudinary";
import express from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import http from "http";
import Busboy from "busboy";
import { chooseSlug, randomChar } from "./func.js";
import cors from "cors";

dotenv.config();

const app = express();
const cache = {};
const cacheTTL = 600_000;
const cloudinary = Cloudinary.v2;

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_KEY,
	api_secret: process.env.CLOUDINARY_SECRET,
	secure: true
});

const getSingleLimiter = new RateLimiterMemory({
	points: 2,
	duration: 1
});

const uploadLimiter = new RateLimiterMemory({
	points: 1,
	duration: 5
});

let server;

if (process.env.SCOPE === "dev") {
	server = http.createServer(app);
}

app.use(cors());

app.get("/geese/:slug", async (req, res) => {
	let limited = false;

	await getSingleLimiter.consume(req.ip, 1).catch(() => {
		res.sendStatus(429).end("Rate limited");
		limited = true;
	});

	if (limited) {
		return;
	}

	const slug = req.params.slug;

	if (Object.keys(cache).includes(slug)) {
		const data = cache[slug];
		data.timeout.refresh();

		res.send(
			JSON.stringify({
				name: data.name,
				description: data.description,
				likes: data.likes,
				image: data.image,
				offerings: data.offerings
			})
		);

		return;
	}

	// ----- const snapshot = db.collection("geese").doc(req.params.slug);
	// ----- const doc = await snapshot.get();

	if (!doc.exists) {
		res.sendStatus(404);
	} else {
		// ----- const data = doc.data();

		cache[slug] = data;
		cache[slug].timeout = setTimeout(() => delete cache[slug], cacheTTL);

		res.end(
			JSON.stringify({
				name: data.name,
				description: data.description,
				likes: data.likes,
				image: data.image,
				offerings: data.offerings
			})
		);
	}
});

/**
 * /geese
 * image: file, png/jpeg
 * name: string
 * description: string
 */
app.post("/geese", async (req, res) => {
	let limited = false;

	await uploadLimiter.consume(req.ip, 1).catch(() => {
		res.sendStatus(429).end("Rate limited");
		limited = true;
	});

	if (limited) {
		return;
	}

	let slug = null;
	const busboy = new Busboy({ headers: req.headers });

	let data = {};
	let tempId = "";
	let uploaded = false;

	for (let i = 0; i < 10; i++) {
		tempId += randomChar();
	}

	busboy.on("file", (fieldName, file, filename, encoding, mimetype) => {
		if (
			!["application/octet-stream", "image/png", "image/jpeg"].includes(
				mimetype
			)
		) {
			file.destroy();
			return;
		}

		let uploadStream = cloudinary.uploader.upload_stream({
			resource_type: "image",
			public_id: `geese/${tempId}`,
			overwrite: true
		});

		file.pipe(uploadStream);
		uploaded = true;
	});

	busboy.on("field", async (fieldName, value) => {
		if (fieldName === "slug") {
			slug = await chooseSlug(value, db);
		}

		value = value.trim();

		if (
			!["image", "likes", "offerings"].includes(fieldName) &&
			value.length !== 0
		) {
			data[fieldName] = value;
		}
	});

	busboy.on("finish", async () => {
		console.log("finish");

		if (slug === null) {
			slug = await chooseSlug(data.name, db);
		}

		if (uploaded) {
			await cloudinary.uploader.rename(
				`geese/${tempId}`,
				`geese/${slug}`,
				{ overwrite: true },
				(error, result) => {
					data.image = result.secure_url;
				}
			);
		}

		if (!Object.keys(data).includes("image")) {
			res.status(422).end("'image' field missing or invalid");
			return;
		} else if (!Object.keys(data).includes("name")) {
			res.status(422).end("'name' field missing");
			return;
		} else if (!Object.keys(data).includes("description")) {
			res.status(422).end("'description' field missing");
			return;
		}

		data.likes = 0;
		data.offerings = [];

		// ----- const docRef = db.collection("geese").doc(slug);

		data.image = data.image.replace(
			/\/upload\/v[^/]+\//,
			"/upload/c_fill,w_512/"
		);

		// ----- await docRef.set({
			name: data.name,
			description: data.description,
			likes: data.likes,
			image: data.image,
			offerings: data.offerings
		});

		res.end(JSON.stringify(data));
	});

	req.pipe(busboy);
});

server.listen(8080, () => {
	console.log("Listening on :8080");
});
