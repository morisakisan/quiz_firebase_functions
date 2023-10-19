const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    const userId = context.auth.uid;

    // Firestoreからのデータ削除
    const db = admin.firestore();
    const collections = await db.listCollections();
    const promises = [];

    const topLevelCollections = await db.listCollections();
    for (const collection of topLevelCollections) {
        promises.push(deleteDocumentsWithUserId(collection, userId, promises));
    }

    // Storageからのデータ削除
    const storageBucket = admin.storage().bucket();
    const userDirectory = `path/to/user/directory/${userId}/`;
    promises.push(storageBucket.deleteFiles({ prefix: userDirectory }));

    // Promiseの実行
    await Promise.all(promises);

    // FirebaseAuthからのアカウント削除
    await admin.auth().deleteUser(userId);

    return { success: true };
});

async function deleteDocumentsWithUserId(collectionRef, userId, promises) {
    const userDocs = await collectionRef.where('uid', '==', userId).get();

    for (const doc of userDocs.docs) {
        promises.push(doc.ref.delete());

        const subCollections = await doc.ref.listCollections();
        for (const subCollection of subCollections) {
            promises.push(deleteDocumentsWithUserId(subCollection, userId, promises));
        }
    }
}
