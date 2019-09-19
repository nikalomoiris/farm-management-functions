const { db } = require("../util/admin");

exports.getStatistics = (req, res) => {
    db.collection("statistics")
        .get()
        .then(doc => {
            const statistics = [];
            doc.forEach(stat => {
                const statData = stat.data();
                statistics.push(statData);
            });
            return res.status(200).json(statistics);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};
