const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;

  // Firestoreからのデータ削除
  const db = admin.firestore();
  const promises = [];

  const topLevelCollections = await db.listCollections();
  for (const collection of topLevelCollections) {
    const promise = await deleteDocumentsWithUserId(
        collection, userId, promises,
    );
    promises.push(promise);
  }

  // Storageからのデータ削除
  const storageBucket = admin.storage().bucket();
  const userDirectory = `${userId}/`;
  promises.push(storageBucket.deleteFiles({prefix: userDirectory}));

  // Promiseの実行
  await Promise.all(promises);

  // FirebaseAuthからのアカウント削除
  await admin.auth().deleteUser(userId);

  return {success: true};
});

/**
 * ユーザーIDに基づいて、指定されたコレクション内のドキュメントと、
 * それらのドキュメントのサブコレクションを再帰的に削除します。
 *
 * @async
 * @function
 * @param {firebase.firestore.CollectionReference} collectionRef
 * @param {string} userId - 削除するドキュメントのユーザーID。
 * @return {Promise<Array<firebase.firestore.WriteResult>>} 削除操作のPromiseの配列。
 */
async function deleteDocumentsWithUserId(collectionRef, userId) {
  const userDocs = await collectionRef.where("uid", "==", userId).get();
  const promises = [];

  for (const doc of userDocs.docs) {
    const subCollections = await doc.ref.listCollections();
    for (const subCollection of subCollections) {
      const allDocsInSubCollection = await subCollection.get();
      for (const subDoc of allDocsInSubCollection.docs) {
        promises.push(subDoc.ref.delete());
      }
      // サブコレクションのサブコレクションを再帰的に処理
      promises.push(deleteDocumentsWithUserId(subCollection, userId));
    }
    promises.push(doc.ref.delete()); // 親ドキュメントを削除
  }

  return Promise.all(promises);
}
