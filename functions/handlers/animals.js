const { db } = require("../util/admin");

exports.getAllAnimals = (req, res) => {
    db.collection("animals")
        .orderBy("code")
        .get()
        .then(data => {
            let animals = [];
            var promises = [];
            data.forEach(doc => {
                let animalData = doc.data();
                promises.push(
                    db
                        .collection("motherchild")
                        .where("motherCode", "==", animalData.code)
                        .get()
                        .then(data => {
                            animalData.children = [];
                            data.forEach(child => {
                                animalData.children.push(child.data().child);
                            });
                            return db
                                .collection("motherchild")
                                .where("childCode", "==", animalData.code)
                                .get();
                        })
                        // Get mother and send the response
                        .then(data => {
                            animalData.mother = "";
                            data.forEach(mother => {
                                animalData.mother = mother.data().mother;
                            });
                            animals.push({
                                ...animalData,
                                animalId: doc.id
                            });
                        })
                        .catch(err => {
                            console.error(err);
                            return res.status(500).json({ error: err.code });
                        })
                );
            });
            Promise.all(promises).then(() => {
                return res.json(animals);
            });
        })
        .catch(err => console.error(err));
};

exports.getAnimal = (req, res) => {
    let animalData = {};
    db.doc(`/animals/${req.params.animalId}`)
        .get()
        // Get animal and wait for the children array
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: "Animal not found" });
            }
            animalData = doc.data();
            animalData.animalId = doc.id;

            return db
                .collection("motherchild")
                .where("motherCode", "==", animalData.code)
                .get();
        })
        // Get children array and wait for mother
        .then(data => {
            animalData.children = [];
            data.forEach(child => {
                animalData.children.push(child.data().child);
            });
            return db
                .collection("motherchild")
                .where("childCode", "==", animalData.code)
                .get();
        })
        // Get mother and send the response
        .then(data => {
            animalData.mother = "";
            data.forEach(mother => {
                animalData.mother = mother.data().mother;
            });
            return res.json(animalData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};

exports.postOneAnimal = (req, res) => {
    if (req.body.code.trim() === "") {
        return res.status(400).json({ code: "Must not be empty" });
    }

    const newAnimal = {
        code: req.body.code,
        points: "",
        mother: req.body.mother,
        isAlive: req.body.isAlive,
        sex: req.body.sex,
        dateOfBirth: req.body.dateOfBirth,
        notes: req.body.notes,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString()
    };

    db.doc(`/animals/${newAnimal.code}`)
        .get()
        .then(doc => {
            if (doc.exists) {
                return res
                    .status(400)
                    .json({ error: "Animal code already exists" });
            } else {
                db.doc(`/animals/${newAnimal.code}`)
                    .set(newAnimal)
                    .then(doc => {
                        const resAnimal = newAnimal;
                        resAnimal.animalId = doc.id;
                        res.json(resAnimal);
                    })
                    .catch(err => {
                        res.status(500).json({ error: "somthing went wrong" });
                        console.error(err);
                    });
            }
        })
        .catch(err => {
            res.status(500).json({ error: "somthing went wrong" });
            console.error(err);
        });
};

exports.deleteAnimal = (req, res) => {
    const document = db.doc(`/animals/${req.params.animalId}`);
    document
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: "Animal not found" });
            }
            return document.delete();
        })
        .then(() => {
            return res.json({ message: "Animal deleted successfully" });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};

exports.updateAnimal = (req, res) => {
    db.doc(`/animals/${req.params.animalId}`)
        .update({
            ...req.body
        })
        .then(doc => {
            return res.status(200).json(doc);
        })
        .catch(err => {
            console.error(err);
            return res.status(404).json({ error: err.code });
        });
};
