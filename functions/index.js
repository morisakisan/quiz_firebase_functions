const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    const userId = context.auth.uid;

    // Firestoreからのデータ削除
    const db = admin.firestore();
    const collections = await db.listCollections();
    const promises = [];

    for (const collection of collections) {
        const userDocs = await collection.where('uid', '==', userId).get();
        userDocs.forEach(doc => {
            promises.push(doc.ref.delete());
        });
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
