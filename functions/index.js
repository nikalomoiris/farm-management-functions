const functions = require("firebase-functions");
const app = require("express")();
const FBAuth = require("./util/FBAuth");
const { db } = require("./util/admin");
const moment = require("moment");

const {
    getAllAnimals,
    postOneAnimal,
    getAnimal,
    deleteAnimal,
    updateAnimal
} = require("./handlers/animals");
const {
    signup,
    login,
    uploadImage,
    addUserDetails,
    getAuthentecatedUser
} = require("./handlers/users");
const { getStatistics } = require("./handlers/statistics");

app.get("/animals", getAllAnimals);
app.post("/animal", FBAuth, postOneAnimal);
app.get("/animal/:animalId", getAnimal);
app.delete("/animal/:animalId", FBAuth, deleteAnimal);
app.post("/animal/:animalId", FBAuth, updateAnimal);

app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthentecatedUser);

app.get("/statistics", getStatistics);

exports.api = functions.https.onRequest(app);

exports.createMotherChildRecord = functions.firestore
    .document("animals/{id}")
    .onCreate(snapshot => {
        if (snapshot.data().mother.trim() !== "") {
            const newRecord = {};
            return db
                .doc(`/animals/${snapshot.id}`)
                .get()
                .then(doc => {
                    newRecord.childCode = doc.data().code;
                    newRecord.child = doc.data();
                    return db
                        .collection("animals")
                        .where("code", "==", doc.data().mother)
                        .get();
                })
                .then(data => {
                    data.forEach(mother => {
                        newRecord.motherCode = mother.data().code;
                        newRecord.mother = mother.data();
                    });
                    return db.collection("motherchild").add(newRecord);
                })
                .then(console.log("Document created successfully"))
                .catch(err => {
                    console.error(err);
                });
        }
    });

exports.recordStatisticsOnCreate = functions.firestore
    .document("animals/{id}")
    .onCreate(() => {
        createHistoryRecord();
    });

exports.recordStatisticsOnDelete = functions.firestore
    .document("animals/{id}")
    .onDelete(() => {
        createHistoryRecord();
    });

exports.createNotificationOnAnimalAdded = functions.firestore
    .document("animals/{id}")
    .onCreate(snapshot => {
        return db
            .collection("notifications")
            .add({
                createdAt: new Date().toISOString(),
                type: "addAnimal",
                read: false,
                animalId: snapshot.id
            })
            .catch(err => {
                console.error(err);
            });
    });

exports.createNotificationOnAnimalDelete = functions.firestore
    .document("animals/{id}")
    .onDelete(snapshot => {
        return db
            .collection("notifications")
            .add({
                createdAt: new Date().toISOString(),
                type: "deleteAnimal",
                read: false,
                animalId: snapshot.id
            })
            .catch(err => {
                console.error(err);
            });
    });

exports.createNotificationOnAnimalUpdate = functions.firestore
    .document("animals/{id}")
    .onUpdate(snapshot => {
        if (snapshot.before.data().points === snapshot.after.data().points) {
            return db
                .collection("notifications")
                .add({
                    createdAt: new Date().toISOString(),
                    type: "updateAnimal",
                    read: false,
                    animalId: snapshot.after.data().code
                })
                .then(() => {
                    console.log("Update notification created");
                })
                .catch(err => {
                    console.error(err);
                });
        }
    });

const createHistoryRecord = () => {
    return db
        .collection("animals")
        .get()
        .then(data => {
            let sumPoints = 0;
            let numberOfAnimals = 0;
            let numberOfAdultAnimals = 0;
            var promises = [];
            data.forEach(doc => {
                const document = doc.data();
                let points;
                const days = moment().diff(
                    moment(document.dateOfBirth),
                    "days"
                );
                if (days > 730) points = 1;
                else if (days > 180) points = 0.6;
                else if (days > 0) points = 0.4;
                else points = 0;
                sumPoints = parseFloat((sumPoints + points).toFixed(1));
                numberOfAnimals++;
                if (points === 1) numberOfAdultAnimals++;
                promises.push(
                    db.doc(`/animals/${document.code}`).update({
                        ...document,
                        points: points
                    })
                );
            });
            Promise.all(promises).then(() => {
                recordHistory({
                    sumPoints,
                    numberOfAnimals,
                    numberOfAdultAnimals
                });
            });
        });
};

const recordHistory = stats => {
    const newRecord = {
        date: new Date().toISOString(),
        ...stats
    };
    let recorded = false;

    db.collection("statistics")
        .get()
        .then(data => {
            if (!data.empty) {
                const promises = [];
                data.forEach(record => {
                    if (
                        moment(record.data().date).diff(
                            moment(newRecord.date),
                            "days"
                        ) === 0
                    ) {
                        recorded = true;
                        promises.push(
                            db.doc(`/statistics/${record.id}`).update(newRecord)
                        );
                    } else {
                        return;
                    }
                });
                Promise.all(promises).then(() => {
                    console.log("Todays record updated");
                    return;
                });
            }
            if (!recorded) {
                db.collection("statistics")
                    .add(newRecord)
                    .then(() => {
                        console.log("New history record added");
                        return;
                    });
            }
        });
};
