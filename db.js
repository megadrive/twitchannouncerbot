"use strict";

var ForerunnerDB = require("forerunnerdb");
var fdb = new ForerunnerDB();
var db = fdb.db("announcerbot");
db.persist.dataDir("db");

module.exports = {
	/**
	 * Gets all items in a collection.
	 * @return array Returns a copy of the data in the collection, so you can do whatever with it.
	 */
	"findAll": (tableName, callback) => {
		return new Promise(function(resolve, reject) {
			db.collection(tableName).load(function(err){
				if(err)
					reject(err);

				var docs = db.collection(tableName).find();
				resolve(docs);

				if(callback && typeof callback === "function") callback(docs);
			});
		});
	},

	"find": (tableName, fields, callback) => {
		return new Promise(function(resolve, reject) {
			db.collection(tableName).load(function(err){
				if(err)
					reject(err);

				var docs = db.collection(tableName).find(fields);
				resolve(docs);

				if(callback && typeof callback === "function") callback(docs);
			});
		});
	},

	/**
	 *
	 */
	"insert": (tableName, data, callback) => {
		return new Promise(function(resolve, reject) {
			db.collection(tableName).load(function(err){
				if(err)
					reject(err);

				db.collection(tableName).insert(data, callback);
				db.collection(tableName).save(function(err){
					if(err){
						reject(err);
						throw new Error(err);
					}
				});
				resolve();
			});
		});
	},

	"update": (tableName, selectors, update, onUpdate) => {
		return new Promise(function(resolve, reject) {
			db.collection(tableName).load(function(err){
				if(err)
					reject(err);

				db.collection(tableName).update(selectors, update, {}, onUpdate);
				db.collection(tableName).save(function(err){
					if(err){
						reject(err);
						throw new Error(err);
					}

					resolve();
				});
			});
		});
	},

	"delete": (tableName, fields, callback) => {
		return new Promise(function(resolve, reject) {
			db.collection(tableName).load(function(err){
				if(err)
					reject(err);

				db.collection(tableName).remove(fields, {}, callback);
				db.collection(tableName).save((err) => {
					if(err){
						reject(err);
						throw new Error(err);
					}

					resolve();
				});
			});
		});
	},

	"join": (tableName1, tableName2, selector, joinSelectors, callback) => {
		return new Promise(function(resolve, reject) {
			if(joinSelectors["$require"] === undefined) joinSelectors["$require"] = true;
			if(joinSelectors["$multi"] === undefined) joinSelectors["$multi"] = false;

			db.collection(tableName1).load(() => {
				db.collection(tableName2).load(() => {
					var join = {};
					join[tableName2] = joinSelectors;

					var results = db.collection(tableName1).find(selector, {
						"$join": [join]
					});

					if(callback && typeof callback === "function") callback(results);
				});
			});
		});
	}
};
