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
        const promise = await deleteDocumentsWithUserId(collection, userId, promises);
        promises.push(promise);
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

async function deleteDocumentsWithUserId(collectionRef, userId) {
    const userDocs = await collectionRef.where('uid', '==', userId).get();
    const promises = [];

    for (const doc of userDocs.docs) {
        const subCollections = await doc.ref.listCollections();
        for (const subCollection of subCollections) {
            const allDocsInSubCollection = await subCollection.get();
            for (const subDoc of allDocsInSubCollection.docs) {
                promises.push(subDoc.ref.delete());
            }
            promises.push(deleteDocumentsWithUserId(subCollection, userId)); // サブコレクションのサブコレクションを再帰的に処理
        }
        promises.push(doc.ref.delete()); // 親ドキュメントを削除
    }

    return Promise.all(promises);
}
