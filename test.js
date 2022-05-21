import mysql from "mysql";
import dotenv from "dotenv";

dotenv.config();

const connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	ssl: "Amazon RDS"
});

connection.connect();

connection.query(
	`CREATE TABLE geese (
		id INT NOT NULL AUTO_INCREMENT,
		name VARCHAR(100) NOT NULL,
		description VARCHAR(2000) NOT NULL,
		uploader VARCHAR(50),
		image VARCHAR(175) NOT NULL,
		PRIMARY KEY ( id ));`,
	console.log
);

connection.end();
